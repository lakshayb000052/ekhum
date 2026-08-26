import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { landing_page_id, visitor_id, utm_source, utm_medium, utm_campaign } = req.body;
    
    const result = await pool.query(
      `INSERT INTO sessions (landing_page_id, visitor_id, utm_source, utm_medium, utm_campaign, status) 
       VALUES ($1, $2, $3, $4, $5, 'visited') RETURNING *`,
      [landing_page_id, visitor_id, utm_source, utm_medium, utm_campaign]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, time_spent } = req.body;
    
    const result = await pool.query(
      `UPDATE sessions SET status = COALESCE($1, status), time_spent = COALESCE($2, time_spent), updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [status, time_spent, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Session not found' });
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const { landing_page_id } = req.query;
    
    const result = await pool.query(
      `SELECT status, COUNT(*) as count FROM sessions 
       JOIN landing_pages ON sessions.landing_page_id = landing_pages.id
       WHERE landing_pages.organization_id = $1 AND ($2::uuid IS NULL OR sessions.landing_page_id = $2::uuid)
       GROUP BY status`,
      [organization_id, landing_page_id || null]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
