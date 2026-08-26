import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { dispatchWhatsAppMessage, dispatchEmailMessage } from '../services/messagingRouter';

const router = Router();

// GET /api/communications — combined communications list
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    const channel = req.query.channel as string;

    let emailsQuery = `
      SELECT e.*, 'email' as channel, 
             COALESCE(d.name, 'Donor Partner') as recipient_name, 
             COALESCE(d.email, e.from_address) as recipient_email, 
             d.phone as recipient_phone 
      FROM email_communications e
      LEFT JOIN donors d ON e.contact_id = d.id
    `;
    let whatsappsQuery = `
      SELECT w.*, 'whatsapp' as channel, 
             COALESCE(d.name, 'Donor Partner') as recipient_name, 
             d.email as recipient_email, 
             COALESCE(w.recipient_number, d.phone) as recipient_phone 
      FROM whatsapp_communications w
      LEFT JOIN donors d ON w.contact_id = d.id
    `;
    const params: any[] = [];
    if (organization_id && organization_id !== 'all' && organization_id.trim() !== '') {
      emailsQuery += ` WHERE (e.organization_id = $1 OR e.organization_id IS NULL)`;
      whatsappsQuery += ` WHERE (w.organization_id = $1 OR w.organization_id IS NULL)`;
      params.push(organization_id.trim());
    }

    let rows: any[] = [];
    if (channel === 'Email') {
      const result = await pool.query(emailsQuery + ` ORDER BY e.created_at DESC LIMIT 100`, params);
      rows = result.rows;
    } else if (channel === 'WhatsApp') {
      const result = await pool.query(whatsappsQuery + ` ORDER BY w.created_at DESC LIMIT 100`, params);
      rows = result.rows;
    } else {
      const [emailRes, waRes] = await Promise.all([
        pool.query(emailsQuery + ` ORDER BY e.created_at DESC LIMIT 50`, params),
        pool.query(whatsappsQuery + ` ORDER BY w.created_at DESC LIMIT 50`, params)
      ]);
      rows = [...emailRes.rows, ...waRes.rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/communications/send — dispatch ad-hoc message
router.post('/send', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);
    const { contact_id, channel, template_name, subject_line, message } = req.body;

    const donorRes = await pool.query('SELECT name, email, phone FROM donors WHERE id = $1', [contact_id]);
    const donor = donorRes.rows[0] || {};

    if (channel === 'whatsapp') {
      const messageText = message || 'Hello ' + (donor.name || 'Supporter') + ', you have a new update from DanaPro.';
      const waResult = await dispatchWhatsAppMessage({
        organizationId: organization_id,
        recipientPhone: donor.phone || '',
        messageText,
        templateName: template_name || 'ad_hoc_update'
      });

      const resWa = await pool.query(
        `INSERT INTO whatsapp_communications (
           organization_id, contact_id, recipient_number, template_name,
           communication_type, trigger_type, status, meta_message_id, sent_at, delivered_at, failure_reason
         )
         VALUES ($1, $2, $3, $4, 'adhoc_whatsapp', 'manual', $5, $6, NOW(), $7, $8) RETURNING *`,
        [
          organization_id, 
          contact_id, 
          donor.phone || '',
          template_name || 'ad_hoc_update',
          waResult.success ? 'delivered' : 'failed',
          waResult.messageId || null,
          waResult.success ? new Date() : null,
          waResult.error || null
        ]
      );
      return res.status(201).json({ 
        success: waResult.success, 
        data: resWa.rows[0], 
        provider: waResult.provider, 
        message: waResult.success ? 'WhatsApp message dispatched successfully' : ('Dispatch error: ' + (waResult.error || 'Failed')) 
      });
    } else {
      const subject = subject_line || 'Important Update from DanaPro';
      const htmlBody = message ? `<div style="font-family: sans-serif; padding: 16px;">${message}</div>` : `<p>Dear ${donor.name || 'Supporter'},</p><p>Thank you for supporting our organization.</p>`;

      const emailResult = await dispatchEmailMessage({
        organizationId: organization_id,
        recipientEmail: donor.email,
        recipientName: donor.name,
        subject,
        htmlBody
      });

      const resEm = await pool.query(
        `INSERT INTO email_communications (
           organization_id, contact_id, subject_line, communication_type,
           trigger_type, status, ses_message_id, sent_at, delivered_at, error
         )
         VALUES ($1, $2, $3, 'adhoc_email', 'manual', $4, $5, NOW(), $6, $7) RETURNING *`,
        [
          organization_id, 
          contact_id, 
          subject,
          emailResult.success ? 'delivered' : 'failed',
          emailResult.messageId || null,
          emailResult.success ? new Date() : null,
          emailResult.error || null
        ]
      );
      return res.status(201).json({ 
        success: emailResult.success, 
        data: resEm.rows[0], 
        provider: emailResult.provider, 
        message: emailResult.success ? 'Email dispatched successfully' : ('Dispatch error: ' + (emailResult.error || 'Failed'))
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/communications/email — list email communications
router.get('/email', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = req.query.organizationId || user?.organizationId || user?.organization_id;
    
    let query = `
      SELECT e.*, d.name as recipient_name, d.email as recipient_email 
      FROM email_communications e
      LEFT JOIN donors d ON e.contact_id = d.id
    `;
    const params: any[] = [];
    if (organization_id) {
      query += ` WHERE e.organization_id = $1`;
      params.push(organization_id);
    }
    query += ` ORDER BY e.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/communications/whatsapp — list whatsapp communications
router.get('/whatsapp', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = req.query.organizationId || user?.organizationId || user?.organization_id;
    
    let query = `SELECT * FROM whatsapp_communications`;
    const params: any[] = [];
    if (organization_id) {
      query += ` WHERE organization_id = $1`;
      params.push(organization_id);
    }
    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/communications/contact/:contactId — full communication history for a contact
router.get('/contact/:contactId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const emails = await pool.query(`SELECT *, 'email' as channel FROM email_communications WHERE contact_id = $1 ORDER BY created_at DESC`, [contactId]);
    const whatsapps = await pool.query(`SELECT *, 'whatsapp' as channel FROM whatsapp_communications WHERE contact_id = $1 ORDER BY created_at DESC`, [contactId]);
    
    const combined = [...emails.rows, ...whatsapps.rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({ success: true, data: combined });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/communications/stats — aggregate stats
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = req.query.organizationId || user?.organizationId || user?.organization_id;

    let emailWhere = organization_id ? `WHERE organization_id = $1` : ``;
    let emailParams = organization_id ? [organization_id] : [];

    const emailStats = await pool.query(`
      SELECT status, COUNT(*) as count FROM email_communications ${emailWhere} GROUP BY status
    `, emailParams);

    const whatsappStats = await pool.query(`
      SELECT status, COUNT(*) as count FROM whatsapp_communications ${emailWhere} GROUP BY status
    `, emailParams);

    res.json({ 
      success: true, 
      data: {
        emails: emailStats.rows,
        whatsapp: whatsappStats.rows
      } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
