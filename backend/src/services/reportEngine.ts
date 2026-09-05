import pool from '../config/db';

export interface ReportFilter {
  field: string;
  operator: string;
  value?: any;
}

export interface ReportGroupBy {
  field: string;
  interval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface ReportAggregation {
  field: string;
  fn: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT';
  alias?: string;
}

export interface ReportDefinition {
  id?: string;
  organization_id?: string;
  name: string;
  description?: string;
  report_type?: 'tabular' | 'summary' | 'matrix' | 'visual_analytics';
  primary_object: 'donations' | 'donors' | 'subscriptions' | 'campaigns' | 'eighty_g_receipts' | 'broadcasts' | 'mandates';
  columns?: string[];
  filters?: ReportFilter[];
  group_by?: (string | ReportGroupBy)[];
  aggregations?: ReportAggregation[];
  sort_by?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  chart_type?: 'bar' | 'line' | 'donut' | 'kpi_cards' | 'table' | 'none';
  chart_config?: any;
  folder?: string;
}

export const REPORT_PRESETS: ReportDefinition[] = [
  {
    name: '📊 Executive Giving & Revenue Overview',
    description: 'Comprehensive overview of donation revenues, gross GMV, average ticket sizes, and 80G issuance metrics',
    report_type: 'visual_analytics',
    primary_object: 'donations',
    columns: ['id', 'amount', 'currency', 'donor_name', 'campaign_title', 'payment_method', 'status', 'created_at'],
    filters: [{ field: 'status', operator: 'in', value: ['success', 'paid', 'completed'] }],
    group_by: [{ field: 'created_at', interval: 'month' }],
    aggregations: [
      { field: 'amount', fn: 'SUM', alias: 'total_revenue' },
      { field: 'id', fn: 'COUNT', alias: 'donation_count' },
      { field: 'amount', fn: 'AVG', alias: 'average_gift' }
    ],
    chart_type: 'bar',
    folder: 'Executive Reports'
  },
  {
    name: '🔄 Monthly Giving (MRR) & Mandate Health',
    description: 'Tracking recurring monthly giving subscriptions, active mandates, and installment success rates',
    report_type: 'visual_analytics',
    primary_object: 'subscriptions',
    columns: ['id', 'amount', 'currency', 'interval', 'donor_name', 'campaign_title', 'status', 'consecutive_failed_installments', 'created_at'],
    filters: [],
    group_by: [{ field: 'status' }],
    aggregations: [
      { field: 'amount', fn: 'SUM', alias: 'total_mrr' },
      { field: 'id', fn: 'COUNT', alias: 'subscriber_count' }
    ],
    chart_type: 'donut',
    folder: 'Recurring & Retention'
  },
  {
    name: '📢 Campaign & Cause Performance ROI',
    description: 'Total revenue collected, donor acquisition count, and average gift per fundraising campaign and cause program',
    report_type: 'summary',
    primary_object: 'donations',
    columns: ['campaign_title', 'cause_or_programme', 'amount', 'donor_id', 'created_at'],
    filters: [{ field: 'status', operator: 'in', value: ['success', 'paid', 'completed'] }],
    group_by: [{ field: 'campaign_title' }],
    aggregations: [
      { field: 'amount', fn: 'SUM', alias: 'total_funds_raised' },
      { field: 'id', fn: 'COUNT', alias: 'total_donations' },
      { field: 'donor_id', fn: 'COUNT_DISTINCT', alias: 'unique_donors' },
      { field: 'amount', fn: 'AVG', alias: 'avg_donation' }
    ],
    chart_type: 'bar',
    folder: 'Campaigns & ROI'
  },
  {
    name: '📑 Section 80G Statutory & Form 10BD Audit Trail',
    description: 'Complete register of issued 80G tax certificates, PAN compliance statuses, and financial year reconciliations',
    report_type: 'tabular',
    primary_object: 'eighty_g_receipts',
    columns: ['receipt_number', 'financial_year', 'donation_date', 'amount', 'donor_name_snapshot', 'donor_pan_snapshot', 'email_delivery_status', 'whatsapp_delivery_status', 'included_in_10bd'],
    filters: [],
    sort_by: [{ field: 'donation_date', direction: 'DESC' }],
    chart_type: 'table',
    folder: 'Tax & Compliance'
  },
  {
    name: '💳 Payment Gateway & Method Distribution',
    description: 'Breakdown of transactions across UPI, Cards, Netbanking, UPI AutoPay, and Gateway Providers',
    report_type: 'visual_analytics',
    primary_object: 'donations',
    columns: ['payment_gateway', 'payment_method', 'amount', 'status', 'created_at'],
    filters: [{ field: 'status', operator: 'in', value: ['success', 'paid', 'completed'] }],
    group_by: [{ field: 'payment_method' }],
    aggregations: [
      { field: 'amount', fn: 'SUM', alias: 'method_volume' },
      { field: 'id', fn: 'COUNT', alias: 'transaction_count' }
    ],
    chart_type: 'donut',
    folder: 'Payments & Gateway'
  },
  {
    name: '🗺️ Geographic Donor Distribution (State & City)',
    description: 'Geographical distribution of supporters and fundraising volumes across Indian states and metropolitan cities',
    report_type: 'summary',
    primary_object: 'donors',
    columns: ['state', 'city', 'total_paid_amount', 'total_gift_count_paid'],
    filters: [{ field: 'total_paid_amount', operator: 'gt', value: 0 }],
    group_by: [{ field: 'state' }],
    aggregations: [
      { field: 'total_paid_amount', fn: 'SUM', alias: 'state_revenue' },
      { field: 'id', fn: 'COUNT', alias: 'donor_count' }
    ],
    chart_type: 'bar',
    folder: 'Donor Demographics'
  },
  {
    name: '🌟 Major Donors & High-LTV Supporter Register',
    description: 'Detailed roster of high-net-worth contributors with lifetime giving >= ₹25,000 and giving histories',
    report_type: 'tabular',
    primary_object: 'donors',
    columns: ['name', 'email', 'phone', 'tax_id', 'city', 'state', 'total_paid_amount', 'total_gift_count_paid', 'last_gift_amount_paid', 'first_gift_date', 'last_gift_date'],
    filters: [{ field: 'total_paid_amount', operator: 'gte', value: 25000 }],
    sort_by: [{ field: 'total_paid_amount', direction: 'DESC' }],
    chart_type: 'table',
    folder: 'Major Donors'
  }
];

// Column mapping and join helpers
function resolveFieldSQL(primaryObject: string, rawField: string): string {
  const f = rawField.trim();
  if (f.includes('.')) return f;

  switch (primaryObject) {
    case 'donations': {
      if (['donor_name', 'donor_email', 'donor_phone', 'donor_pan', 'city', 'state'].includes(f)) {
        if (f === 'donor_name') return "COALESCE(d.name, TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, ''))))";
        if (f === 'donor_email') return 'd.email';
        if (f === 'donor_phone') return 'd.phone';
        if (f === 'donor_pan') return 'd.tax_id';
        if (f === 'city') return 'd.city';
        if (f === 'state') return 'd.state';
      }
      if (['campaign_title', 'cause_or_programme', 'campaign_type'].includes(f)) {
        if (f === 'campaign_title') return 'c.title';
        if (f === 'cause_or_programme') return 'c.cause_or_programme';
        if (f === 'campaign_type') return 'c.campaign_type';
      }
      if (['receipt_number', 'financial_year'].includes(f)) {
        if (f === 'receipt_number') return 'r.receipt_number';
        if (f === 'financial_year') return 'r.financial_year';
      }
      return `dn.${f}`;
    }
    case 'donors': {
      if (['first_gift_campaign_title', 'acquisition_campaign_title'].includes(f)) {
        if (f === 'first_gift_campaign_title') return 'fgc.title';
        if (f === 'acquisition_campaign_title') return 'ac.title';
      }
      return `d.${f}`;
    }
    case 'subscriptions': {
      if (['donor_name', 'donor_email', 'donor_phone'].includes(f)) {
        if (f === 'donor_name') return "COALESCE(d.name, TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, ''))))";
        if (f === 'donor_email') return 'd.email';
        if (f === 'donor_phone') return 'd.phone';
      }
      if (['campaign_title', 'cause_or_programme'].includes(f)) {
        if (f === 'campaign_title') return 'c.title';
        if (f === 'cause_or_programme') return 'c.cause_or_programme';
      }
      return `s.${f}`;
    }
    case 'eighty_g_receipts': {
      return `r.${f}`;
    }
    case 'campaigns': {
      return `c.${f}`;
    }
    case 'broadcasts': {
      return `bc.${f}`;
    }
    case 'mandates': {
      return `m.${f}`;
    }
    default:
      return `${primaryObject}.${f}`;
  }
}

function getBaseFromClause(primaryObject: string): string {
  switch (primaryObject) {
    case 'donations':
      return `
        FROM donations dn
        LEFT JOIN donors d ON dn.donor_id = d.id
        LEFT JOIN campaigns c ON dn.campaign_id = c.id
        LEFT JOIN subscriptions s ON dn.subscription_id = s.id
        LEFT JOIN eighty_g_receipts r ON dn.id = r.payment_id
      `;
    case 'donors':
      return `
        FROM donors d
        LEFT JOIN campaigns fgc ON d.first_gift_campaign_id = fgc.id
        LEFT JOIN campaigns ac ON d.acquisition_campaign_id = ac.id
      `;
    case 'subscriptions':
      return `
        FROM subscriptions s
        LEFT JOIN donors d ON s.donor_id = d.id
        LEFT JOIN campaigns c ON s.campaign_id = c.id
        LEFT JOIN mandates m ON s.id = m.monthly_donation_id
      `;
    case 'eighty_g_receipts':
      return `
        FROM eighty_g_receipts r
        LEFT JOIN donors d ON r.contact_id = d.id
        LEFT JOIN donations dn ON r.payment_id = dn.id
      `;
    case 'campaigns':
      return `FROM campaigns c`;
    case 'broadcasts':
      return `
        FROM broadcasts bc
        LEFT JOIN segments seg ON bc.segment_id = seg.id
        LEFT JOIN templates tpl ON bc.template_id = tpl.id
      `;
    case 'mandates':
      return `
        FROM mandates m
        LEFT JOIN donors d ON m.contact_id = d.id
        LEFT JOIN subscriptions s ON m.monthly_donation_id = s.id
      `;
    default:
      return `FROM ${primaryObject}`;
  }
}

function getPrimaryAlias(primaryObject: string): string {
  const map: Record<string, string> = {
    donations: 'dn',
    donors: 'd',
    subscriptions: 's',
    eighty_g_receipts: 'r',
    campaigns: 'c',
    broadcasts: 'bc',
    mandates: 'm'
  };
  return map[primaryObject] || primaryObject;
}

export function buildReportSQL(reportDef: ReportDefinition, orgId: string | null): { sql: string; countSql: string; params: any[]; isGrouped: boolean } {
  const primaryObject = reportDef.primary_object || (reportDef as any).primaryObject || 'donations';
  const { columns, filters = [], group_by = [], aggregations = [], sort_by = [] } = reportDef;
  const alias = getPrimaryAlias(primaryObject);
  const fromClause = getBaseFromClause(primaryObject);

  const params: any[] = [];
  let paramIndex = 1;

  let whereClauses: string[] = ['1=1'];
  if (orgId) {
    whereClauses.push(`${alias}.organization_id = $${paramIndex++}`);
    params.push(orgId);
  }

  // Compile Filters
  for (const filter of filters) {
    if (!filter.field) continue;
    const sqlField = resolveFieldSQL(primaryObject, filter.field);
    const { operator, value } = filter;

    switch (operator) {
      case 'equals':
      case 'eq':
        params.push(value);
        whereClauses.push(`${sqlField} = $${paramIndex++}`);
        break;
      case 'not_equals':
      case 'neq':
        params.push(value);
        whereClauses.push(`${sqlField} != $${paramIndex++}`);
        break;
      case 'gt':
      case 'greater_than':
        params.push(value);
        whereClauses.push(`${sqlField} > $${paramIndex++}`);
        break;
      case 'gte':
      case 'greater_than_or_equal':
        params.push(value);
        whereClauses.push(`${sqlField} >= $${paramIndex++}`);
        break;
      case 'lt':
      case 'less_than':
        params.push(value);
        whereClauses.push(`${sqlField} < $${paramIndex++}`);
        break;
      case 'lte':
      case 'less_than_or_equal':
        params.push(value);
        whereClauses.push(`${sqlField} <= $${paramIndex++}`);
        break;
      case 'contains':
        params.push(`%${value}%`);
        whereClauses.push(`${sqlField} ILIKE $${paramIndex++}`);
        break;
      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          params.push(value);
          whereClauses.push(`${sqlField} = ANY($${paramIndex++})`);
        }
        break;
      case 'is_empty':
        whereClauses.push(`(${sqlField} IS NULL OR TRIM(${sqlField}::text) = '')`);
        break;
      case 'is_not_empty':
        whereClauses.push(`(${sqlField} IS NOT NULL AND TRIM(${sqlField}::text) != '')`);
        break;
      case 'is_true':
        whereClauses.push(`${sqlField} = TRUE`);
        break;
      case 'is_false':
        whereClauses.push(`(${sqlField} = FALSE OR ${sqlField} IS NULL)`);
        break;
      case 'this_month':
        whereClauses.push(`(${sqlField} >= DATE_TRUNC('month', CURRENT_DATE) AND ${sqlField} < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')`);
        break;
      case 'this_year':
        whereClauses.push(`(${sqlField} >= DATE_TRUNC('year', CURRENT_DATE) AND ${sqlField} < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year')`);
        break;
      case 'last_30_days':
        whereClauses.push(`(${sqlField} >= NOW() - INTERVAL '30 days')`);
        break;
      case 'last_90_days':
        whereClauses.push(`(${sqlField} >= NOW() - INTERVAL '90 days')`);
        break;
      case 'last_365_days':
        whereClauses.push(`(${sqlField} >= NOW() - INTERVAL '365 days')`);
        break;
      default:
        params.push(value);
        whereClauses.push(`${sqlField} = $${paramIndex++}`);
        break;
    }
  }

  const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

  // Determine if Grouped Report
  const isGrouped = group_by && group_by.length > 0;

  if (isGrouped) {
    const selectItems: string[] = [];
    const groupByItems: string[] = [];

    for (const g of group_by) {
      const gField = typeof g === 'string' ? g : g.field;
      const interval = typeof g === 'object' ? g.interval : undefined;
      const sqlField = resolveFieldSQL(primaryObject, gField);

      if (interval) {
        const dateTrunc = `DATE_TRUNC('${interval}', ${sqlField})`;
        const dateAlias = `${gField}_${interval}`;
        selectItems.push(`TO_CHAR(${dateTrunc}, 'YYYY-MM-DD') as "${dateAlias}"`);
        selectItems.push(`COUNT(*) as record_count`);
        groupByItems.push(dateTrunc);
      } else {
        selectItems.push(`${sqlField} as "${gField}"`);
        groupByItems.push(sqlField);
      }
    }

    // Add aggregations
    for (const agg of aggregations) {
      const sqlField = resolveFieldSQL(primaryObject, agg.field);
      const aliasName = agg.alias || `${agg.fn.toLowerCase()}_${agg.field}`;

      switch (agg.fn) {
        case 'SUM':
          selectItems.push(`COALESCE(SUM(${sqlField}), 0) as "${aliasName}"`);
          break;
        case 'COUNT':
          selectItems.push(`COUNT(${sqlField}) as "${aliasName}"`);
          break;
        case 'AVG':
          selectItems.push(`COALESCE(AVG(${sqlField}), 0) as "${aliasName}"`);
          break;
        case 'MIN':
          selectItems.push(`MIN(${sqlField}) as "${aliasName}"`);
          break;
        case 'MAX':
          selectItems.push(`MAX(${sqlField}) as "${aliasName}"`);
          break;
        case 'COUNT_DISTINCT':
          selectItems.push(`COUNT(DISTINCT ${sqlField}) as "${aliasName}"`);
          break;
      }
    }

    const selectStr = selectItems.join(', ');
    const groupByStr = groupByItems.join(', ');

    let orderStr = '';
    if (sort_by && sort_by.length > 0) {
      orderStr = `ORDER BY ` + sort_by.map(s => `"${s.field}" ${s.direction}`).join(', ');
    } else {
      orderStr = `ORDER BY 1 ASC`;
    }

    const sql = `SELECT ${selectStr} ${fromClause} ${whereStr} GROUP BY ${groupByStr} ${orderStr}`;
    const countSql = `SELECT COUNT(DISTINCT (${groupByStr})) as count ${fromClause} ${whereStr}`;

    return { sql, countSql, params, isGrouped: true };
  }

  // Tabular Detail Mode
  const targetCols = columns && columns.length > 0 ? columns : ['id', 'created_at'];
  const selectItems = targetCols.map(col => `${resolveFieldSQL(primaryObject, col)} as "${col}"`);

  let orderStr = `ORDER BY ${alias}.created_at DESC`;
  if (sort_by && sort_by.length > 0) {
    orderStr = `ORDER BY ` + sort_by.map(s => `${resolveFieldSQL(primaryObject, s.field)} ${s.direction}`).join(', ');
  }

  const sql = `SELECT ${selectItems.join(', ')} ${fromClause} ${whereStr} ${orderStr}`;
  const countSql = `SELECT COUNT(*) as count ${fromClause} ${whereStr}`;

  return { sql, countSql, params, isGrouped: false };
}

export async function executeReport(
  reportDef: ReportDefinition,
  orgId: string | null,
  limit: number = 500,
  offset: number = 0
): Promise<{
  report: ReportDefinition;
  data: any[];
  rowCount: number;
  isGrouped: boolean;
  summaryKpis: {
    totalVolume: number;
    totalRecords: number;
    averageTicket: number;
    successRate: number;
  };
  chartData: {
    labels: string[];
    values: number[];
    series?: Array<{ label: string; value: number; color?: string }>;
  };
}> {
  const { sql, countSql, params, isGrouped } = buildReportSQL(reportDef, orgId);

  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 20000'); // 20s

    // 1. Get count
    const countRes = await client.query(countSql, params);
    const rowCount = Number(countRes.rows[0]?.count || 0);

    // 2. Get data
    const pagedSql = `${sql} LIMIT ${limit} OFFSET ${offset}`;
    const dataRes = await client.query(pagedSql, params);
    const rows = dataRes.rows;

    // 3. Compute Summary KPIs
    let totalVolume = 0;
    let totalRecords = isGrouped ? 0 : rowCount;
    let averageTicket = 0;
    let successCount = 0;

    for (const r of rows) {
      const vol = Number(r.total_revenue || r.amount || r.total_funds_raised || r.method_volume || r.state_revenue || r.total_mrr || r.total_paid_amount || 0);
      totalVolume += vol;
      const rec = Number(r.record_count || r.donation_count || r.total_donations || r.subscriber_count || 1);
      if (isGrouped) totalRecords += rec;

      if (r.status === 'success' || r.status === 'paid' || r.status === 'completed' || r.status === 'active') {
        successCount += rec;
      }
    }

    averageTicket = totalRecords > 0 ? Math.round(totalVolume / totalRecords) : 0;
    const successRate = totalRecords > 0 ? Math.round((successCount / totalRecords) * 100) : 100;

    // 4. Format Chart Series
    const labels: string[] = [];
    const values: number[] = [];
    const palette = ['#059669', '#2563EB', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#4F46E5', '#F59E0B'];

    const series = rows.slice(0, 15).map((row, idx) => {
      // Find label key
      const keys = Object.keys(row);
      const labelKey = keys[0] || 'label';
      const labelVal = String(row[labelKey] || 'N/A');

      // Find value key (numeric)
      let numVal = 0;
      for (const k of keys) {
        if (k !== labelKey && typeof row[k] === 'number') {
          numVal = row[k];
          break;
        } else if (k.includes('revenue') || k.includes('amount') || k.includes('volume') || k.includes('count') || k.includes('mrr')) {
          numVal = Number(row[k] || 0);
          break;
        }
      }

      labels.push(labelVal);
      values.push(numVal);

      return {
        label: labelVal,
        value: numVal,
        color: palette[idx % palette.length]
      };
    });

    return {
      report: reportDef,
      data: rows,
      rowCount,
      isGrouped,
      summaryKpis: {
        totalVolume,
        totalRecords,
        averageTicket,
        successRate: isGrouped ? (successRate || 100) : successRate
      },
      chartData: {
        labels,
        values,
        series
      }
    };
  } finally {
    await client.query('RESET statement_timeout').catch(() => {});
    client.release();
  }
}

export function exportReportCSV(rows: any[], columns?: string[]): string {
  if (!rows || rows.length === 0) return '';

  const colKeys = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
  const headers = colKeys.map(c => `"${c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}"`);

  const csvRows = rows.map(r => {
    return colKeys.map(k => {
      const val = r[k];
      if (val === null || val === undefined) return '""';
      if (val instanceof Date) return `"${val.toISOString().split('T')[0]}"`;
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });

  return [headers.join(','), ...csvRows].join('\n');
}
