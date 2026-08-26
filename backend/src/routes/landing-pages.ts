import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' ? (req.query.organizationId as string | undefined) : (user?.organizationId || user?.organization_id);
    const { campaign_id } = req.query;
    
    let query = 'SELECT * FROM landing_pages';
    const params: any[] = [];
    if (organization_id) {
      query += ' WHERE organization_id = $1';
      params.push(organization_id);
    }
    
    if (campaign_id) {
      query += params.length > 0 ? ' AND campaign_id = $2' : ' WHERE campaign_id = $1';
      params.push(campaign_id);
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/public/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await pool.query('SELECT * FROM landing_pages WHERE slug = $1 AND status = $2', [slug, 'published']);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Page not found' });
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' ? (req.body.organization_id || user?.organizationId || user?.organization_id) : (user?.organizationId || user?.organization_id);
    const { title, slug, campaign_id, content, status } = req.body;
    
    const result = await pool.query(
      `INSERT INTO landing_pages (organization_id, title, slug, campaign_id, content, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [organization_id, title, slug, campaign_id, content, status || 'draft']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.organizationId || user?.organization_id;
    const { id } = req.params;
    const { title, content, status } = req.body;
    
    const result = await pool.query(
      `UPDATE landing_pages SET title = COALESCE($1, title), content = COALESCE($2, content), status = COALESCE($3, status), updated_at = NOW() 
       WHERE id = $4 AND organization_id = $5 RETURNING *`,
      [title, content, status, id, organization_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Page not found' });
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticate, authorizeRole(['superadmin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM landing_pages WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Page not found' });
    
    res.json({ success: true, message: 'Landing page deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
