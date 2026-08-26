import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = req.query.organizationId || user?.organizationId || user?.organization_id;
    
    let query = `
      SELECT m.*, d.name as donor_name, d.email as donor_email, d.phone as donor_phone 
      FROM mandates m 
      LEFT JOIN donors d ON m.contact_id = d.id
    `;
    const params: any[] = [];
    if (organization_id) {
      query += ' WHERE m.organization_id = $1';
      params.push(organization_id);
    }
    query += ' ORDER BY m.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT m.*, d.name as donor_name, d.email as donor_email, d.phone as donor_phone 
      FROM mandates m 
      LEFT JOIN donors d ON m.contact_id = d.id 
      WHERE m.id = $1
    `, [id]);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Mandate not found' });
    
    const paymentHistory = await pool.query(
      `SELECT * FROM donations WHERE subscription_id = $1 ORDER BY created_at DESC`, 
      [result.rows[0].monthly_donation_id]
    );
    
    res.json({ success: true, data: { ...result.rows[0], payment_history: paymentHistory.rows } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/revoke', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE mandates SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Mandate not found' });
    res.json({ success: true, data: result.rows[0], message: 'Mandate successfully revoked' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
