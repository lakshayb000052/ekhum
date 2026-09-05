import pool from '../config/db';

export interface FieldDefinition {
  id?: string;
  organization_id?: string | null;
  object_name: string;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'picklist' | 'email' | 'phone' | 'url' | 'lookup';
  is_required?: boolean;
  default_value?: string | null;
  picklist_values?: string[];
  lookup_target_object?: string | null;
  help_text?: string | null;
  group_name?: string;
  is_system?: boolean;
  is_active?: boolean;
  sort_order?: number;
  permissions?: Record<string, string>;
}

export interface CustomObjectDefinition {
  object_name: string;
  label_singular: string;
  label_plural: string;
  description?: string;
  icon?: string;
}

export const STANDARD_OBJECTS_METADATA: Record<string, { label: string; singular: string; icon: string; description: string }> = {
  donors: { label: 'Contacts (Donors)', singular: 'Contact', icon: '👤', description: 'Central donor profile records, engagement scores, PAN tax IDs, and giving rollups' },
  donations: { label: 'Donations (Payments)', singular: 'Donation', icon: '💰', description: 'Real-time payment transactions, gateway refs, settlements, and tax stamps' },
  campaigns: { label: 'Campaigns & Causes', singular: 'Campaign', icon: '📢', description: 'Fundraising initiatives, goal amounts, cause programs, and landing page URLs' },
  subscriptions: { label: 'Subscriptions (Recurring)', singular: 'Subscription', icon: '🔄', description: 'Recurring monthly/annual donor auto-debit plans and retention tracking' },
  mandates: { label: 'AutoPay Mandates', singular: 'Mandate', icon: '💳', description: 'NPCI e-NACH & UPI recurring payment mandate authorizations and bank accounts' },
  eighty_g_receipts: { label: '80G Receipts (Statutory)', singular: '80G Receipt', icon: '📑', description: 'Statutory Section 80G tax exemption certificates and Form 10BD registers' },
  journeys: { label: 'Journeys (Automations)', singular: 'Journey', icon: '⚡', description: 'Automated multi-step donor engagement, retention, and recovery workflows' },
  broadcasts: { label: 'Broadcasts (Outreach)', singular: 'Broadcast', icon: '📣', description: 'Targeted bulk WhatsApp and Email campaign dispatch batches and telemetry' },
  organizations: { label: 'NGO Foundations', singular: 'NGO', icon: '🏢', description: 'Registered NGO tenant profiles, statutory approvals, and payment gateway credentials' },
  templates: { label: 'Communication Templates', singular: 'Template', icon: '✉️', description: 'Master WhatsApp, Email, and 80G certificate layouts with merge variables' },
  consents: { label: 'Consents & Privacy', singular: 'Consent', icon: '🛡️', description: 'DPDP statutory consent preferences, channel opt-ins, and withdrawal logs' },
  contact_notes: { label: 'Interaction Timeline', singular: 'Timeline Note', icon: '📝', description: 'CRM donor interaction logs, call records, task follow-ups, and notes' }
};

export const STANDARD_RELATIONSHIPS = [
  { source_object: 'donations', target_object: 'donors', foreign_key_column: 'donor_id', relationship_type: 'Many-to-One', label: 'Donor / Contact' },
  { source_object: 'donations', target_object: 'campaigns', foreign_key_column: 'campaign_id', relationship_type: 'Many-to-One', label: 'Campaign' },
  { source_object: 'donations', target_object: 'subscriptions', foreign_key_column: 'subscription_id', relationship_type: 'Many-to-One', label: 'Recurring Subscription' },
  { source_object: 'donations', target_object: 'eighty_g_receipts', foreign_key_column: 'id', target_key_column: 'payment_id', relationship_type: 'One-to-One', label: '80G Tax Receipt' },
  { source_object: 'subscriptions', target_object: 'donors', foreign_key_column: 'donor_id', relationship_type: 'Many-to-One', label: 'Donor / Contact' },
  { source_object: 'subscriptions', target_object: 'campaigns', foreign_key_column: 'campaign_id', relationship_type: 'Many-to-One', label: 'Signup Campaign' },
  { source_object: 'mandates', target_object: 'donors', foreign_key_column: 'contact_id', relationship_type: 'Many-to-One', label: 'Donor / Contact' },
  { source_object: 'mandates', target_object: 'subscriptions', foreign_key_column: 'monthly_donation_id', relationship_type: 'Many-to-One', label: 'Monthly Donation' },
  { source_object: 'eighty_g_receipts', target_object: 'donors', foreign_key_column: 'contact_id', relationship_type: 'Many-to-One', label: 'Donor' },
  { source_object: 'eighty_g_receipts', target_object: 'donations', foreign_key_column: 'payment_id', relationship_type: 'One-to-One', label: 'Donation Payment' },
  { source_object: 'consents', target_object: 'donors', foreign_key_column: 'contact_id', relationship_type: 'Many-to-One', label: 'Contact' },
  { source_object: 'contact_notes', target_object: 'donors', foreign_key_column: 'contact_id', relationship_type: 'Many-to-One', label: 'Contact' },
  { source_object: 'broadcasts', target_object: 'segments', foreign_key_column: 'segment_id', relationship_type: 'Many-to-One', label: 'Target Segment' },
  { source_object: 'broadcasts', target_object: 'templates', foreign_key_column: 'template_id', relationship_type: 'Many-to-One', label: 'Message Template' }
];

export async function getRegisteredObjects(orgId?: string | null): Promise<any[]> {
  // Query all PostgreSQL base tables
  const dbTablesRes = await pool.query(`
    SELECT table_name as name
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('schema_migrations', 'system_settings', 'superadmins', 'audit_logs', 'ai_interactions')
    ORDER BY table_name ASC
  `);

  // Query custom objects
  let customObjsRes: any = { rows: [] };
  try {
    customObjsRes = await pool.query(
      `SELECT * FROM custom_objects WHERE organization_id = $1 OR organization_id IS NULL`,
      [orgId || null]
    );
  } catch {
    // fallback if table does not exist
  }

  const customObjMap = new Map<string, any>();
  for (const c of customObjsRes.rows) {
    customObjMap.set(c.table_name || c.object_name, c);
  }

  const objects = [];

  for (const row of dbTablesRes.rows) {
    const tblName = row.name;
    const meta = STANDARD_OBJECTS_METADATA[tblName] || customObjMap.get(tblName);

    // Get field count
    const colCountRes = await pool.query(
      `SELECT COUNT(*) FROM information_schema.columns WHERE table_name = $1`,
      [tblName]
    );
    const fieldCount = Number(colCountRes.rows[0]?.count || 0);

    // Get live record count safely
    let recordCount = 0;
    try {
      if (orgId && tblName !== 'organizations') {
        const hasOrgCol = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'organization_id'`,
          [tblName]
        );
        if (hasOrgCol.rows.length > 0) {
          const countRes = await pool.query(`SELECT COUNT(*) FROM ${tblName} WHERE organization_id = $1`, [orgId]);
          recordCount = Number(countRes.rows[0]?.count || 0);
        } else {
          const countRes = await pool.query(`SELECT COUNT(*) FROM ${tblName}`);
          recordCount = Number(countRes.rows[0]?.count || 0);
        }
      } else {
        const countRes = await pool.query(`SELECT COUNT(*) FROM ${tblName}`);
        recordCount = Number(countRes.rows[0]?.count || 0);
      }
    } catch {
      recordCount = 0;
    }

    const isCustom = customObjMap.has(tblName) || tblName.startsWith('c_');
    const customMeta = customObjMap.get(tblName);

    objects.push({
      name: tblName,
      label: meta?.label || customMeta?.label_plural || (tblName.charAt(0).toUpperCase() + tblName.slice(1).replace(/_/g, ' ')),
      singularLabel: meta?.singular || customMeta?.label_singular || (tblName.charAt(0).toUpperCase() + tblName.slice(1).replace(/_/g, ' ')),
      icon: meta?.icon || customMeta?.icon || (isCustom ? '🧩' : '📦'),
      description: meta?.description || customMeta?.description || `Database entity schema for ${tblName}`,
      fieldCount,
      recordCount,
      isCustom,
      isSystem: !isCustom
    });
  }

  return objects;
}

export async function getObjectFields(objectName: string, orgId?: string | null): Promise<any[]> {
  // 1. Fetch raw columns from PostgreSQL
  const colsRes = await pool.query(`
    SELECT 
      column_name as name, 
      data_type as native_type, 
      (is_nullable = 'NO') as is_required,
      column_default as default_val
    FROM information_schema.columns 
    WHERE table_name = $1
    ORDER BY ordinal_position ASC
  `, [objectName]);

  // 2. Fetch custom field metadata from field_definitions
  let customFieldsMap = new Map<string, any>();
  try {
    const fdRes = await pool.query(
      `SELECT * FROM field_definitions WHERE object_name = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
      [objectName, orgId || null]
    );
    for (const f of fdRes.rows) {
      customFieldsMap.set(f.field_name, f);
    }
  } catch (err) {
    console.error('Error loading field definitions:', err);
  }

  return colsRes.rows.map(col => {
    const customDef = customFieldsMap.get(col.name);
    const isSystemCol = ['id', 'created_at', 'updated_at', 'organization_id'].includes(col.name);
    
    // Infer rich type
    let fieldType = customDef?.field_type;
    if (!fieldType) {
      const nt = (col.native_type || '').toLowerCase();
      if (nt.includes('numeric') || nt.includes('int') || nt.includes('double') || nt.includes('real')) {
        fieldType = (col.name.includes('amount') || col.name.includes('value') || col.name.includes('fee') || col.name.includes('ltv')) ? 'currency' : 'number';
      } else if (nt.includes('timestamp') || nt.includes('date')) {
        fieldType = nt.includes('time') ? 'datetime' : 'date';
      } else if (nt.includes('bool')) {
        fieldType = 'boolean';
      } else if (col.name.includes('email')) {
        fieldType = 'email';
      } else if (col.name.includes('phone') || col.name.includes('mobile')) {
        fieldType = 'phone';
      } else if (col.name.includes('url') || col.name.includes('link')) {
        fieldType = 'url';
      } else if (col.name.endsWith('_id') && col.name !== 'id' && col.name !== 'organization_id') {
        fieldType = 'lookup';
      } else {
        fieldType = 'text';
      }
    }

    const label = customDef?.field_label || col.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    return {
      name: col.name,
      label,
      type: fieldType,
      nativeType: col.native_type,
      required: col.is_required || customDef?.is_required || false,
      defaultValue: col.default_val || customDef?.default_value || null,
      picklistValues: customDef?.picklist_values || [],
      lookupTargetObject: customDef?.lookup_target_object || (col.name.endsWith('_id') ? col.name.replace(/_id$/, 's') : null),
      helpText: customDef?.help_text || null,
      groupName: customDef?.group_name || 'General Fields',
      isSystem: isSystemCol || customDef?.is_system || false,
      isCustom: !(isSystemCol || customDef?.is_system),
      permissions: customDef?.permissions || { super_admin: 'read_write', ngo_admin: 'read_write', ngo_manager: 'read_write', ngo_viewer: 'read_only' }
    };
  });
}

export async function addFieldToObject(orgId: string | null, objectName: string, fieldDef: FieldDefinition): Promise<any> {
  const { field_name, field_label, field_type, is_required, default_value, picklist_values, lookup_target_object, help_text, group_name } = fieldDef;

  // Sanitize table and column names to avoid injection
  const safeObjName = objectName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const safeFieldName = field_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  if (!safeFieldName || !safeObjName) {
    throw new Error('Invalid field name or object name.');
  }

  // Map to PostgreSQL column type
  let sqlType = 'TEXT';
  switch (field_type) {
    case 'text':
    case 'textarea':
      sqlType = 'TEXT';
      break;
    case 'number':
    case 'currency':
      sqlType = 'NUMERIC(14,2) DEFAULT 0.00';
      break;
    case 'date':
      sqlType = 'DATE';
      break;
    case 'datetime':
      sqlType = 'TIMESTAMP WITH TIME ZONE';
      break;
    case 'boolean':
      sqlType = 'BOOLEAN DEFAULT FALSE';
      break;
    case 'picklist':
    case 'email':
    case 'phone':
      sqlType = 'VARCHAR(255)';
      break;
    case 'url':
      sqlType = 'VARCHAR(2048)';
      break;
    case 'lookup':
      sqlType = 'UUID';
      break;
    default:
      sqlType = 'TEXT';
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. ALTER TABLE to add column in PostgreSQL
    await client.query(`ALTER TABLE ${safeObjName} ADD COLUMN IF NOT EXISTS ${safeFieldName} ${sqlType}`);

    // 2. Store in field_definitions
    const insRes = await client.query(
      `INSERT INTO field_definitions (
         organization_id, object_name, field_name, field_label, field_type, 
         is_required, default_value, picklist_values, lookup_target_object, 
         help_text, group_name, is_system, is_active, updated_at
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, true, NOW())
       ON CONFLICT (organization_id, object_name, field_name) 
       DO UPDATE SET 
         field_label = EXCLUDED.field_label,
         field_type = EXCLUDED.field_type,
         is_required = EXCLUDED.is_required,
         picklist_values = EXCLUDED.picklist_values,
         lookup_target_object = EXCLUDED.lookup_target_object,
         help_text = EXCLUDED.help_text,
         group_name = EXCLUDED.group_name,
         updated_at = NOW()
       RETURNING *`,
      [
        orgId || null,
        safeObjName,
        safeFieldName,
        field_label || safeFieldName,
        field_type || 'text',
        is_required || false,
        default_value || null,
        JSON.stringify(picklist_values || []),
        lookup_target_object || null,
        help_text || null,
        group_name || 'Custom Attributes'
      ]
    );

    // If lookup field, record relationship
    if (field_type === 'lookup' && lookup_target_object) {
      await client.query(
        `INSERT INTO object_relationships (organization_id, source_object, target_object, relationship_type, foreign_key_column, relationship_label)
         VALUES ($1, $2, $3, 'lookup', $4, $5)
         ON CONFLICT DO NOTHING`,
        [orgId || null, safeObjName, lookup_target_object, safeFieldName, field_label || safeFieldName]
      );
    }

    await client.query('COMMIT');
    return insRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createCustomObject(orgId: string, customObj: CustomObjectDefinition): Promise<any> {
  const { object_name, label_singular, label_plural, description, icon } = customObj;
  const rawObjName = object_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const tableName = `c_${rawObjName}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create table in PostgreSQL with standard multi-tenant schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_${tableName}_org ON ${tableName}(organization_id);
    `);

    // 2. Register in custom_objects
    const insRes = await client.query(
      `INSERT INTO custom_objects (
         organization_id, object_name, label_singular, label_plural, description, icon, is_system, table_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       ON CONFLICT (organization_id, object_name) 
       DO UPDATE SET 
         label_singular = EXCLUDED.label_singular,
         label_plural = EXCLUDED.label_plural,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon,
         updated_at = NOW()
       RETURNING *`,
      [orgId, rawObjName, label_singular, label_plural, description || '', icon || '🧩', tableName]
    );

    // 3. Register standard fields into field_definitions
    const stdFields = [
      { name: 'name', label: `${label_singular} Name`, type: 'text', required: true, group: 'System Core' },
      { name: 'status', label: 'Status', type: 'picklist', picklist_values: ['active', 'inactive', 'archived'], required: false, group: 'System Core' },
      { name: 'description', label: 'Description', type: 'textarea', required: false, group: 'System Core' }
    ];

    for (const f of stdFields) {
      await client.query(
        `INSERT INTO field_definitions (
           organization_id, object_name, field_name, field_label, field_type, is_required, picklist_values, group_name, is_system
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT DO NOTHING`,
        [orgId, tableName, f.name, f.label, f.type, f.required, JSON.stringify(f.picklist_values || []), f.group]
      );
    }

    await client.query('COMMIT');
    return insRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getSchemaGraph(orgId?: string | null): Promise<{ nodes: any[]; edges: any[] }> {
  const registeredObjects = await getRegisteredObjects(orgId);
  const nodes = [];

  for (const obj of registeredObjects) {
    const fields = await getObjectFields(obj.name, orgId);
    nodes.push({
      id: obj.name,
      label: obj.label,
      singularLabel: obj.singularLabel,
      icon: obj.icon,
      isCustom: obj.isCustom,
      recordCount: obj.recordCount,
      fields: fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        isSystem: f.isSystem
      }))
    });
  }

  // Load relationships
  let customRels: any = { rows: [] };
  try {
    customRels = await pool.query(`SELECT * FROM object_relationships WHERE organization_id = $1 OR organization_id IS NULL`, [orgId || null]);
  } catch {}

  const allEdges = [...STANDARD_RELATIONSHIPS, ...customRels.rows];

  const edges = allEdges.map(r => ({
    id: `${r.source_object}-${r.target_object}-${r.foreign_key_column}`,
    source: r.source_object,
    target: r.target_object,
    foreignKey: r.foreign_key_column,
    type: r.relationship_type || 'Many-to-One',
    label: r.label || r.relationship_label || r.foreign_key_column
  }));

  return { nodes, edges };
}
