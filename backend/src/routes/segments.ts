import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = 'SELECT * FROM segments';
    const params: any[] = [];
    if (user?.role !== 'superadmin') {
      const orgId = user.organization_id || user.organizationId;
      query += ' WHERE organization_id = $1';
      params.push(orgId);
    } else if (req.query.organizationId) {
      query += ' WHERE organization_id = $1';
      params.push(req.query.organizationId);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
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
    const { name, description, query_rules } = req.body;

    // Count matching donors
    const donorCountRes = await pool.query(`SELECT COUNT(*) FROM donors WHERE organization_id = $1`, [organization_id]);
    const memberCount = Number(donorCountRes.rows[0]?.count || 0);
    
    const result = await pool.query(
      `INSERT INTO segments (organization_id, name, description, query_rules, status, member_count, last_refreshed_at, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, 'approved', $5, NOW(), NOW(), NOW()) RETURNING *`,
      [organization_id, name, description || '', query_rules || 'SELECT * FROM donors', memberCount]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, query_rules } = req.body;
    
    const result = await pool.query(
      `UPDATE segments SET name = COALESCE($1, name), description = COALESCE($2, description), query_rules = COALESCE($3, query_rules), updated_at = NOW() 
       WHERE id = $4 RETURNING *`,
      [name, description, query_rules, id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (segRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    const orgId = segRes.rows[0].organization_id;

    const countRes = await pool.query(`SELECT COUNT(*) FROM donors WHERE organization_id = $1`, [orgId]);
    const realCount = Number(countRes.rows[0]?.count || 0);

    const result = await pool.query(
      `UPDATE segments SET member_count = $1, last_refreshed_at = NOW() WHERE id = $2 RETURNING *`,
      [realCount, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post(['/preview', '/:id/preview'], authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' ? null : (user?.organizationId || user?.organization_id);
    const result = await pool.query(
      `SELECT id, name, email, phone, city, state, created_at FROM donors ${orgId ? 'WHERE organization_id = $1' : ''} ORDER BY created_at DESC LIMIT 100`,
      orgId ? [orgId] : []
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE segments SET status = 'approved', updated_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, organization_id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
