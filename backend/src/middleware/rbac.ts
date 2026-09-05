import { Response, NextFunction } from 'express';
import { getEffectiveUserPermissions, ActionName, EntityObjectName, PermissionMatrix } from '../services/roleService';

export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    organization_id?: string;
    orgId?: string;
    role: string;
    email?: string;
  };
}

export type Action = ActionName | 'send';
export type ObjectName = EntityObjectName | 'organizations' | 'sessions' | 'events' | 'email_communications' | 'whatsapp_communications' | 'consents' | 'dashboards' | 'templates';

// Object name normalization
function normalizeObjectName(name: string): EntityObjectName {
  if (name === 'whatsapp_communications' || name === 'email_communications') return 'broadcasts';
  if (name === 'dashboards') return 'reports';
  if (name === 'templates') return 'broadcasts';
  if (name === 'consents') return 'contacts';
  if (name === 'events' || name === 'sessions') return 'contacts';
  return name as EntityObjectName;
}

// Action name normalization
function normalizeActionName(action: string): ActionName {
  if (action === 'send') return 'create';
  return action as ActionName;
}

/**
 * RBAC Route Middleware: Validates that the active user session has permission
 * to perform the specified action on the target entity object.
 */
export const checkPermission = (objectName: ObjectName, action: Action) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      }

      // Master Superadmin bypass
      if (user.role === 'superadmin' || user.role === 'super_admin') {
        return next();
      }

      const orgId = user.organization_id || user.orgId || (req as any).headers?.['x-organization-id'];
      const targetUserId = user.id || user.email;

      const perms: PermissionMatrix = await getEffectiveUserPermissions(targetUserId, orgId, user.role);

      const targetObj = normalizeObjectName(objectName);
      const targetAct = normalizeActionName(action);

      const objPerms = perms[targetObj];
      if (objPerms && (objPerms[targetAct] === true || objPerms['manage'] === true)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have permission to ${targetAct} on ${targetObj}. Contact your NGO Administrator.`,
        required_permission: `${targetObj}:${targetAct}`
      });
    } catch (error) {
      console.error('[RBAC Middleware Error]:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during authorization check.' });
    }
  };
};

export default checkPermission;
