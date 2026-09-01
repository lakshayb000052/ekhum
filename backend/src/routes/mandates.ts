import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { recalculateContactRollups, updateSubscriptionStats } from '../services/contactRollupService';

const router = Router();

// GET /api/mandates OR /api/subscriptions — list all Monthly Donations
router.get(['/', '/subscriptions'], authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    
    let query = `
      SELECT 
        s.*,
        s.id AS monthly_donation_id,
        d.id AS contact_id,
        COALESCE(d.name, TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, '')))) AS donor_name,
        d.email AS donor_email,
        d.phone AS donor_phone,
        d.tax_id AS donor_tax_id,
        c.id AS campaign_id,
        c.title AS campaign_title,
        c.title AS signup_campaign,
        o.id AS organization_id,
        o.name AS organization_name,
        COALESCE(s.pan_card, (d.tax_id IS NOT NULL AND TRIM(d.tax_id) != '')) AS pan_card,
        m.bank_name AS mandate_bank_name,
        m.mandate_method,
        m.umrn,
        (SELECT COUNT(*) FROM donations WHERE subscription_id = s.id AND status IN ('completed', 'paid', 'success')) AS verified_paid_installments,
        (SELECT COUNT(*) FROM donations WHERE subscription_id = s.id) AS verified_attempted_installments
      FROM subscriptions s
      LEFT JOIN donors d ON s.donor_id = d.id
      LEFT JOIN campaigns c ON s.signup_campaign_id = c.id OR s.campaign_id = c.id
      LEFT JOIN organizations o ON s.organization_id = o.id
      LEFT JOIN mandates m ON s.mandate_id = m.id OR m.monthly_donation_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (organization_id && organization_id !== 'all') {
      query += ' AND s.organization_id = $1';
      params.push(organization_id);
    }
    query += ' ORDER BY s.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/mandates/:id — get single Monthly Donation details and its payment installment history
router.get(['/:id', '/subscriptions/:id'], authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        s.*,
        s.id AS monthly_donation_id,
        d.id AS contact_id,
        COALESCE(d.name, TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, '')))) AS donor_name,
        d.email AS donor_email,
        d.phone AS donor_phone,
        d.tax_id AS donor_tax_id,
        c.title AS campaign_title,
        c.title AS signup_campaign,
        o.name AS organization_name,
        COALESCE(s.pan_card, (d.tax_id IS NOT NULL AND TRIM(d.tax_id) != '')) AS pan_card,
        m.bank_name AS mandate_bank_name,
        m.mandate_method,
        m.umrn
      FROM subscriptions s
      LEFT JOIN donors d ON s.donor_id = d.id 
      LEFT JOIN campaigns c ON s.signup_campaign_id = c.id OR s.campaign_id = c.id
      LEFT JOIN organizations o ON s.organization_id = o.id
      LEFT JOIN mandates m ON s.mandate_id = m.id OR m.monthly_donation_id = s.id
      WHERE s.id = $1 OR s.mandate_id = $1
    `, [id]);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly donation record not found' });
    
    const monthlyDonation = result.rows[0];

    const paymentHistory = await pool.query(`
      SELECT 
        dn.*,
        dn.id AS payment_id,
        dn.created_at AS payment_date,
        c.title AS payment_campaign,
        o.name AS organization_name,
        COALESCE(dn.payment_type, 'monthly_donation') AS payment_type,
        r.receipt_number,
        r.pdf_url AS receipt_pdf_url
      FROM donations dn
      LEFT JOIN campaigns c ON dn.campaign_id = c.id
      LEFT JOIN organizations o ON dn.organization_id = o.id
      LEFT JOIN eighty_g_receipts r ON dn.id = r.payment_id
      WHERE dn.subscription_id = $1 OR dn.donor_id = $2
      ORDER BY dn.created_at DESC
    `, [monthlyDonation.id, monthlyDonation.donor_id]);
    
    res.json({ 
      success: true, 
      data: { 
        ...monthlyDonation, 
        payment_history: paymentHistory.rows 
      } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mandates/:id/pause — Pause monthly donation
router.post(['/:id/pause', '/subscriptions/:id/pause'], authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paused_period = 3, pause_start_date, pause_end_date, helpdesk_ticket_id } = req.body;
    
    const result = await pool.query(
      `UPDATE subscriptions 
       SET 
         status = 'paused', 
         paused = true, 
         paused_period = $1, 
         pause_start_date = COALESCE($2, CURRENT_DATE), 
         pause_end_date = COALESCE($3, CURRENT_DATE + INTERVAL '${paused_period} months'),
         helpdesk_ticket_id = COALESCE($4, helpdesk_ticket_id, 'HD-' || floor(random()*900000 + 100000)::text),
         helpdesk_status = 'Paused',
         updated_at = NOW() 
       WHERE id = $5 
       RETURNING *`,
      [Number(paused_period), pause_start_date || null, pause_end_date || null, helpdesk_ticket_id || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly donation not found' });
    const sub = result.rows[0];
    await recalculateContactRollups(sub.donor_id, sub.organization_id);

    res.json({ success: true, data: sub, message: `Monthly donation paused for ${paused_period} months.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mandates/:id/resume — Resume paused monthly donation
router.post(['/:id/resume', '/subscriptions/:id/resume'], authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE subscriptions 
       SET 
         status = 'active', 
         paused = false, 
         helpdesk_status = 'Saved',
         next_payment_due_date = CURRENT_DATE + INTERVAL '1 month',
         updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly donation not found' });
    const sub = result.rows[0];
    await recalculateContactRollups(sub.donor_id, sub.organization_id);

    res.json({ success: true, data: sub, message: 'Monthly donation successfully resumed and set to active.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mandates/:id/upgrade — Upgrade recurring installment value
router.post(['/:id/upgrade', '/subscriptions/:id/upgrade'], authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { upgraded_value, helpdesk_ticket_id } = req.body;

    if (!upgraded_value || Number(upgraded_value) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid upgraded value required' });
    }

    const result = await pool.query(
      `UPDATE subscriptions 
       SET 
         value_upgrade = true, 
         value_upgrade_date = CURRENT_DATE,
         upgraded_value = $1,
         amount = $1,
         helpdesk_ticket_id = COALESCE($2, helpdesk_ticket_id, 'HD-' || floor(random()*900000 + 100000)::text),
         helpdesk_status = 'Saved',
         updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [Number(upgraded_value), helpdesk_ticket_id || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly donation not found' });
    const sub = result.rows[0];
    await recalculateContactRollups(sub.donor_id, sub.organization_id);

    res.json({ success: true, data: sub, message: `Monthly donation successfully upgraded to ₹${upgraded_value}/month.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mandates/:id/cancel — Cancel monthly donation
router.post(['/:id/cancel', '/:id/revoke', '/subscriptions/:id/cancel'], authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { end_reason = 'Donor requested cancellation', helpdesk_ticket_id } = req.body;

    const result = await pool.query(
      `UPDATE subscriptions 
       SET 
         status = 'cancelled', 
         end_reason = $1, 
         end_date = CURRENT_DATE,
         helpdesk_ticket_id = COALESCE($2, helpdesk_ticket_id, 'HD-' || floor(random()*900000 + 100000)::text),
         helpdesk_status = 'Cancelled',
         updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [end_reason, helpdesk_ticket_id || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly donation not found' });
    const sub = result.rows[0];
    await recalculateContactRollups(sub.donor_id, sub.organization_id);

    res.json({ success: true, data: sub, message: 'Monthly donation successfully cancelled.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
