import { Response, NextFunction } from 'express';
import pool from '../config/db';

export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    organization_id?: string;
    role: string;
  };
}

export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'approve' | 'send';

export type ObjectName = 
  | 'organizations' | 'contacts' | 'campaigns' | 'donations' | 'subscriptions' 
  | 'mandates' | 'landing_pages' | 'sessions' | 'events' | 'email_communications' 
  | 'whatsapp_communications' | 'consents' | 'eighty_g_receipts' | 'ten_bd_exports' 
  | 'segments' | 'broadcasts' | 'journeys' | 'reports' | 'dashboards' 
  | 'object_manager' | 'api_integrations' | 'templates' | 'settings';

export type PermissionsMap = Partial<Record<ObjectName, Partial<Record<Action, boolean>>>>;

const ALL_OBJECTS: ObjectName[] = [
  'organizations', 'contacts', 'campaigns', 'donations', 'subscriptions', 
  'mandates', 'landing_pages', 'sessions', 'events', 'email_communications', 
  'whatsapp_communications', 'consents', 'eighty_g_receipts', 'ten_bd_exports', 
  'segments', 'broadcasts', 'journeys', 'reports', 'dashboards', 
  'object_manager', 'api_integrations', 'templates', 'settings'
];

const ALL_ACTIONS: Action[] = ['create', 'read', 'update', 'delete', 'export', 'approve', 'send'];

function generatePermissions(allowedActions: Action[] | 'all', exceptions: Partial<Record<ObjectName, Partial<Record<Action, boolean>>>> = {}): PermissionsMap {
  const perms: PermissionsMap = {};
  for (const obj of ALL_OBJECTS) {
    perms[obj] = {};
    if (allowedActions === 'all') {
      for (const act of ALL_ACTIONS) perms[obj]![act] = true;
    } else {
      for (const act of allowedActions) perms[obj]![act] = true;
    }
    
    if (exceptions[obj]) {
      Object.assign(perms[obj]!, exceptions[obj]);
    }
  }
  return perms;
}

export const DEFAULT_PERMISSIONS: Record<string, PermissionsMap> = {
  super_admin: generatePermissions('all'),
  ngo_admin: generatePermissions('all', {
    object_manager: { delete: false },
    api_integrations: { delete: false }
  }),
  ngo_manager: generatePermissions(['read', 'create', 'update', 'export', 'send'], {
    // Overrides can be added here
  }),
  ngo_viewer: generatePermissions(['read'])
};

export async function loadUserPermissions(userId: string, orgId?: string): Promise<PermissionsMap> {
  // In a real application, you might fetch specific overrides for the user
  // For now, we fallback to their role.
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return {};
    }
    const role = result.rows[0].role;
    return DEFAULT_PERMISSIONS[role] || {};
  } catch (error) {
    console.error('Error loading user permissions:', error);
    return {};
  }
}

export const checkPermission = (objectName: ObjectName, action: Action) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Load perms, ideally cached in req.user or session
      const perms = await loadUserPermissions(user.id, user.organization_id);
      
      const objectPerms = perms[objectName];
      if (objectPerms && objectPerms[action] === true) {
        return next();
      }

      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during permission check' });
    }
  };
};
