import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const result = await pool.query('SELECT * FROM dashboards WHERE organization_id = $1 ORDER BY created_at DESC', [organization_id]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const { name, layout } = req.body;
    
    const result = await pool.query(
      `INSERT INTO dashboards (organization_id, name, layout) VALUES ($1, $2, $3) RETURNING *`,
      [organization_id, name, layout]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const { id } = req.params;
    const { name, layout } = req.body;
    
    const result = await pool.query(
      `UPDATE dashboards SET name = COALESCE($1, name), layout = COALESCE($2, layout), updated_at = NOW() 
       WHERE id = $3 AND organization_id = $4 RETURNING *`,
      [name, layout, id, organization_id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Dashboard not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM dashboards WHERE id = $1 AND organization_id = $2', [id, organization_id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Dashboard not found' });
    
    const widgetsResult = await pool.query('SELECT * FROM dashboard_widgets WHERE dashboard_id = $1', [id]);
    
    res.json({ success: true, data: { ...result.rows[0], widgets: widgetsResult.rows } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/widgets', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, config, position } = req.body;
    
    const result = await pool.query(
      `INSERT INTO dashboard_widgets (dashboard_id, type, config, position) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, type, config, position]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/widgets/:widgetId', authenticate, async (req: Request, res: Response) => {
  try {
    const { widgetId } = req.params;
    const { config, position } = req.body;
    
    const result = await pool.query(
      `UPDATE dashboard_widgets SET config = COALESCE($1, config), position = COALESCE($2, position), updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [config, position, widgetId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/widgets/:widgetId', authenticate, async (req: Request, res: Response) => {
  try {
    const { widgetId } = req.params;
    await pool.query('DELETE FROM dashboard_widgets WHERE id = $1', [widgetId]);
    res.json({ success: true, message: 'Widget removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
