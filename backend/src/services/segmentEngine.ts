import pool from '../config/db';

export function validateSegmentSQL(sql: string): { valid: boolean, errors: string[] } {
  const errors: string[] = [];
  const normalizedSql = sql.toLowerCase();

  // Check for disallowed operations
  const disallowedKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'exec', 'call'];
  for (const keyword of disallowedKeywords) {
    // Simple regex to match exact word
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(normalizedSql)) {
      errors.push(`Disallowed keyword found: ${keyword.toUpperCase()}`);
    }
  }

  // Must contain SELECT or WITH
  if (!/\b(select|with)\b/.test(normalizedSql)) {
    errors.push('Query must contain SELECT or WITH statements.');
  }

  // No semicolons
  if (sql.includes(';')) {
    errors.push('Multi-statement queries (;) are not allowed.');
  }

  // No comments
  if (sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
    errors.push('Comments are not allowed in the segment SQL.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function executeSegment(orgId: string, sql: string, params: any[], rowLimit: number = 100000): Promise<{contactIds: string[], count: number}> {
  const validation = validateSegmentSQL(sql);
  if (!validation.valid) {
    throw new Error(`Invalid segment SQL: ${validation.errors.join(', ')}`);
  }

  // Wrap query to ensure org_id isolation and select only contact IDs
  const wrappedSql = `
    WITH user_segment AS (${sql})
    SELECT id as "contactId"
    FROM user_segment
    WHERE organization_id = $1
    LIMIT $2
  `;
  
  // Adjust params
  const fullParams = [orgId, rowLimit, ...params];

  const client = await pool.connect();
  try {
    // Ensure statement timeout to prevent long-running queries
    await client.query('SET statement_timeout = 30000'); // 30 seconds
    const result = await client.query(wrappedSql, fullParams);
    
    const contactIds = result.rows.map(r => r.contactId);
    return {
      contactIds,
      count: contactIds.length
    };
  } finally {
    // Reset timeout just in case it leaks (though releasing to pool usually resets if configured, but explicit is safer)
    await client.query('RESET statement_timeout').catch(console.error);
    client.release();
  }
}

export async function applySuppression(orgId: string, contactIds: string[]): Promise<string[]> {
  if (!contactIds || contactIds.length === 0) return [];

  // Filter out suppressed contacts
  const query = `
    SELECT id FROM contacts
    WHERE id = ANY($1::uuid[])
      AND organization_id = $2
      AND status != 'suppressed'
      AND opted_out = false
      AND withdrawn_consent = false
      AND hard_bounced = false
  `;
  
  const result = await pool.query(query, [contactIds, orgId]);
  return result.rows.map(r => r.id);
}
