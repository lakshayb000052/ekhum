import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listMembers,
  inviteOrAddMember,
  updateMember,
  removeMember,
  getMatrixSchema,
  getEffectiveUserPermissions
} from '../services/roleService';

const router = Router();

// Helper to extract organization_id
function getOrgId(req: Request): string | undefined {
  const user = (req as any).user;
  return user?.organizationId || user?.organization_id || user?.orgId || (req.query.organization_id as string) || (req.headers['x-organization-id'] as string) || undefined;
}

// 1. GET /api/roles/matrix/schema — Matrix object and action dictionary
router.get('/matrix/schema', authenticate, async (req: Request, res: Response) => {
  try {
    const schema = getMatrixSchema();
    res.json({ success: true, data: schema });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET /api/roles/me/permissions — Current user's resolved permission matrix
router.get('/me/permissions', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const orgId = getOrgId(req);
    const userId = user.userId || user.id || user.email;
    const permissions = await getEffectiveUserPermissions(userId, orgId, user.role);

    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: user.email,
          role: user.role,
          organization_id: orgId
        },
        permissions
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. GET /api/roles/members/list — List team members and role assignments
router.get('/members/list', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req);
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required to list members.' });
    }

    const members = await listMembers(orgId);
    res.json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. POST /api/roles/members/invite — Invite / add new team member
router.post('/members/invite', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req) || req.body.organization_id;
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { email, password, first_name, last_name, phone, role_id, role_slug, custom_permissions } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const member = await inviteOrAddMember(orgId, {
      email,
      password,
      first_name,
      last_name,
      phone,
      role_id,
      role_slug,
      custom_permissions
    });

    res.status(201).json({
      success: true,
      data: member,
      message: `Team member ${email} invited and assigned successfully.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. PUT /api/roles/members/:id — Update member role or profile
router.put('/members/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req) || req.body.organization_id;
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { id } = req.params;
    const { role_id, first_name, last_name, phone, status, custom_permissions } = req.body;

    const updated = await updateMember(id, orgId || '', {
      role_id,
      first_name,
      last_name,
      phone,
      status,
      custom_permissions
    });

    res.json({
      success: true,
      data: updated,
      message: 'Team member updated successfully.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. DELETE /api/roles/members/:id — Remove member
router.delete('/members/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req) || (req.query.organization_id as string);
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { id } = req.params;
    const result = await removeMember(id, orgId || '');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. GET /api/roles — List all roles
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const roles = await listRoles(orgId);
    res.json({ success: true, data: roles });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. GET /api/roles/:id — Get role details
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const role = await getRoleById(id, orgId);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    res.json({ success: true, data: role });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. POST /api/roles — Create custom role
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req) || req.body.organization_id || null;
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required to create a custom role.' });
    }

    const { name, display_name, description, permissions, clone_from_role_id } = req.body;
    if (!display_name) {
      return res.status(400).json({ success: false, message: 'Role Display Name is required.' });
    }

    const created = await createRole(orgId, {
      name,
      display_name,
      description,
      permissions,
      clone_from_role_id
    });

    res.status(201).json({
      success: true,
      data: created,
      message: `Custom role "${created.display_name}" created successfully!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. PUT /api/roles/:id — Update custom role
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req) || req.body.organization_id;
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { id } = req.params;
    const { display_name, description, permissions } = req.body;

    const updated = await updateRole(id, orgId, {
      display_name,
      description,
      permissions
    });

    res.json({
      success: true,
      data: updated,
      message: `Role "${updated.display_name}" permissions updated successfully!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. DELETE /api/roles/:id — Delete custom role
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = getOrgId(req) || (req.query.organization_id as string);
    const isSuperadmin = user?.role === 'superadmin' || user?.role === 'super_admin';

    if (!orgId && !isSuperadmin) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { id } = req.params;
    const result = await deleteRole(id, orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
