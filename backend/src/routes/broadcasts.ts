import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';
import { executeSegment } from '../services/segmentEngine';
import { dispatchWhatsAppMessage, dispatchEmailMessage } from '../services/messagingRouter';
import { renderTemplateContent, WhitelistVariables } from '../services/templateEngine';

const router = Router();
router.use(authenticate);

// GET /api/broadcasts — List broadcasts with segment names and stats
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = `
      SELECT 
        b.*,
        s.name as segment_name,
        t.name as template_name,
        o.name as organization_name
      FROM broadcasts b
      LEFT JOIN segments s ON b.segment_id = s.id
      LEFT JOIN templates t ON b.template_id = t.id
      LEFT JOIN organizations o ON b.organization_id = o.id
    `;
    const params: any[] = [];
    if (user.role !== 'superadmin') {
      const orgId = user.organization_id || user.organizationId;
      query += ' WHERE b.organization_id = $1';
      params.push(orgId);
    }
    query += ' ORDER BY b.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/broadcasts — Create broadcast
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user.organization_id || user.organizationId;
    const { name, broadcast_name, segment_id, template_id, channel, scheduled_at, status } = req.body;
    const finalName = broadcast_name || name || 'New Outreach Broadcast';

    // Calculate initial target recipient count from segment
    let recipientCount = 0;
    if (segment_id) {
      const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [segment_id]);
      if (segRes.rows.length > 0) {
        const seg = segRes.rows[0];
        const segEval = await executeSegment(orgId, seg.rules_json, seg.query_sql, 10, 0, seg.suppression_applied);
        recipientCount = segEval.count;
      }
    }

    const result = await pool.query(
      `INSERT INTO broadcasts (
         organization_id, broadcast_name, segment_id, template_id, channel, 
         scheduled_at, status, total_recipients, created_at, updated_at
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [orgId, finalName, segment_id, template_id, channel, scheduled_at || null, status || 'draft', recipientCount]
    );

    // If immediate send requested
    if (status === 'sending') {
      executeBroadcastDispatch(result.rows[0].id, orgId).catch(err => console.error('Background broadcast dispatch error:', err));
    }

    res.status(201).json({ success: true, data: result.rows[0], message: 'Broadcast campaign created!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/broadcasts/:id — Update broadcast
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, broadcast_name, segment_id, template_id, channel, scheduled_at } = req.body;
    const finalName = broadcast_name || name;

    const result = await pool.query(
      `UPDATE broadcasts 
       SET 
         broadcast_name = COALESCE($1, broadcast_name), 
         segment_id = COALESCE($2, segment_id),
         template_id = COALESCE($3, template_id),
         channel = COALESCE($4, channel),
         scheduled_at = COALESCE($5, scheduled_at), 
         updated_at = NOW() 
       WHERE id = $6 AND (organization_id = $7 OR $8 = 'superadmin') 
       RETURNING *`,
      [finalName, segment_id, template_id, channel, scheduled_at, id, user.organization_id || user.organizationId, user.role]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/broadcasts/:id/send — Execute live broadcast dispatch to segment members
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const orgId = user.organization_id || user.organizationId;

    const bcRes = await pool.query(
      `SELECT * FROM broadcasts WHERE id = $1 AND (organization_id = $2 OR $3 = 'superadmin')`,
      [id, orgId, user.role]
    );

    if (bcRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Broadcast not found' });
    }

    await pool.query(`UPDATE broadcasts SET status = 'sending', updated_at = NOW() WHERE id = $1`, [id]);

    // Asynchronously dispatch in background
    executeBroadcastDispatch(id, bcRes.rows[0].organization_id)
      .catch(err => console.error('[Broadcast Dispatch Error]:', err));

    res.json({ success: true, message: 'Broadcast execution started across audience segment.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to dispatch broadcast to segment members
async function executeBroadcastDispatch(broadcastId: string, orgId: string) {
  try {
    const bcRes = await pool.query('SELECT * FROM broadcasts WHERE id = $1', [broadcastId]);
    if (bcRes.rows.length === 0) return;
    const bc = bcRes.rows[0];

    // 1. Fetch Segment
    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [bc.segment_id]);
    if (segRes.rows.length === 0) {
      await pool.query(`UPDATE broadcasts SET status = 'failed', updated_at = NOW() WHERE id = $1`, [broadcastId]);
      return;
    }
    const seg = segRes.rows[0];

    // 2. Fetch Template
    let templateSubject = 'Important Message';
    let templateContent = 'Hello {{donor_name}}! Thank you for supporting our cause.';
    if (bc.template_id) {
      const tmplRes = await pool.query('SELECT subject, content FROM templates WHERE id = $1', [bc.template_id]);
      if (tmplRes.rows.length > 0) {
        templateSubject = tmplRes.rows[0].subject || templateSubject;
        templateContent = tmplRes.rows[0].content || templateContent;
      }
    }

    // 3. Fetch Organization
    const orgRes = await pool.query('SELECT name, certificate_80g_config FROM organizations WHERE id = $1', [orgId]);
    const org = orgRes.rows[0] || { name: 'DanaPro NGO' };

    // 4. Execute segment query
    const { rows: donors, count: totalRecipients } = await executeSegment(orgId, seg.rules_json, seg.query_sql, 50000, 0, seg.suppression_applied);

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    for (const donor of donors) {
      const vars: WhitelistVariables = {
        donor_name: donor.display_name || donor.name || 'Valued Supporter',
        donor_email: donor.email || '',
        donor_phone: donor.phone || '',
        donor_tax_id: donor.tax_id || 'NOT_PROVIDED',
        donation_amount: Number(donor.total_paid_amount || 0),
        donation_currency: 'INR',
        transaction_id: 'BROADCAST',
        payment_status: 'SUCCESS',
        receipt_url: 'https://danapro.org',
        ngo_name: org.name || 'DanaPro',
        ngo_urn: org.certificate_80g_config?.urn || '',
        campaign_title: bc.broadcast_name,
        donation_date: new Date().toISOString().split('T')[0]
      };

      const finalSubject = renderTemplateContent(templateSubject, vars);
      const finalBody = renderTemplateContent(templateContent, vars);

      if (bc.channel === 'whatsapp' && donor.phone) {
        const waRes = await dispatchWhatsAppMessage({
          organizationId: orgId,
          recipientPhone: donor.phone,
          messageText: finalBody,
          templateName: 'broadcast_general'
        });

        sentCount++;
        if (waRes.success) deliveredCount++;
        else failedCount++;

        await pool.query(
          `INSERT INTO whatsapp_communications (
             organization_id, contact_id, recipient_number, broadcast_id, 
             communication_type, trigger_type, status, template_name, meta_message_id, 
             sent_at, delivered_at, failure_reason
           ) VALUES ($1, $2, $3, $4, 'broadcast_whatsapp', 'broadcast', $5, $6, $7, NOW(), $8, $9)`,
          [
            orgId,
            donor.id,
            donor.phone,
            broadcastId,
            waRes.success ? 'delivered' : 'failed',
            'broadcast_general',
            waRes.messageId || null,
            waRes.success ? new Date() : null,
            waRes.error || null
          ]
        );
      } else if (bc.channel === 'email' && donor.email && !donor.email.includes('@external.org')) {
        const emailRes = await dispatchEmailMessage({
          organizationId: orgId,
          recipientEmail: donor.email,
          recipientName: donor.display_name || donor.name,
          subject: finalSubject,
          htmlBody: finalBody
        });

        sentCount++;
        if (emailRes.success) deliveredCount++;
        else failedCount++;

        await pool.query(
          `INSERT INTO email_communications (
             organization_id, contact_id, broadcast_id, subject_line, 
             communication_type, trigger_type, status, sent_at, delivered_at, error
           ) VALUES ($1, $2, $3, $4, 'broadcast_email', 'broadcast', $5, NOW(), $6, $7)`,
          [
            orgId,
            donor.id,
            broadcastId,
            finalSubject,
            emailRes.success ? 'delivered' : 'failed',
            emailRes.success ? new Date() : null,
            emailRes.error || null
          ]
        );
      }
    }

    await pool.query(
      `UPDATE broadcasts 
       SET 
         status = 'completed', 
         total_recipients = $1, 
         sent_count = $2, 
         delivered_count = $3, 
         failed_count = $4, 
         updated_at = NOW() 
       WHERE id = $5`,
      [totalRecipients, sentCount, deliveredCount, failedCount, broadcastId]
    );
  } catch (err) {
    console.error('Fatal broadcast dispatch error:', err);
    await pool.query(`UPDATE broadcasts SET status = 'failed', updated_at = NOW() WHERE id = $1`, [broadcastId]);
  }
}

// PUT /api/broadcasts/:id/pause
router.put('/:id/pause', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE broadcasts SET status = 'paused', updated_at = NOW() WHERE id = $1 AND (organization_id = $2 OR $3 = 'superadmin') RETURNING *`,
      [id, user.organization_id || user.organizationId, user.role]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/broadcasts/:id/stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT sent_count, delivered_count, failed_count, opened_count, clicked_count, read_count, total_recipients 
       FROM broadcasts WHERE id = $1 AND (organization_id = $2 OR $3 = 'superadmin')`,
      [id, user.organization_id || user.organizationId, user.role]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/broadcasts/:id
router.delete('/:id', authorizeRole(['superadmin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM broadcasts WHERE id = $1', [id]);
    res.json({ success: true, message: 'Broadcast deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
