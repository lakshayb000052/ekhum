import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { 
  executeSegment, 
  snapshotCohort, 
  calculateCohortRetentionMatrix, 
  exportSegmentCSV, 
  SEGMENT_PRESETS 
} from '../services/segmentEngine';

const router = Router();

// GET /api/segments — List all audience segments & cohorts
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);

    let query = `
      SELECT 
        s.*,
        COALESCE(s.name, s.segment_name, 'Audience Segment') as name,
        COALESCE(s.segment_name, s.name, 'Audience Segment') as segment_name,
        (SELECT COUNT(*) FROM segment_snapshots ss WHERE ss.segment_id = s.id) as snapshot_count,
        o.name as organization_name
      FROM segments s
      LEFT JOIN organizations o ON s.organization_id = o.id
    `;
    const params: any[] = [];
    if (orgId && orgId !== 'all') {
      query += ' WHERE s.organization_id = $1';
      params.push(orgId);
    }
    query += ' ORDER BY s.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/segments/presets — Smart non-profit segment presets
router.get('/presets', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: SEGMENT_PRESETS });
});

// GET /api/segments/fields — Dictionary of all filterable dimensions
router.get('/fields', authenticate, (req: Request, res: Response) => {
  const fields = [
    { name: 'name', label: 'Donor Full Name', category: 'Contact Demographics', type: 'text' },
    { name: 'email', label: 'Email Address', category: 'Contact Demographics', type: 'email' },
    { name: 'phone', label: 'Mobile / Phone', category: 'Contact Demographics', type: 'phone' },
    { name: 'city', label: 'City', category: 'Contact Demographics', type: 'text' },
    { name: 'state', label: 'State / Province', category: 'Contact Demographics', type: 'text' },
    { name: 'zip_code', label: 'Postal PIN Code', category: 'Contact Demographics', type: 'text' },
    { name: 'tax_id', label: 'PAN Card Number', category: 'Contact Demographics', type: 'text' },
    { name: 'contact_status', label: 'Donor Status', category: 'Contact Demographics', type: 'picklist', options: ['donor', 'lead', 'recurring_donor', 'active_donor', 'lapsed', 'churned'] },
    { name: 'preferred_language', label: 'Preferred Language', category: 'Contact Demographics', type: 'picklist', options: ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'gu'] },
    { name: 'preferred_channel', label: 'Preferred Channel', category: 'Contact Demographics', type: 'picklist', options: ['whatsapp', 'email', 'both'] },
    
    { name: 'total_paid_amount', label: 'Lifetime Giving Total (₹)', category: 'Lifetime Giving', type: 'currency' },
    { name: 'total_gift_count_paid', label: 'Total Paid Gifts Count', category: 'Lifetime Giving', type: 'number' },
    { name: 'last_gift_amount_paid', label: 'Last Donation Amount (₹)', category: 'Lifetime Giving', type: 'currency' },
    { name: 'total_monthly_donations', label: 'Monthly Autopay Gifts Count', category: 'Lifetime Giving', type: 'number' },
    { name: 'total_onetime_donations', label: 'One-Time Gifts Count', category: 'Lifetime Giving', type: 'number' },
    
    { name: 'first_gift_date', label: 'First Donation Date (Acquisition)', category: 'Recency & Cohorts', type: 'date' },
    { name: 'last_gift_date', label: 'Last Donation Date', category: 'Recency & Cohorts', type: 'date' },
    { name: 'days_since_last_donation', label: 'Days Since Last Donation', category: 'Recency & Cohorts', type: 'number' },
    { name: 'rfm_tier', label: 'RFM Algorithmic Tier', category: 'Recency & Cohorts', type: 'picklist', options: ['Champions (VIP)', 'Loyal Supporters', 'Recent Donors', 'At Risk', 'Lapsed'] },
    
    { name: 'donated_amount_past_30d', label: 'Giving Total in Past 30 Days (₹)', category: 'Time Window Giving', type: 'currency' },
    { name: 'donated_amount_past_90d', label: 'Giving Total in Past 90 Days (₹)', category: 'Time Window Giving', type: 'currency' },
    { name: 'donated_amount_past_365d', label: 'Giving Total in Past 365 Days (₹)', category: 'Time Window Giving', type: 'currency' },
    { name: 'payment_gateway_used', label: 'Payment Gateway Used', category: 'Time Window Giving', type: 'picklist', options: ['razorpay', 'cashfree', 'stripe', 'payu'] },
    { name: 'payment_method_used', label: 'Payment Method Used', category: 'Time Window Giving', type: 'picklist', options: ['upi', 'card', 'netbanking', 'upi_autopay'] },
    
    { name: 'has_active_subscription', label: 'Has Active Monthly Subscription', category: 'Recurring Mandates', type: 'boolean' },
    { name: 'consecutive_failed_installments', label: 'Consecutive Failed Auto-Debits', category: 'Recurring Mandates', type: 'number' },
    { name: 'paused_subscription', label: 'Subscription Currently Paused', category: 'Recurring Mandates', type: 'boolean' },
    { name: 'has_registered_mandate', label: 'NPCI / UPI Mandate Registered', category: 'Recurring Mandates', type: 'boolean' },
    
    { name: 'has_valid_email', label: 'Has Deliverable Email Address', category: 'Channel & Compliance', type: 'boolean' },
    { name: 'has_valid_phone', label: 'Has Valid Mobile Phone', category: 'Channel & Compliance', type: 'boolean' },
    { name: 'has_valid_pan', label: 'Has Valid PAN Tax ID', category: 'Channel & Compliance', type: 'boolean' },
    { name: 'has_80g_receipt', label: 'Has 80G Statutory Receipt Issued', category: 'Channel & Compliance', type: 'boolean' }
  ];
  res.json({ success: true, data: fields });
});

// POST /api/segments/preview — Live ad-hoc preview without saving
router.post('/preview', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);

    const { rules_json, sql, query_rules, suppression_applied } = req.body;

    const evaluation = await executeSegment(
      orgId || null, 
      rules_json, 
      sql || query_rules, 
      100, 
      0, 
      suppression_applied !== false
    );

    res.json({ 
      success: true, 
      count: evaluation.count, 
      totalLtv: evaluation.totalLtv, 
      avgGift: evaluation.avgGift, 
      data: evaluation.rows 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/segments/:id — Get segment details and stats
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/segments — Create dynamic segment or cohort
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let organization_id = req.body.organization_id || user?.organizationId || user?.organization_id;
    if (!organization_id) {
      const orgLookup = await pool.query('SELECT id FROM organizations LIMIT 1');
      organization_id = orgLookup.rows[0]?.id;
    }

    const { name, segment_name, description, type, rules_json, query_rules, query_sql, cohort_criteria, suppression_applied } = req.body;
    const finalName = name || segment_name || 'New Audience Segment';

    // Compute live count and LTV
    const evaluation = await executeSegment(
      organization_id, 
      rules_json, 
      query_sql || query_rules, 
      10, 
      0, 
      suppression_applied !== false
    );

    const result = await pool.query(
      `INSERT INTO segments (
         organization_id, name, segment_name, description, type, 
         rules_json, query_sql, query_rules, cohort_criteria, 
         member_count, total_ltv, avg_gift_size, suppression_applied, 
         status, last_refreshed_at, created_at, updated_at
       ) 
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', NOW(), NOW(), NOW()) 
       RETURNING *`,
      [
        organization_id,
        finalName,
        description || '',
        type || 'dynamic',
        JSON.stringify(rules_json || { combinator: 'AND', rules: [] }),
        query_sql || null,
        query_rules || null,
        JSON.stringify(cohort_criteria || {}),
        evaluation.count,
        evaluation.totalLtv,
        evaluation.avgGift,
        suppression_applied !== false
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Audience segment created successfully!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/segments/:id — Update segment
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, segment_name, description, type, rules_json, query_rules, query_sql, cohort_criteria, suppression_applied } = req.body;
    const finalName = name || segment_name;

    const currentSeg = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (currentSeg.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    const orgId = currentSeg.rows[0].organization_id;

    // Recalculate
    const targetRules = rules_json !== undefined ? rules_json : currentSeg.rows[0].rules_json;
    const targetSql = query_sql || query_rules || currentSeg.rows[0].query_sql;
    const evaluation = await executeSegment(orgId, targetRules, targetSql, 10, 0, suppression_applied !== false);

    const result = await pool.query(
      `UPDATE segments 
       SET 
         name = COALESCE($1, name),
         segment_name = COALESCE($1, segment_name),
         description = COALESCE($2, description),
         type = COALESCE($3, type),
         rules_json = COALESCE($4, rules_json),
         query_sql = COALESCE($5, query_sql),
         query_rules = COALESCE($6, query_rules),
         cohort_criteria = COALESCE($7, cohort_criteria),
         member_count = $8,
         total_ltv = $9,
         avg_gift_size = $10,
         suppression_applied = COALESCE($11, suppression_applied),
         last_refreshed_at = NOW(),
         updated_at = NOW()
       WHERE id = $12 
       RETURNING *`,
      [
        finalName,
        description,
        type,
        rules_json ? JSON.stringify(rules_json) : null,
        query_sql,
        query_rules,
        cohort_criteria ? JSON.stringify(cohort_criteria) : null,
        evaluation.count,
        evaluation.totalLtv,
        evaluation.avgGift,
        suppression_applied,
        id
      ]
    );

    res.json({ success: true, data: result.rows[0], message: 'Segment updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/segments/:id/refresh — Force refresh member count & stats
router.post('/:id/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (segRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    
    const seg = segRes.rows[0];
    const evaluation = await executeSegment(seg.organization_id, seg.rules_json, seg.query_sql, 10, 0, seg.suppression_applied);

    const result = await pool.query(
      `UPDATE segments 
       SET member_count = $1, total_ltv = $2, avg_gift_size = $3, last_refreshed_at = NOW(), updated_at = NOW() 
       WHERE id = $4 RETURNING *`,
      [evaluation.count, evaluation.totalLtv, evaluation.avgGift, id]
    );

    res.json({ success: true, data: result.rows[0], message: `Refreshed: ${evaluation.count} active members.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/segments/:id/members — Paginated member listing
router.get('/:id/members', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (segRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });

    const seg = segRes.rows[0];
    const evaluation = await executeSegment(seg.organization_id, seg.rules_json, seg.query_sql, limit, offset, seg.suppression_applied);

    res.json({ 
      success: true, 
      data: evaluation.rows, 
      totalCount: evaluation.count,
      totalLtv: evaluation.totalLtv,
      page,
      limit
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/segments/:id/snapshot — Freeze current cohort members into a historical snapshot
router.post('/:id/snapshot', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;
    const snapshotTag = tag || `Snapshot-${new Date().toISOString().split('T')[0]}`;

    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (segRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });

    const seg = segRes.rows[0];
    const result = await snapshotCohort(seg.organization_id, id, snapshotTag);

    res.json({ 
      success: true, 
      message: `Frozen ${result.count} cohort members under snapshot tag "${result.tag}".`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/segments/:id/cohort-retention — Return cohort retention matrix from M0 to M12
router.get('/:id/cohort-retention', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (segRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });

    const seg = segRes.rows[0];
    const matrix = await calculateCohortRetentionMatrix(seg.organization_id, id);

    res.json({ success: true, data: matrix });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/segments/:id/export — Export CSV of matching donors
router.get('/:id/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const segRes = await pool.query('SELECT * FROM segments WHERE id = $1', [id]);
    if (segRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });

    const seg = segRes.rows[0];
    const csvContent = await exportSegmentCSV(seg.organization_id, id);
    const fileName = `segment_${(seg.name || 'audience').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/segments/:id — Delete segment
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM segment_snapshots WHERE segment_id = $1', [id]);
    const result = await pool.query('DELETE FROM segments WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, message: 'Segment deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/segments/:id/approve
router.put('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE segments SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
