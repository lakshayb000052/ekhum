import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/consent OR /api/consents — list all consents
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = req.query.organizationId || user?.organizationId || user?.organization_id;
    let query = `
      SELECT c.*, d.name as contact_name, d.email as contact_email, d.phone as contact_phone
      FROM consents c
      LEFT JOIN donors d ON c.contact_id = d.id
    `;
    const params: any[] = [];
    if (organization_id) {
      query += ` WHERE c.organization_id = $1`;
      params.push(organization_id);
    }
    query += ` ORDER BY c.created_at DESC LIMIT 100`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:contactId', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = req.query.organizationId || user?.organizationId || user?.organization_id;
    const { contactId } = req.params;
    const result = await pool.query(
      `SELECT * FROM consents WHERE organization_id = $1 AND contact_id = $2`,
      [organization_id, contactId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let organization_id = req.body.organization_id || user?.organizationId || user?.organization_id;
    if (!organization_id) {
      const orgLookup = await pool.query('SELECT id FROM organizations LIMIT 1');
      organization_id = orgLookup.rows[0]?.id;
    }
    const { contact_id, channel, status, source } = req.body;
    
    const result = await pool.query(
      `INSERT INTO consents (organization_id, contact_id, channel, status, source) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (contact_id, channel) 
       DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source, updated_at = NOW() 
       RETURNING *`,
      [organization_id, contact_id, channel || 'Email', status || 'Active', source || 'Web Form']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/withdraw', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' ? null : (user?.organizationId || user?.organization_id);
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE consents SET status = 'withdrawn', updated_at = NOW() 
       WHERE id = $1 ${organization_id ? 'AND organization_id = $2' : ''} RETURNING *`,
      organization_id ? [id, organization_id] : [id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Consent record not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
