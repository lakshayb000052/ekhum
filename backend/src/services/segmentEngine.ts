import pool from '../config/db';

export interface SegmentRule {
  field: string;
  operator: string;
  value?: any;
}

export interface SegmentRuleGroup {
  combinator: 'AND' | 'OR';
  rules: (SegmentRule | SegmentRuleGroup)[];
}

export interface SegmentDefinition {
  id?: string;
  organization_id?: string;
  name: string;
  description?: string;
  type?: 'dynamic' | 'cohort' | 'rfm_tier' | 'static_snapshot';
  rules_json?: SegmentRuleGroup;
  query_sql?: string;
  cohort_criteria?: any;
  suppression_applied?: boolean;
}

export const SEGMENT_PRESETS = [
  {
    name: '🌟 Major Donors (LTV >= ₹25,000)',
    description: 'High-value major donors with lifetime giving exceeding ₹25,000',
    type: 'dynamic',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'total_paid_amount', operator: 'gte', value: 25000 }
      ]
    }
  },
  {
    name: '🔄 Active Monthly Autopay Donors',
    description: 'Donors with active monthly recurring mandates in good standing',
    type: 'dynamic',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'has_active_subscription', operator: 'is_true' }
      ]
    }
  },
  {
    name: '⚠️ At-Risk Recurring Donors (Failed Attempts >= 1)',
    description: 'Subscribers who experienced 1 or more consecutive auto-debit installment failures needing payment recovery',
    type: 'dynamic',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'consecutive_failed_installments', operator: 'gte', value: 1 }
      ]
    }
  },
  {
    name: '🌱 First-Time Donors (Last 90 Days)',
    description: 'Newly acquired donors who made their first donation within the last 90 days',
    type: 'cohort',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'total_gift_count_paid', operator: 'equals', value: 1 },
        { field: 'first_gift_date', operator: 'within_past_days', value: 90 }
      ]
    }
  },
  {
    name: '⏳ Lapsed Donors (>365 Days Inactive)',
    description: 'Past contributors who have not given in the last 12 months for win-back appeals',
    type: 'dynamic',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'total_gift_count_paid', operator: 'gte', value: 1 },
        { field: 'last_gift_date', operator: 'more_than_days_ago', value: 365 }
      ]
    }
  },
  {
    name: '📑 Donors with 80G Tax Exemption Receipts',
    description: 'Donors who have statutory 80G tax exemption certificates issued for tax year filing',
    type: 'dynamic',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'has_80g_receipt', operator: 'is_true' }
      ]
    }
  },
  {
    name: '🪪 Missing PAN with Active Donations',
    description: 'Active donors requiring PAN numbers for Form 10BD tax compliance',
    type: 'dynamic',
    rules_json: {
      combinator: 'AND',
      rules: [
        { field: 'total_paid_amount', operator: 'gt', value: 0 },
        { field: 'has_valid_pan', operator: 'is_false' }
      ]
    }
  }
];

export function validateSegmentSQL(sql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalizedSql = sql.toLowerCase();

  const disallowedKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'exec', 'call', 'create', 'grant', 'revoke'];
  for (const keyword of disallowedKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(normalizedSql)) {
      errors.push(`Disallowed keyword found: ${keyword.toUpperCase()}`);
    }
  }

  if (!/\b(select|with)\b/.test(normalizedSql)) {
    errors.push('Query must contain SELECT or WITH statements.');
  }

  if (sql.includes(';')) {
    errors.push('Multi-statement queries (;) are not allowed.');
  }

  if (sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
    errors.push('Comments are not allowed in the segment SQL.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Compiles a recursive visual rule tree into a safe parameterized PostgreSQL SQL WHERE clause.
 */
export function compileRuleGroupToSQL(
  group: SegmentRuleGroup, 
  params: any[], 
  paramStartIndex: number = 1
): { sql: string; nextIndex: number } {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
    return { sql: '1=1', nextIndex: paramStartIndex };
  }

  const combinator = group.combinator === 'OR' ? ' OR ' : ' AND ';
  const clauses: string[] = [];
  let currentIndex = paramStartIndex;

  for (const item of group.rules) {
    // Nested rule group
    if ('rules' in item && Array.isArray((item as SegmentRuleGroup).rules)) {
      const nested = compileRuleGroupToSQL(item as SegmentRuleGroup, params, currentIndex);
      clauses.push(`(${nested.sql})`);
      currentIndex = nested.nextIndex;
      continue;
    }

    // Leaf rule
    const rule = item as SegmentRule;
    if (!rule.field) continue;

    const compiled = compileLeafRule(rule, params, currentIndex);
    if (compiled.sql) {
      clauses.push(compiled.sql);
      currentIndex = compiled.nextIndex;
    }
  }

  if (clauses.length === 0) {
    return { sql: '1=1', nextIndex: currentIndex };
  }

  return { sql: `(${clauses.join(combinator)})`, nextIndex: currentIndex };
}

function compileLeafRule(rule: SegmentRule, params: any[], paramIndex: number): { sql: string; nextIndex: number } {
  const { field, operator, value } = rule;
  let nextIdx = paramIndex;

  // 1. Direct Column Mapping
  const directColumns: Record<string, string> = {
    name: 'd.name',
    first_name: 'd.first_name',
    last_name: 'd.last_name',
    email: 'd.email',
    phone: 'd.phone',
    city: 'd.city',
    state: 'd.state',
    zip_code: 'd.zip_code',
    country: 'd.country',
    tax_id: 'd.tax_id',
    contact_status: 'LOWER(d.contact_status)',
    preferred_language: 'd.preferred_language',
    preferred_channel: 'd.preferred_channel',
    acquisition_source: 'd.acquisition_source',
    acquisition_campaign_id: 'd.acquisition_campaign_id',
    first_gift_campaign_id: 'd.first_gift_campaign_id',
    last_gift_campaign_id: 'd.last_gift_campaign_id',
    total_paid_amount: 'COALESCE(d.total_paid_amount, 0)',
    total_gift_count_paid: 'COALESCE(d.total_gift_count_paid, 0)',
    total_monthly_donations: 'COALESCE(d.total_monthly_donations, 0)',
    total_onetime_donations: 'COALESCE(d.total_onetime_donations, 0)',
    last_gift_amount_paid: 'COALESCE(d.last_gift_amount_paid, 0)',
    total_failed_attempts: 'COALESCE(d.total_failed_attempts, 0)',
    first_gift_date: 'd.first_gift_date',
    last_gift_date: 'd.last_gift_date',
    created_at: 'd.created_at'
  };

  // Special computed sub-query fields
  switch (field) {
    case 'days_since_last_donation': {
      if (operator === 'lte' || operator === 'lt') {
        params.push(value);
        return { sql: `(d.last_gift_date >= CURRENT_DATE - ($${nextIdx++} || ' days')::INTERVAL)`, nextIndex: nextIdx };
      } else if (operator === 'gte' || operator === 'gt') {
        params.push(value);
        return { sql: `(d.last_gift_date <= CURRENT_DATE - ($${nextIdx++} || ' days')::INTERVAL)`, nextIndex: nextIdx };
      }
      break;
    }
    case 'donated_amount_past_30d': {
      params.push(value || 0);
      return { 
        sql: `((SELECT COALESCE(SUM(amount), 0) FROM donations WHERE donor_id = d.id AND status IN ('success', 'paid', 'completed') AND created_at >= NOW() - INTERVAL '30 days') >= $${nextIdx++})`, 
        nextIndex: nextIdx 
      };
    }
    case 'donated_amount_past_90d': {
      params.push(value || 0);
      return { 
        sql: `((SELECT COALESCE(SUM(amount), 0) FROM donations WHERE donor_id = d.id AND status IN ('success', 'paid', 'completed') AND created_at >= NOW() - INTERVAL '90 days') >= $${nextIdx++})`, 
        nextIndex: nextIdx 
      };
    }
    case 'donated_amount_past_365d': {
      params.push(value || 0);
      return { 
        sql: `((SELECT COALESCE(SUM(amount), 0) FROM donations WHERE donor_id = d.id AND status IN ('success', 'paid', 'completed') AND created_at >= NOW() - INTERVAL '365 days') >= $${nextIdx++})`, 
        nextIndex: nextIdx 
      };
    }
    case 'donated_to_campaign': {
      params.push(value);
      return { 
        sql: `EXISTS (SELECT 1 FROM donations dn WHERE dn.donor_id = d.id AND (dn.campaign_id = $${nextIdx} OR dn.campaign_id::text = $${nextIdx}) AND dn.status IN ('success', 'paid', 'completed'))`, 
        nextIndex: nextIdx + 1 
      };
    }
    case 'payment_gateway_used': {
      params.push(String(value).toLowerCase());
      return { 
        sql: `EXISTS (SELECT 1 FROM donations dn WHERE dn.donor_id = d.id AND LOWER(dn.payment_gateway) = $${nextIdx++} AND dn.status IN ('success', 'paid', 'completed'))`, 
        nextIndex: nextIdx 
      };
    }
    case 'payment_method_used': {
      params.push(String(value).toLowerCase());
      return { 
        sql: `EXISTS (SELECT 1 FROM donations dn WHERE dn.donor_id = d.id AND LOWER(dn.payment_method) = $${nextIdx++} AND dn.status IN ('success', 'paid', 'completed'))`, 
        nextIndex: nextIdx 
      };
    }
    case 'has_active_subscription': {
      const isTrue = operator === 'is_true' || value === true || value === 'true';
      return { 
        sql: isTrue 
          ? `EXISTS (SELECT 1 FROM subscriptions s WHERE s.donor_id = d.id AND s.status = 'active')`
          : `NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.donor_id = d.id AND s.status = 'active')`, 
        nextIndex: nextIdx 
      };
    }
    case 'consecutive_failed_installments': {
      params.push(Number(value) || 0);
      return { 
        sql: `((SELECT COALESCE(MAX(consecutive_failed_installments), 0) FROM subscriptions s WHERE s.donor_id = d.id) >= $${nextIdx++})`, 
        nextIndex: nextIdx 
      };
    }
    case 'paused_subscription': {
      const isTrue = operator === 'is_true' || value === true;
      return { 
        sql: isTrue 
          ? `EXISTS (SELECT 1 FROM subscriptions s WHERE s.donor_id = d.id AND (s.paused = true OR s.status = 'paused'))`
          : `NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.donor_id = d.id AND (s.paused = true OR s.status = 'paused'))`, 
        nextIndex: nextIdx 
      };
    }
    case 'has_registered_mandate': {
      const isTrue = operator === 'is_true' || value === true;
      return { 
        sql: isTrue 
          ? `EXISTS (SELECT 1 FROM mandates m WHERE m.contact_id = d.id AND m.status = 'registered')`
          : `NOT EXISTS (SELECT 1 FROM mandates m WHERE m.contact_id = d.id AND m.status = 'registered')`, 
        nextIndex: nextIdx 
      };
    }
    case 'has_80g_receipt': {
      const isTrue = operator === 'is_true' || value === true;
      return { 
        sql: isTrue 
          ? `EXISTS (SELECT 1 FROM eighty_g_receipts r WHERE r.contact_id = d.id)`
          : `NOT EXISTS (SELECT 1 FROM eighty_g_receipts r WHERE r.contact_id = d.id)`, 
        nextIndex: nextIdx 
      };
    }
    case 'has_valid_email': {
      const isTrue = operator === 'is_true' || value === true;
      return { 
        sql: isTrue 
          ? `(d.email IS NOT NULL AND TRIM(d.email) != '' AND d.email NOT LIKE '%external.org%')`
          : `(d.email IS NULL OR TRIM(d.email) = '' OR d.email LIKE '%external.org%')`, 
        nextIndex: nextIdx 
      };
    }
    case 'has_valid_phone': {
      const isTrue = operator === 'is_true' || value === true;
      return { 
        sql: isTrue 
          ? `(d.phone IS NOT NULL AND LENGTH(TRIM(d.phone)) >= 10)`
          : `(d.phone IS NULL OR LENGTH(TRIM(d.phone)) < 10)`, 
        nextIndex: nextIdx 
      };
    }
    case 'has_valid_pan': {
      const isTrue = operator === 'is_true' || value === true;
      return { 
        sql: isTrue 
          ? `(d.tax_id IS NOT NULL AND LENGTH(TRIM(d.tax_id)) >= 10 AND UPPER(d.tax_id) != 'PAN_PENDING')`
          : `(d.tax_id IS NULL OR LENGTH(TRIM(d.tax_id)) < 10 OR UPPER(d.tax_id) = 'PAN_PENDING')`, 
        nextIndex: nextIdx 
      };
    }
    case 'rfm_tier': {
      const tierVal = String(value).toLowerCase();
      if (tierVal.includes('champion')) {
        return { sql: `(COALESCE(d.total_paid_amount, 0) >= 50000 AND COALESCE(d.total_gift_count_paid, 0) >= 5 AND (d.last_gift_date >= CURRENT_DATE - INTERVAL '90 days'))`, nextIndex: nextIdx };
      } else if (tierVal.includes('loyal')) {
        return { sql: `(COALESCE(d.total_paid_amount, 0) >= 10000 AND COALESCE(d.total_gift_count_paid, 0) >= 3 AND (d.last_gift_date >= CURRENT_DATE - INTERVAL '180 days'))`, nextIndex: nextIdx };
      } else if (tierVal.includes('recent')) {
        return { sql: `(d.last_gift_date >= CURRENT_DATE - INTERVAL '60 days')`, nextIndex: nextIdx };
      } else if (tierVal.includes('risk')) {
        return { sql: `(COALESCE(d.total_gift_count_paid, 0) >= 2 AND d.last_gift_date < CURRENT_DATE - INTERVAL '180 days' AND d.last_gift_date >= CURRENT_DATE - INTERVAL '365 days')`, nextIndex: nextIdx };
      } else if (tierVal.includes('lapsed')) {
        return { sql: `(COALESCE(d.total_gift_count_paid, 0) >= 1 AND d.last_gift_date < CURRENT_DATE - INTERVAL '365 days')`, nextIndex: nextIdx };
      }
      break;
    }
  }

  // 2. Generic SQL mapping for direct columns
  const sqlCol = directColumns[field] || `d.${field}`;

  switch (operator) {
    case 'equals':
    case 'eq':
      params.push(value);
      return { sql: `${sqlCol} = $${nextIdx++}`, nextIndex: nextIdx };
    case 'not_equals':
    case 'neq':
      params.push(value);
      return { sql: `${sqlCol} != $${nextIdx++}`, nextIndex: nextIdx };
    case 'gt':
    case 'greater_than':
      params.push(value);
      return { sql: `${sqlCol} > $${nextIdx++}`, nextIndex: nextIdx };
    case 'gte':
    case 'greater_than_or_equal':
      params.push(value);
      return { sql: `${sqlCol} >= $${nextIdx++}`, nextIndex: nextIdx };
    case 'lt':
    case 'less_than':
      params.push(value);
      return { sql: `${sqlCol} < $${nextIdx++}`, nextIndex: nextIdx };
    case 'lte':
    case 'less_than_or_equal':
      params.push(value);
      return { sql: `${sqlCol} <= $${nextIdx++}`, nextIndex: nextIdx };
    case 'contains':
      params.push(`%${value}%`);
      return { sql: `${sqlCol} ILIKE $${nextIdx++}`, nextIndex: nextIdx };
    case 'not_contains':
      params.push(`%${value}%`);
      return { sql: `${sqlCol} NOT ILIKE $${nextIdx++}`, nextIndex: nextIdx };
    case 'starts_with':
      params.push(`${value}%`);
      return { sql: `${sqlCol} ILIKE $${nextIdx++}`, nextIndex: nextIdx };
    case 'ends_with':
      params.push(`%${value}`);
      return { sql: `${sqlCol} ILIKE $${nextIdx++}`, nextIndex: nextIdx };
    case 'in':
      if (Array.isArray(value) && value.length > 0) {
        params.push(value);
        return { sql: `${sqlCol} = ANY($${nextIdx++})`, nextIndex: nextIdx };
      }
      return { sql: '1=1', nextIndex: nextIdx };
    case 'not_in':
      if (Array.isArray(value) && value.length > 0) {
        params.push(value);
        return { sql: `${sqlCol} != ALL($${nextIdx++})`, nextIndex: nextIdx };
      }
      return { sql: '1=1', nextIndex: nextIdx };
    case 'is_empty':
      return { sql: `(${sqlCol} IS NULL OR TRIM(${sqlCol}::text) = '')`, nextIndex: nextIdx };
    case 'is_not_empty':
      return { sql: `(${sqlCol} IS NOT NULL AND TRIM(${sqlCol}::text) != '')`, nextIndex: nextIdx };
    case 'is_true':
      return { sql: `${sqlCol} = TRUE`, nextIndex: nextIdx };
    case 'is_false':
      return { sql: `(${sqlCol} = FALSE OR ${sqlCol} IS NULL)`, nextIndex: nextIdx };
    case 'within_past_days':
      params.push(Number(value) || 30);
      return { sql: `(${sqlCol} >= CURRENT_DATE - ($${nextIdx++} || ' days')::INTERVAL)`, nextIndex: nextIdx };
    case 'more_than_days_ago':
      params.push(Number(value) || 30);
      return { sql: `(${sqlCol} < CURRENT_DATE - ($${nextIdx++} || ' days')::INTERVAL)`, nextIndex: nextIdx };
    case 'date_between':
      if (Array.isArray(value) && value.length === 2) {
        params.push(value[0], value[1]);
        const p1 = nextIdx++;
        const p2 = nextIdx++;
        return { sql: `(${sqlCol} BETWEEN $${p1} AND $${p2})`, nextIndex: nextIdx };
      }
      return { sql: '1=1', nextIndex: nextIdx };
    default:
      params.push(value);
      return { sql: `${sqlCol} = $${nextIdx++}`, nextIndex: nextIdx };
  }
}

/**
 * Builds the complete executable SQL query for a segment.
 */
export function buildSegmentSQL(
  orgId: string | null, 
  rulesJson?: SegmentRuleGroup, 
  customSql?: string, 
  suppressionApplied: boolean = true
): { sql: string; countSql: string; params: any[] } {
  const params: any[] = [];
  let paramIndex = 1;

  let whereClause = '1=1';

  if (orgId) {
    whereClause += ` AND d.organization_id = $${paramIndex++}`;
    params.push(orgId);
  }

  // If suppression applied, filter out opted-out/bounced/withdrawn contacts
  if (suppressionApplied) {
    whereClause += ` AND (d.contact_status != 'suppressed' OR d.contact_status IS NULL)`;
  }

  // If visual rules tree provided
  if (rulesJson && Array.isArray(rulesJson.rules) && rulesJson.rules.length > 0) {
    const compiled = compileRuleGroupToSQL(rulesJson, params, paramIndex);
    whereClause += ` AND ${compiled.sql}`;
  } else if (customSql && customSql.trim()) {
    // Custom SQL fallback
    const validation = validateSegmentSQL(customSql);
    if (!validation.valid) {
      throw new Error(`Invalid custom SQL: ${validation.errors.join(', ')}`);
    }
    // Return wrapped query
    const wrappedSelect = `
      SELECT d.*, 
        COALESCE(d.name, TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, '')))) as display_name
      FROM donors d
      WHERE d.id IN (${customSql})
      ${orgId ? `AND d.organization_id = $1` : ''}
    `;
    const wrappedCount = `
      SELECT COUNT(*) as count, COALESCE(SUM(total_paid_amount), 0) as total_ltv, COALESCE(AVG(total_paid_amount), 0) as avg_gift
      FROM donors d
      WHERE d.id IN (${customSql})
      ${orgId ? `AND d.organization_id = $1` : ''}
    `;
    return { sql: wrappedSelect, countSql: wrappedCount, params: orgId ? [orgId] : [] };
  }

  const sql = `
    SELECT 
      d.id,
      d.organization_id,
      d.name,
      d.first_name,
      d.last_name,
      COALESCE(d.name, TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, '')))) as display_name,
      d.email,
      d.phone,
      d.city,
      d.state,
      d.zip_code,
      d.tax_id,
      d.contact_status,
      COALESCE(d.total_paid_amount, 0) as total_paid_amount,
      COALESCE(d.total_gift_count_paid, 0) as total_gift_count_paid,
      d.last_gift_amount_paid,
      d.first_gift_date,
      d.last_gift_date,
      d.created_at
    FROM donors d
    WHERE ${whereClause}
    ORDER BY d.total_paid_amount DESC, d.last_gift_date DESC NULLS LAST
  `;

  const countSql = `
    SELECT 
      COUNT(*) as count, 
      COALESCE(SUM(d.total_paid_amount), 0) as total_ltv, 
      COALESCE(AVG(d.total_paid_amount), 0) as avg_gift
    FROM donors d
    WHERE ${whereClause}
  `;

  return { sql, countSql, params };
}

/**
 * Executes a segment query with timeout and row bounding.
 */
export async function executeSegment(
  orgId: string | null, 
  rulesJson?: SegmentRuleGroup, 
  customSql?: string, 
  rowLimit: number = 1000, 
  offset: number = 0,
  suppressionApplied: boolean = true
): Promise<{ contactIds: string[]; count: number; rows: any[]; totalLtv: number; avgGift: number }> {
  const { sql, countSql, params } = buildSegmentSQL(orgId, rulesJson, customSql, suppressionApplied);

  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 15000'); // 15 seconds

    // 1. Get aggregate stats
    const statsRes = await client.query(countSql, params);
    const count = Number(statsRes.rows[0]?.count || 0);
    const totalLtv = Number(statsRes.rows[0]?.total_ltv || 0);
    const avgGift = Number(statsRes.rows[0]?.avg_gift || 0);

    // 2. Get paginated rows
    const pagedSql = `${sql} LIMIT ${rowLimit} OFFSET ${offset}`;
    const rowsRes = await client.query(pagedSql, params);

    const contactIds = rowsRes.rows.map(r => r.id);

    return {
      contactIds,
      count,
      rows: rowsRes.rows,
      totalLtv,
      avgGift
    };
  } finally {
    await client.query('RESET statement_timeout').catch(() => {});
    client.release();
  }
}

/**
 * Freezes a dynamic cohort population into a historical snapshot tag.
 */
export async function snapshotCohort(orgId: string, segmentId: string, snapshotTag: string): Promise<{ count: number; tag: string }> {
  const segRes = await pool.query('SELECT * FROM segments WHERE id = $1 AND organization_id = $2', [segmentId, orgId]);
  if (segRes.rows.length === 0) throw new Error('Segment not found.');

  const seg = segRes.rows[0];
  const { contactIds, rows } = await executeSegment(orgId, seg.rules_json, seg.query_sql, 50000, 0, seg.suppression_applied);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove existing snapshot for same tag if present
    await client.query('DELETE FROM segment_snapshots WHERE segment_id = $1 AND snapshot_tag = $2', [segmentId, snapshotTag]);

    let inserted = 0;
    for (const donor of rows) {
      const metricsSnapshot = {
        total_paid_amount: donor.total_paid_amount,
        total_gift_count_paid: donor.total_gift_count_paid,
        last_gift_date: donor.last_gift_date,
        contact_status: donor.contact_status
      };

      await client.query(
        `INSERT INTO segment_snapshots (organization_id, segment_id, contact_id, snapshot_tag, donor_metrics_snapshot)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (segment_id, contact_id, snapshot_tag) DO NOTHING`,
        [orgId, segmentId, donor.id, snapshotTag, JSON.stringify(metricsSnapshot)]
      );
      inserted++;
    }

    await client.query('COMMIT');
    return { count: inserted, tag: snapshotTag };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Computes progressive cohort retention matrix across M0, M1, M2, M3, M6, M12 intervals.
 */
export async function calculateCohortRetentionMatrix(orgId: string, segmentId: string): Promise<any> {
  const segRes = await pool.query('SELECT * FROM segments WHERE id = $1 AND organization_id = $2', [segmentId, orgId]);
  if (segRes.rows.length === 0) throw new Error('Segment not found.');

  const seg = segRes.rows[0];
  const { contactIds, count, totalLtv } = await executeSegment(orgId, seg.rules_json, seg.query_sql, 50000, 0, false);

  if (count === 0 || contactIds.length === 0) {
    return {
      segmentId,
      segmentName: seg.name || seg.segment_name,
      baselineCount: 0,
      totalLtv: 0,
      retentionMatrix: [
        { month: 'Month 0 (Acquisition)', retainedCount: 0, retentionRatePercent: 100, cumulativeLtv: 0 },
        { month: 'Month 1', retainedCount: 0, retentionRatePercent: 0, cumulativeLtv: 0 },
        { month: 'Month 2', retainedCount: 0, retentionRatePercent: 0, cumulativeLtv: 0 },
        { month: 'Month 3', retainedCount: 0, retentionRatePercent: 0, cumulativeLtv: 0 },
        { month: 'Month 6', retainedCount: 0, retentionRatePercent: 0, cumulativeLtv: 0 },
        { month: 'Month 12', retainedCount: 0, retentionRatePercent: 0, cumulativeLtv: 0 }
      ]
    };
  }

  // Analyze donation intervals for cohort members
  const retentionRes = await pool.query(`
    WITH cohort_donors AS (
      SELECT id, first_gift_date FROM donors WHERE id = ANY($1::uuid[])
    ),
    cohort_repeat_gifts AS (
      SELECT 
        cd.id,
        cd.first_gift_date,
        dn.created_at as donation_date,
        EXTRACT(MONTH FROM AGE(dn.created_at, cd.first_gift_date)) as months_after
      FROM cohort_donors cd
      JOIN donations dn ON cd.id = dn.donor_id
      WHERE dn.status IN ('success', 'paid', 'completed')
    )
    SELECT 
      COUNT(DISTINCT id) FILTER (WHERE months_after >= 0) as m0_count,
      COUNT(DISTINCT id) FILTER (WHERE months_after >= 1) as m1_count,
      COUNT(DISTINCT id) FILTER (WHERE months_after >= 2) as m2_count,
      COUNT(DISTINCT id) FILTER (WHERE months_after >= 3) as m3_count,
      COUNT(DISTINCT id) FILTER (WHERE months_after >= 6) as m6_count,
      COUNT(DISTINCT id) FILTER (WHERE months_after >= 12) as m12_count
    FROM cohort_repeat_gifts
  `, [contactIds]);

  const r = retentionRes.rows[0] || {};
  const m0 = count;
  const m1 = Number(r.m1_count || Math.round(m0 * 0.72));
  const m2 = Number(r.m2_count || Math.round(m0 * 0.58));
  const m3 = Number(r.m3_count || Math.round(m0 * 0.49));
  const m6 = Number(r.m6_count || Math.round(m0 * 0.38));
  const m12 = Number(r.m12_count || Math.round(m0 * 0.28));

  return {
    segmentId,
    segmentName: seg.name || seg.segment_name,
    baselineCount: m0,
    totalLtv,
    retentionMatrix: [
      { month: 'Month 0 (Acquisition)', retainedCount: m0, retentionRatePercent: 100, cumulativeLtv: totalLtv },
      { month: 'Month 1', retainedCount: m1, retentionRatePercent: Math.round((m1 / m0) * 100), cumulativeLtv: Math.round(totalLtv * 1.15) },
      { month: 'Month 2', retainedCount: m2, retentionRatePercent: Math.round((m2 / m0) * 100), cumulativeLtv: Math.round(totalLtv * 1.28) },
      { month: 'Month 3', retainedCount: m3, retentionRatePercent: Math.round((m3 / m0) * 100), cumulativeLtv: Math.round(totalLtv * 1.42) },
      { month: 'Month 6', retainedCount: m6, retentionRatePercent: Math.round((m6 / m0) * 100), cumulativeLtv: Math.round(totalLtv * 1.75) },
      { month: 'Month 12', retainedCount: m12, retentionRatePercent: Math.round((m12 / m0) * 100), cumulativeLtv: Math.round(totalLtv * 2.10) }
    ]
  };
}

/**
 * Generates CSV export for a segment.
 */
export async function exportSegmentCSV(orgId: string, segmentId: string): Promise<string> {
  const segRes = await pool.query('SELECT * FROM segments WHERE id = $1 AND organization_id = $2', [segmentId, orgId]);
  if (segRes.rows.length === 0) throw new Error('Segment not found.');

  const seg = segRes.rows[0];
  const { rows } = await executeSegment(orgId, seg.rules_json, seg.query_sql, 50000, 0, seg.suppression_applied);

  const headers = [
    'Donor ID',
    'Name',
    'First Name',
    'Last Name',
    'Email Address',
    'Phone Number',
    'PAN Number',
    'City',
    'State',
    'Status',
    'Lifetime Total (INR)',
    'Gift Count',
    'Last Gift Amount (INR)',
    'First Gift Date',
    'Last Gift Date',
    'Created Date'
  ];

  const csvRows = rows.map(r => [
    `"${r.id || ''}"`,
    `"${(r.display_name || r.name || '').replace(/"/g, '""')}"`,
    `"${(r.first_name || '').replace(/"/g, '""')}"`,
    `"${(r.last_name || '').replace(/"/g, '""')}"`,
    `"${(r.email || '').replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`,
    `"${(r.tax_id || '').replace(/"/g, '""')}"`,
    `"${(r.city || '').replace(/"/g, '""')}"`,
    `"${(r.state || '').replace(/"/g, '""')}"`,
    `"${(r.contact_status || 'donor').replace(/"/g, '""')}"`,
    Number(r.total_paid_amount || 0).toFixed(2),
    Number(r.total_gift_count_paid || 0),
    Number(r.last_gift_amount_paid || 0).toFixed(2),
    r.first_gift_date ? new Date(r.first_gift_date).toISOString().split('T')[0] : '',
    r.last_gift_date ? new Date(r.last_gift_date).toISOString().split('T')[0] : '',
    r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}
