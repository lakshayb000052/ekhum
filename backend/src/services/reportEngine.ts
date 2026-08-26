import pool from '../config/db';

export interface ReportDefinition {
  primaryObject: string;
  columns: string[];
  filters: Array<{ field: string; operator: string; value: any }>;
  groupBy?: string[];
  orderBy?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
}

const RELATIONSHIPS: Record<string, string> = {
  'donors->donations': 'donors.id = donations.donor_id',
  'donors->subscriptions': 'donors.id = subscriptions.donor_id',
  'donors->consents': 'donors.id = consents.contact_id',
  'donors->email_communications': 'donors.id = email_communications.contact_id',
  'donors->whatsapp_communications': 'donors.id = whatsapp_communications.contact_id',
  'donations->campaigns': 'donations.campaign_id = campaigns.id',
  'donations->eighty_g_receipts': 'donations.id = eighty_g_receipts.payment_id',
  'donations->subscriptions': 'donations.subscription_id = subscriptions.id',
  'subscriptions->mandates': 'subscriptions.id = mandates.monthly_donation_id',
  'subscriptions->campaigns': 'subscriptions.campaign_id = campaigns.id',
};

function determineJoins(primaryObject: string, selectedColumns: string[], filters: any[]): string[] {
  // Simplified logic: Look at table prefixes in columns/filters and resolve path
  const requiredTables = new Set<string>();
  
  [...selectedColumns, ...(filters.map(f => f.field))].forEach(field => {
    const parts = field.split('.');
    if (parts.length > 1) {
      requiredTables.add(parts[0]);
    }
  });

  requiredTables.delete(primaryObject);
  
  const joins: string[] = [];
  
  for (const table of requiredTables) {
    const key1 = `${primaryObject}->${table}`;
    const key2 = `${table}->${primaryObject}`;
    
    if (RELATIONSHIPS[key1]) {
      joins.push(`LEFT JOIN ${table} ON ${RELATIONSHIPS[key1]}`);
    } else if (RELATIONSHIPS[key2]) {
      joins.push(`LEFT JOIN ${table} ON ${RELATIONSHIPS[key2]}`);
    } else {
      // More complex path finding could be implemented here
    }
  }

  return joins;
}

export function buildReportSQL(reportDef: ReportDefinition, orgId: string): { sql: string, params: any[] } {
  const { primaryObject, columns, filters, groupBy, orderBy } = reportDef;
  const params: any[] = [orgId];
  let paramIndex = 2;

  const selectCols = columns.join(', ');
  let sql = `SELECT ${selectCols} FROM ${primaryObject}`;

  const joins = determineJoins(primaryObject, columns, filters);
  if (joins.length > 0) {
    sql += ` \n${joins.join('\n')}`;
  }

  // ALWAYS add organization filter
  const whereClauses: string[] = [`${primaryObject}.organization_id = $1`];

  for (const filter of filters) {
    const { field, operator, value } = filter;
    // Map operator appropriately (simple implementation)
    let sqlOp = '=';
    if (operator === 'gt') sqlOp = '>';
    if (operator === 'lt') sqlOp = '<';
    if (operator === 'in') {
      whereClauses.push(`${field} = ANY($${paramIndex})`);
      params.push(value);
      paramIndex++;
      continue;
    }
    
    whereClauses.push(`${field} ${sqlOp} $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  if (whereClauses.length > 0) {
    sql += ` \nWHERE ` + whereClauses.join(' AND ');
  }

  if (groupBy && groupBy.length > 0) {
    sql += ` \nGROUP BY ` + groupBy.join(', ');
  }

  if (orderBy && orderBy.length > 0) {
    const orderStrs = orderBy.map(ob => `${ob.field} ${ob.direction}`);
    sql += ` \nORDER BY ` + orderStrs.join(', ');
  }

  return { sql, params };
}

export async function executeReport(reportDef: ReportDefinition, orgId: string): Promise<{rows: any[], totalCount: number}> {
  const { sql, params } = buildReportSQL(reportDef, orgId);

  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return {
      rows: result.rows,
      totalCount: result.rowCount || 0
    };
  } finally {
    client.release();
  }
}

export function exportReportCSV(rows: any[], columns: string[]): string {
  if (!rows || rows.length === 0) return '';
  
  const header = columns.join(',');
  const csvRows = rows.map(row => {
    return columns.map(col => {
      // Handle nested or aliased columns appropriately, assuming simple row object keys for now
      // typically columns might be "table.field", mapped to "field" or "table_field" depending on AS clauses
      // For simplicity:
      const val = row[col] !== undefined ? row[col] : '';
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    }).join(',');
  });

  return [header, ...csvRows].join('\n');
}
