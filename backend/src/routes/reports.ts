import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { 
  executeReport, 
  exportReportCSV, 
  REPORT_PRESETS, 
  ReportDefinition 
} from '../services/reportEngine';
import { getRegisteredObjects, getObjectFields } from '../services/schemaService';

const router = Router();

// GET /api/reports — List all saved custom reports and presets
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);

    let query = `
      SELECT 
        r.*,
        o.name as organization_name
      FROM reports r
      LEFT JOIN organizations o ON r.organization_id = o.id
    `;
    const params: any[] = [];
    if (orgId && orgId !== 'all') {
      query += ' WHERE (r.organization_id = $1 OR r.organization_id IS NULL)';
      params.push(orgId);
    }
    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/presets — Built-in Executive Non-Profit Report Templates
router.get('/presets', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: REPORT_PRESETS });
});

// GET /api/reports/schema — Dictionary of reporting entities, fields, and available aggregations
router.get('/schema', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);

    const objects = await getRegisteredObjects(orgId);
    const schemaDetails: Record<string, any> = {};

    for (const obj of objects) {
      const fields = await getObjectFields(obj.name, orgId);
      schemaDetails[obj.name] = {
        label: obj.label,
        icon: obj.icon,
        description: obj.description,
        fields: fields.map(f => ({
          name: f.name,
          label: f.label,
          type: f.type,
          isNumeric: ['currency', 'number'].includes(f.type),
          isDate: ['date', 'datetime'].includes(f.type)
        }))
      };
    }

    res.json({ 
      success: true, 
      data: {
        objects: schemaDetails,
        aggregationFunctions: [
          { fn: 'SUM', label: 'Sum (Total)', types: ['currency', 'number'] },
          { fn: 'COUNT', label: 'Count (Records)', types: ['all'] },
          { fn: 'AVG', label: 'Average (Mean)', types: ['currency', 'number'] },
          { fn: 'COUNT_DISTINCT', label: 'Unique Count (Distinct)', types: ['all'] },
          { fn: 'MIN', label: 'Minimum', types: ['currency', 'number', 'date'] },
          { fn: 'MAX', label: 'Maximum', types: ['currency', 'number', 'date'] }
        ],
        dateIntervals: [
          { value: 'day', label: 'Daily (By Day)' },
          { value: 'week', label: 'Weekly (By Week)' },
          { value: 'month', label: 'Monthly (By Month)' },
          { value: 'quarter', label: 'Quarterly (By Quarter)' },
          { value: 'year', label: 'Annual (By Year)' }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/reports/preview — Live ad-hoc report execution without saving
router.post('/preview', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);

    const reportDef: ReportDefinition = req.body;
    if (!reportDef.primary_object) {
      reportDef.primary_object = 'donations';
    }

    const evaluation = await executeReport(reportDef, orgId || null, 250, 0);

    res.json({
      success: true,
      report: evaluation.report,
      data: evaluation.data,
      rowCount: evaluation.rowCount,
      isGrouped: evaluation.isGrouped,
      summaryKpis: evaluation.summaryKpis,
      chartData: evaluation.chartData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/:id — Get report details
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

// POST /api/reports — Save custom report definition
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let organization_id = req.body.organization_id || user?.organizationId || user?.organization_id;
    if (!organization_id) {
      const orgLookup = await pool.query('SELECT id FROM organizations LIMIT 1');
      organization_id = orgLookup.rows[0]?.id;
    }

    const { 
      name, 
      description, 
      report_type, 
      primary_object, 
      columns, 
      filters, 
      group_by, 
      aggregations, 
      sort_by, 
      chart_type, 
      chart_config, 
      folder 
    } = req.body;

    const result = await pool.query(
      `INSERT INTO reports (
         organization_id, name, description, report_type, primary_object, 
         columns, filters, group_by, aggregations, sort_by, 
         chart_type, chart_config, folder, is_preset, last_run_at, created_at, updated_at
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, NOW(), NOW(), NOW()) 
       RETURNING *`,
      [
        organization_id,
        name || 'Untitled Report',
        description || '',
        report_type || 'tabular',
        primary_object || 'donations',
        JSON.stringify(columns || []),
        JSON.stringify(filters || []),
        JSON.stringify(group_by || []),
        JSON.stringify(aggregations || []),
        JSON.stringify(sort_by || []),
        chart_type || 'none',
        JSON.stringify(chart_config || {}),
        folder || 'Custom Reports'
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Report definition saved successfully!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/reports/:id — Update report definition
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      report_type, 
      primary_object, 
      columns, 
      filters, 
      group_by, 
      aggregations, 
      sort_by, 
      chart_type, 
      chart_config, 
      folder 
    } = req.body;

    const result = await pool.query(
      `UPDATE reports 
       SET 
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         report_type = COALESCE($3, report_type),
         primary_object = COALESCE($4, primary_object),
         columns = COALESCE($5, columns),
         filters = COALESCE($6, filters),
         group_by = COALESCE($7, group_by),
         aggregations = COALESCE($8, aggregations),
         sort_by = COALESCE($9, sort_by),
         chart_type = COALESCE($10, chart_type),
         chart_config = COALESCE($11, chart_config),
         folder = COALESCE($12, folder),
         updated_at = NOW()
       WHERE id = $13 
       RETURNING *`,
      [
        name,
        description,
        report_type,
        primary_object,
        columns ? JSON.stringify(columns) : null,
        filters ? JSON.stringify(filters) : null,
        group_by ? JSON.stringify(group_by) : null,
        aggregations ? JSON.stringify(aggregations) : null,
        sort_by ? JSON.stringify(sort_by) : null,
        chart_type,
        chart_config ? JSON.stringify(chart_config) : null,
        folder,
        id
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: result.rows[0], message: 'Report updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/reports/:id/run — Run saved report
router.post('/:id/run', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reportRes = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });

    const reportRow = reportRes.rows[0];
    const reportDef: ReportDefinition = {
      id: reportRow.id,
      name: reportRow.name,
      description: reportRow.description,
      report_type: reportRow.report_type,
      primary_object: reportRow.primary_object,
      columns: reportRow.columns,
      filters: reportRow.filters,
      group_by: reportRow.group_by,
      aggregations: reportRow.aggregations,
      sort_by: reportRow.sort_by,
      chart_type: reportRow.chart_type,
      chart_config: reportRow.chart_config
    };

    const evaluation = await executeReport(reportDef, reportRow.organization_id, 500, 0);

    // Update last_run_at and row_count
    await pool.query('UPDATE reports SET last_run_at = NOW(), row_count = $1 WHERE id = $2', [evaluation.rowCount, id]);

    res.json({
      success: true,
      report: reportDef,
      data: evaluation.data,
      rowCount: evaluation.rowCount,
      isGrouped: evaluation.isGrouped,
      summaryKpis: evaluation.summaryKpis,
      chartData: evaluation.chartData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/:id/export — Export CSV
router.get('/:id/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reportRes = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });

    const reportRow = reportRes.rows[0];
    const reportDef: ReportDefinition = {
      id: reportRow.id,
      name: reportRow.name,
      description: reportRow.description,
      report_type: reportRow.report_type,
      primary_object: reportRow.primary_object,
      columns: reportRow.columns,
      filters: reportRow.filters,
      group_by: reportRow.group_by,
      aggregations: reportRow.aggregations,
      sort_by: reportRow.sort_by,
      chart_type: reportRow.chart_type,
      chart_config: reportRow.chart_config
    };

    const evaluation = await executeReport(reportDef, reportRow.organization_id, 50000, 0);
    const csvContent = exportReportCSV(evaluation.data, reportRow.columns);
    const fileName = `report_${reportRow.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/reports/:id — Delete report
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
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
