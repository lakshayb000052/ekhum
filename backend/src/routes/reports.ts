import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    
    let query = 'SELECT * FROM reports';
    const params: any[] = [];
    if (organization_id) {
      query += ' WHERE organization_id = $1';
      params.push(organization_id);
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
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);
    const { name, description, report_type, primary_object, columns, filters, group_by, sort_by, chart_type } = req.body;
    
    const result = await pool.query(
      `INSERT INTO reports (
        organization_id, name, description, report_type, primary_object, 
        columns, filters, group_by, sort_by, chart_type, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
      [
        organization_id, 
        name, 
        description || '', 
        report_type || 'tabular', 
        primary_object || 'donations',
        JSON.stringify(columns || []), 
        JSON.stringify(filters || []), 
        JSON.stringify(group_by || []), 
        JSON.stringify(sort_by || []),
        chart_type || null
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/run', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reportRes = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });
    
    const report = reportRes.rows[0];
    const table = report.primary_object === 'contacts' ? 'donors' : (report.primary_object || 'donations');
    
    // Run bounded query
    const dataRes = await pool.query(`SELECT * FROM ${table} WHERE 1=1 ORDER BY created_at DESC LIMIT 500`);
    
    await pool.query('UPDATE reports SET last_run_at = NOW() WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      report, 
      data: dataRes.rows, 
      rowCount: dataRes.rowCount 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticate, authorizeRole(['superadmin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
