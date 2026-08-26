import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let result;
    if (user.role === 'superadmin') {
      result = await pool.query('SELECT * FROM broadcasts ORDER BY created_at DESC');
    } else {
      const orgId = user.organization_id || user.organizationId;
      result = await pool.query('SELECT * FROM broadcasts WHERE organization_id = $1 ORDER BY created_at DESC', [orgId]);
    }
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user.organization_id || user.organizationId;
    const { name, broadcast_name, segment_id, template_id, channel, scheduled_at } = req.body;
    const finalName = broadcast_name || name;
    
    const result = await pool.query(
      `INSERT INTO broadcasts (organization_id, broadcast_name, segment_id, template_id, channel, scheduled_at, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'draft') RETURNING *`,
      [orgId, finalName, segment_id, template_id, channel, scheduled_at]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, broadcast_name, scheduled_at } = req.body;
    const finalName = broadcast_name || name;
    
    const result = await pool.query(
      `UPDATE broadcasts SET broadcast_name = COALESCE($1, broadcast_name), scheduled_at = COALESCE($2, scheduled_at), updated_at = NOW() 
       WHERE id = $3 AND (organization_id = $4 OR $5 = 'superadmin') RETURNING *`,
      [finalName, scheduled_at, id, user.organization_id || user.organizationId, user.role]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/approve', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE broadcasts SET status = 'approved', updated_at = NOW() WHERE id = $1 AND (organization_id = $2 OR $3 = 'superadmin') RETURNING *`,
      [id, user.organization_id || user.organizationId, user.role]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE broadcasts SET status = 'sending', updated_at = NOW() WHERE id = $1 AND (organization_id = $2 OR $3 = 'superadmin') RETURNING *`,
      [id, user.organization_id || user.organizationId, user.role]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0], message: 'Broadcast execution started' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT sent_count, delivered_count, failed_count, opened_count, clicked_count, read_count 
       FROM broadcasts WHERE id = $1 AND (organization_id = $2 OR $3 = 'superadmin')`,
      [id, user.organization_id || user.organizationId, user.role]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/broadcasts/:id (Superadmin Only)
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
