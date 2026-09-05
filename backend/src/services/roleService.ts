import pool from '../config/db';
import bcrypt from 'bcryptjs';

export type ActionName = 'create' | 'read' | 'update' | 'delete' | 'export' | 'approve' | 'manage';

export type EntityObjectName = 
  | 'contacts' 
  | 'donations' 
  | 'campaigns' 
  | 'subscriptions' 
  | 'mandates' 
  | 'eighty_g_receipts' 
  | 'ten_bd_exports' 
  | 'segments' 
  | 'broadcasts' 
  | 'journeys' 
  | 'reports' 
  | 'object_manager' 
  | 'settings' 
  | 'api_integrations';

export type PermissionMatrix = Record<string, Record<string, boolean>>;

export interface ObjectMeta {
  key: EntityObjectName;
  label: string;
  category: 'CRM & Donors' | 'Giving & Rails' | 'Statutory & Tax' | 'Marketing & Journeys' | 'Studio & Platform';
  icon: string;
  description: string;
  supportedActions: ActionName[];
}

export const MATRIX_OBJECTS: ObjectMeta[] = [
  // 1. CRM & Donors
  {
    key: 'contacts',
    label: 'Donors & Contacts CRM',
    category: 'CRM & Donors',
    icon: '👥',
    description: 'Donor profiles, giving history, PAN verification, and contact preferences',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'manage']
  },
  {
    key: 'segments',
    label: 'Dynamic Segments & Cohorts',
    category: 'CRM & Donors',
    icon: '🎯',
    description: 'AST rule-based donor filters, RFM scoring, and cohort retention tracking',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  
  // 2. Giving & Rails
  {
    key: 'donations',
    label: 'Donation Transactions',
    category: 'Giving & Rails',
    icon: '💳',
    description: 'Online and offline payment ledger, refunds, and gateway reconciliation',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'campaigns',
    label: 'Fundraising Campaigns',
    category: 'Giving & Rails',
    icon: '📢',
    description: 'Campaign causes, landing pages, donation forms, and embed widgets',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'subscriptions',
    label: 'Recurring Giving (MRR)',
    category: 'Giving & Rails',
    icon: '🔄',
    description: 'Monthly pledge plans, auto-debit cycles, and cancellation workflows',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'mandates',
    label: 'e-Mandate & NACH Rails',
    category: 'Giving & Rails',
    icon: '⚡',
    description: 'NPCI / Razorpay / Cashfree recurring mandate registers and failure retries',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },

  // 3. Statutory & Tax
  {
    key: 'eighty_g_receipts',
    label: 'Section 80G Certificates',
    category: 'Statutory & Tax',
    icon: '📑',
    description: 'Tamper-proof 80G tax exemption receipts and instant PDF generation',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'ten_bd_exports',
    label: 'Form 10BD Annual Return',
    category: 'Statutory & Tax',
    icon: '🏛️',
    description: 'Income Tax Department annual compliance register and CSV filing exports',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },

  // 4. Marketing & Journeys
  {
    key: 'broadcasts',
    label: 'Omnichannel Broadcasts',
    category: 'Marketing & Journeys',
    icon: '📨',
    description: 'WhatsApp Meta & AWS SES bulk messaging and delivery telemetry',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'journeys',
    label: 'Automated Donor Journeys',
    category: 'Marketing & Journeys',
    icon: '🗺️',
    description: 'Multi-step onboarding, thank-you drips, and automated renewal journeys',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },

  // 5. Studio & Platform
  {
    key: 'reports',
    label: 'Custom Reports & Analytics',
    category: 'Studio & Platform',
    icon: '📊',
    description: 'Relational query builder, executive dashboards, and visual charts',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'object_manager',
    label: 'Object Manager & Schemas',
    category: 'Studio & Platform',
    icon: '📦',
    description: 'Custom entity provisioning, dynamic fields, and ER schema graph',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'api_integrations',
    label: 'API Keys & Webhooks',
    category: 'Studio & Platform',
    icon: '🔌',
    description: 'REST API credentials, inbound webhook endpoints, and signing keys',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  },
  {
    key: 'settings',
    label: 'Organization & Billing Settings',
    category: 'Studio & Platform',
    icon: '⚙️',
    description: 'Organization profile, payment gateway keys, WhatsApp numbers, and branding',
    supportedActions: ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage']
  }
];

export const ALL_ACTIONS: ActionName[] = ['create', 'read', 'update', 'delete', 'export', 'approve', 'manage'];

/**
 * Returns metadata schema describing available matrix objects and actions.
 */
export function getMatrixSchema() {
  return {
    objects: MATRIX_OBJECTS,
    actions: [
      { key: 'create', label: 'Create', description: 'Create new records or provision resources' },
      { key: 'read', label: 'Read', description: 'View records, details, and dashboards' },
      { key: 'update', label: 'Update', description: 'Edit existing records and change statuses' },
      { key: 'delete', label: 'Delete', description: 'Permanently remove or archive records' },
      { key: 'export', label: 'Export', description: 'Download CSV, Excel, or compliance reports' },
      { key: 'approve', label: 'Approve', description: 'Authorize broadcasts, refunds, or compliance filings' },
      { key: 'manage', label: 'Manage', description: 'Full operational control including sub-configurations' }
    ],
    categories: ['CRM & Donors', 'Giving & Rails', 'Statutory & Tax', 'Marketing & Journeys', 'Studio & Platform']
  };
}

/**
 * Helper to build empty matrix
 */
export function buildEmptyMatrix(): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const obj of MATRIX_OBJECTS) {
    matrix[obj.key] = {};
    for (const act of ALL_ACTIONS) {
      matrix[obj.key][act] = false;
    }
  }
  return matrix;
}

/**
 * Normalizes a permission matrix ensuring all canonical keys exist.
 */
export function normalizeMatrix(input: any): PermissionMatrix {
  const matrix = buildEmptyMatrix();
  if (!input || typeof input !== 'object') return matrix;

  for (const obj of MATRIX_OBJECTS) {
    if (input[obj.key] && typeof input[obj.key] === 'object') {
      for (const act of ALL_ACTIONS) {
        if (input[obj.key][act] === true) {
          matrix[obj.key][act] = true;
        }
      }
    }
  }
  return matrix;
}

/**
 * List all available roles for an organization (system + custom roles).
 */
export async function listRoles(orgId?: string) {
  let query = `
    SELECT 
      r.id,
      r.organization_id,
      r.name,
      r.display_name,
      r.description,
      r.is_system,
      r.permissions,
      r.created_at,
      r.updated_at,
      COUNT(om.id)::int AS member_count
    FROM roles r
    LEFT JOIN organization_members om ON r.id = om.role_id ${orgId ? 'AND om.organization_id = $1' : ''}
    WHERE r.organization_id IS NULL ${orgId ? 'OR r.organization_id = $1' : ''}
    GROUP BY r.id
    ORDER BY r.is_system DESC, r.created_at ASC
  `;
  const params = orgId ? [orgId] : [];
  const res = await pool.query(query, params);
  
  return res.rows.map(row => ({
    ...row,
    permissions: normalizeMatrix(row.permissions)
  }));
}

/**
 * Get single role by ID with member list.
 */
export async function getRoleById(roleId: string, orgId?: string) {
  const roleRes = await pool.query(
    `SELECT * FROM roles WHERE id = $1 AND (organization_id IS NULL ${orgId ? 'OR organization_id = $2' : ''})`,
    orgId ? [roleId, orgId] : [roleId]
  );
  if (roleRes.rows.length === 0) return null;

  const role = roleRes.rows[0];
  role.permissions = normalizeMatrix(role.permissions);

  // Fetch assigned members
  const membersRes = await pool.query(
    `SELECT id, email, first_name, last_name, phone, status, last_login_at, created_at
     FROM organization_members
     WHERE role_id = $1 ${orgId ? 'AND organization_id = $2' : ''}
     ORDER BY created_at DESC`,
    orgId ? [roleId, orgId] : [roleId]
  );

  return {
    ...role,
    members: membersRes.rows
  };
}


/**
 * Create a new custom role.
 */
export async function createRole(orgId: string | null | undefined, data: {
  name?: string;
  display_name: string;
  description?: string;
  permissions?: any;
  clone_from_role_id?: string;
}) {
  const displayName = data.display_name?.trim();
  if (!displayName) {
    throw new Error('Display Name is required for custom roles.');
  }

  // Generate unique slug
  let slug = data.name ? data.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!slug.startsWith('c_') && !['ngo_admin', 'ngo_manager', 'ngo_finance', 'ngo_fundraiser', 'ngo_viewer', 'superadmin'].includes(slug)) {
    slug = `c_${slug}`;
  }

  // Clone base permissions if requested
  let initialPerms = normalizeMatrix(data.permissions);
  if (data.clone_from_role_id) {
    const cloneRes = await pool.query('SELECT permissions FROM roles WHERE id = $1', [data.clone_from_role_id]);
    if (cloneRes.rows.length > 0) {
      initialPerms = normalizeMatrix(cloneRes.rows[0].permissions);
      if (data.permissions) {
        // Merge overrides
        initialPerms = { ...initialPerms, ...normalizeMatrix(data.permissions) };
      }
    }
  }

  const insertRes = await pool.query(
    `INSERT INTO roles (organization_id, name, display_name, description, is_system, permissions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, false, $5, NOW(), NOW())
     RETURNING *`,
    [orgId || null, slug, displayName, data.description || '', JSON.stringify(initialPerms)]
  );

  return {
    ...insertRes.rows[0],
    permissions: normalizeMatrix(insertRes.rows[0].permissions)
  };
}

/**
 * Update an existing custom role.
 */
export async function updateRole(roleId: string, orgId?: string, data?: {
  display_name?: string;
  description?: string;
  permissions?: any;
}) {
  const currentRes = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
  if (currentRes.rows.length === 0) {
    throw new Error('Role not found.');
  }

  const currentRole = currentRes.rows[0];
  if (currentRole.is_system) {
    throw new Error('System core roles cannot be modified.');
  }
  if (currentRole.organization_id && orgId && currentRole.organization_id !== orgId) {
    throw new Error('Unauthorized to modify this role.');
  }

  const payload = data || {};
  const updatedDisplayName = payload.display_name !== undefined ? payload.display_name.trim() : currentRole.display_name;
  const updatedDesc = payload.description !== undefined ? payload.description : currentRole.description;
  const updatedPerms = payload.permissions !== undefined ? normalizeMatrix(payload.permissions) : currentRole.permissions;

  const updateRes = await pool.query(
    `UPDATE roles
     SET display_name = $1,
         description = $2,
         permissions = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [updatedDisplayName, updatedDesc, JSON.stringify(updatedPerms), roleId]
  );

  return {
    ...updateRes.rows[0],
    permissions: normalizeMatrix(updateRes.rows[0].permissions)
  };
}

/**
 * Delete a custom role.
 */
export async function deleteRole(roleId: string, orgId?: string) {
  const currentRes = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
  if (currentRes.rows.length === 0) {
    throw new Error('Role not found.');
  }
  const role = currentRes.rows[0];
  if (role.is_system) {
    throw new Error('System core roles cannot be deleted.');
  }
  if (role.organization_id && orgId && role.organization_id !== orgId) {
    throw new Error('Unauthorized to delete this role.');
  }

  // Check if active members are assigned to this role
  const membersRes = await pool.query('SELECT COUNT(*) FROM organization_members WHERE role_id = $1', [roleId]);
  const count = Number(membersRes.rows[0].count);
  if (count > 0) {
    throw new Error(`Cannot delete role: ${count} active team members are currently assigned to this role. Reassign them first.`);
  }

  await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
  return { success: true, message: `Role "${role.display_name}" deleted successfully.` };
}

/**
 * List all organization members with their roles and computed permissions.
 */
export async function listMembers(orgId?: string) {
  const query = `
    SELECT 
       om.id,
       om.organization_id,
       o.name AS org_name,
       om.email,
       om.role,
       om.role_id,
       om.first_name,
       om.last_name,
       om.phone,
       om.status,
       om.custom_permissions,
       om.last_login_at,
       om.created_at,
       r.name AS role_slug,
       r.display_name AS role_display_name,
       r.is_system AS role_is_system,
       r.permissions AS role_permissions
     FROM organization_members om
     LEFT JOIN organizations o ON om.organization_id = o.id
     LEFT JOIN roles r ON om.role_id = r.id
     ${orgId ? 'WHERE om.organization_id = $1' : ''}
     ORDER BY om.created_at DESC
  `;
  const params = orgId ? [orgId] : [];
  const res = await pool.query(query, params);

  return res.rows.map(row => ({
    id: row.id,
    organization_id: row.organization_id,
    org_name: row.org_name || 'Global / Default',
    email: row.email,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email.split('@')[0],
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    status: row.status || 'active',
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    role: {
      id: row.role_id,
      name: row.role_slug || row.role || 'ngo_viewer',
      display_name: row.role_display_name || 'Team Member',
      is_system: row.role_is_system ?? true
    },
    effective_permissions: computeEffectivePermissions(
      row.role_permissions, 
      row.custom_permissions, 
      row.role_slug || row.role
    )
  }));
}

/**
 * Invite / add a team member to an organization.
 */
export async function inviteOrAddMember(orgId: string | null | undefined, data: {
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_id?: string;
  role_slug?: string;
  custom_permissions?: any;
}) {
  const email = data.email?.trim().toLowerCase();
  if (!email) throw new Error('Email is required.');

  // Find target organization if none provided
  let targetOrgId = orgId;
  if (!targetOrgId) {
    const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
    targetOrgId = orgRes.rows[0]?.id;
    if (!targetOrgId) throw new Error('No organization exists to assign member to.');
  }

  // Find target role
  let targetRoleId = data.role_id;
  let targetRoleSlug = data.role_slug || 'ngo_viewer';

  if (!targetRoleId) {
    const roleFind = await pool.query(
      `SELECT id, name FROM roles WHERE (name = $1 OR name = 'ngo_viewer') AND (organization_id IS NULL OR organization_id = $2) ORDER BY is_system DESC LIMIT 1`,
      [targetRoleSlug, orgId]
    );
    if (roleFind.rows.length > 0) {
      targetRoleId = roleFind.rows[0].id;
      targetRoleSlug = roleFind.rows[0].name;
    }
  } else {
    const roleFind = await pool.query('SELECT name FROM roles WHERE id = $1', [targetRoleId]);
    if (roleFind.rows.length > 0) {
      targetRoleSlug = roleFind.rows[0].name;
    }
  }

  // Password hashing
  const rawPassword = data.password || 'Welcome@123';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const insertRes = await pool.query(
    `INSERT INTO organization_members (
       organization_id, email, password_hash, role, role_id, 
       first_name, last_name, phone, status, custom_permissions, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, NOW())
     ON CONFLICT (organization_id, email) DO UPDATE
     SET role_id = EXCLUDED.role_id,
         role = EXCLUDED.role,
         first_name = COALESCE(EXCLUDED.first_name, organization_members.first_name),
         last_name = COALESCE(EXCLUDED.last_name, organization_members.last_name),
         phone = COALESCE(EXCLUDED.phone, organization_members.phone),
         status = 'active'
     RETURNING *`,
    [
      orgId, 
      email, 
      passwordHash, 
      targetRoleSlug, 
      targetRoleId, 
      data.first_name || '', 
      data.last_name || '', 
      data.phone || null,
      JSON.stringify(data.custom_permissions || {})
    ]
  );

  return insertRes.rows[0];
}

/**
 * Update a member's role, status, or details.
 */
export async function updateMember(memberId: string, orgId: string, data: {
  role_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: string;
  custom_permissions?: any;
}) {
  const currentRes = await pool.query('SELECT * FROM organization_members WHERE id = $1 AND organization_id = $2', [memberId, orgId]);
  if (currentRes.rows.length === 0) {
    throw new Error('Organization member not found.');
  }

  const member = currentRes.rows[0];
  let newRoleId = data.role_id !== undefined ? data.role_id : member.role_id;
  let newRoleSlug = member.role;

  if (data.role_id && data.role_id !== member.role_id) {
    const roleRes = await pool.query('SELECT name FROM roles WHERE id = $1', [data.role_id]);
    if (roleRes.rows.length > 0) {
      newRoleSlug = roleRes.rows[0].name;
    }
  }

  const updateRes = await pool.query(
    `UPDATE organization_members
     SET role_id = $1,
         role = $2,
         first_name = COALESCE($3, first_name),
         last_name = COALESCE($4, last_name),
         phone = COALESCE($5, phone),
         status = COALESCE($6, status),
         custom_permissions = COALESCE($7, custom_permissions)
     WHERE id = $8 AND organization_id = $9
     RETURNING *`,
    [
      newRoleId,
      newRoleSlug,
      data.first_name,
      data.last_name,
      data.phone,
      data.status,
      data.custom_permissions ? JSON.stringify(data.custom_permissions) : null,
      memberId,
      orgId
    ]
  );

  return updateRes.rows[0];
}

/**
 * Remove a member from the organization.
 */
export async function removeMember(memberId: string, orgId: string) {
  const res = await pool.query('DELETE FROM organization_members WHERE id = $1 AND organization_id = $2 RETURNING id, email', [memberId, orgId]);
  if (res.rows.length === 0) throw new Error('Member not found or unauthorized.');
  return { success: true, message: `Member ${res.rows[0].email} removed from organization.` };
}

/**
 * Computes the unified effective permissions for a user given their base role matrix and custom overrides.
 */
export function computeEffectivePermissions(rolePerms: any, customOverrides: any, fallbackRoleSlug?: string): PermissionMatrix {
  if (fallbackRoleSlug === 'superadmin' || fallbackRoleSlug === 'super_admin') {
    const matrix: PermissionMatrix = {};
    for (const obj of MATRIX_OBJECTS) {
      matrix[obj.key] = {};
      for (const act of ALL_ACTIONS) {
        matrix[obj.key][act] = true;
      }
    }
    return matrix;
  }

  const base = normalizeMatrix(rolePerms);
  if (!customOverrides || typeof customOverrides !== 'object') return base;

  // Apply user-level specific overrides (grants / revokes)
  for (const obj of MATRIX_OBJECTS) {
    if (customOverrides[obj.key] && typeof customOverrides[obj.key] === 'object') {
      for (const act of ALL_ACTIONS) {
        if (typeof customOverrides[obj.key][act] === 'boolean') {
          base[obj.key][act] = customOverrides[obj.key][act];
        }
      }
    }
  }

  return base;
}

/**
 * Live resolution of user permissions from session for API middleware checks.
 */
export async function getEffectiveUserPermissions(userId: string, orgId?: string, userRole?: string): Promise<PermissionMatrix> {
  if (userRole === 'superadmin' || userRole === 'super_admin') {
    return computeEffectivePermissions(null, null, 'superadmin');
  }

  try {
    // 1. Try finding in organization_members
    const memberRes = await pool.query(
      `SELECT om.role, om.custom_permissions, r.name AS role_slug, r.permissions AS role_permissions
       FROM organization_members om
       LEFT JOIN roles r ON om.role_id = r.id
       WHERE om.email = LOWER($1) OR om.id::text = $1
       LIMIT 1`,
      [userId]
    );

    if (memberRes.rows.length > 0) {
      const row = memberRes.rows[0];
      return computeEffectivePermissions(row.role_permissions, row.custom_permissions, row.role_slug || row.role);
    }

    // 2. Fallback to default system role by name
    const fallbackSlug = userRole || 'ngo_viewer';
    const sysRoleRes = await pool.query('SELECT permissions FROM roles WHERE name = $1 AND is_system = true LIMIT 1', [fallbackSlug]);
    if (sysRoleRes.rows.length > 0) {
      return normalizeMatrix(sysRoleRes.rows[0].permissions);
    }

    return buildEmptyMatrix();
  } catch (error) {
    console.error('[RoleService] Error resolving user permissions:', error);
    return buildEmptyMatrix();
  }
}
