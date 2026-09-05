import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'danapro_local_jwt_secret_token_change_in_production';

// NGO User Registration
router.post('/register', async (req: Request, res: Response) => {
  const { orgName, orgSlug, country, email, password } = req.body;

  if (!orgName || !orgSlug || !country || !email || !password) {
    return res.status(400).json({ success: false, message: 'Missing required registration fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for existing slug or member email
    const existingOrg = await client.query('SELECT id FROM organizations WHERE LOWER(slug) = LOWER($1)', [orgSlug.trim()]);
    if (existingOrg.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'An organization with this slug already exists.' });
    }

    const existingMember = await client.query('SELECT id FROM organization_members WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existingMember.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'A user with this email address already exists.' });
    }

    // Insert Organization
    const defaultPermissions = {
      can_accept_donations: true,
      can_issue_80g_receipts: true,
      can_export_data: true,
      can_run_ai_analytics: true,
      platform_fee_percent: 0.0
    };

    const orgInsertRes = await client.query(
      `INSERT INTO organizations (name, slug, tax_id_country, primary_currency, status, permissions)
       VALUES ($1, $2, $3, 'INR', 'active', $4)
       RETURNING id, name, slug, tax_id_country, primary_currency, status, permissions, created_at`,
      [orgName.trim(), orgSlug.trim().toLowerCase(), country.trim().toUpperCase(), JSON.stringify(defaultPermissions)]
    );
    const newOrg = orgInsertRes.rows[0];

    // Hash password & Insert Member
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const memberInsertRes = await client.query(
      `INSERT INTO organization_members (organization_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, organization_id, email, role, created_at`,
      [newOrg.id, email.trim().toLowerCase(), passwordHash]
    );
    const newMember = memberInsertRes.rows[0];

    await client.query('COMMIT');

    const isProd = Boolean(process.env.NODE_ENV === 'production' || (req.headers.host && req.headers.host.includes('onrender.com')));
    const token = jwt.sign(
      { email: newMember.email, role: 'admin', organizationId: newOrg.id, orgSlug: newOrg.slug },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: 'NGO Registered successfully!',
      token,
      data: {
        org: newOrg,
        user: { email: newMember.email, role: 'admin', orgId: newOrg.id, orgName: newOrg.name, orgSlug: newOrg.slug }
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server registration failed: ' + error.message });
  } finally {
    client.release();
  }
});

// NGO and Superadmin User Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // 1. Check if user is Superadmin dynamically in superadmins table
    const superadminRes = await pool.query('SELECT * FROM superadmins WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    let isSuperadminMatch = false;
    let superadminRecord = superadminRes.rows[0];

    if (superadminRecord) {
      isSuperadminMatch = await bcrypt.compare(password, superadminRecord.password_hash);
    }

    const isProd = Boolean(process.env.NODE_ENV === 'production' || (req.headers.host && req.headers.host.includes('onrender.com')));

    if (isSuperadminMatch && superadminRecord) {
      const token = jwt.sign({ email: superadminRecord.email, role: 'superadmin' }, JWT_SECRET, { expiresIn: '8h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.status(200).json({
        success: true,
        token,
        user: { email: superadminRecord.email, role: 'superadmin' }
      });
    }

    // 2. Check if user is NGO Admin member
    const memberRes = await pool.query(
      `SELECT m.*, o.name AS org_name, o.slug AS org_slug 
       FROM organization_members m
       JOIN organizations o ON m.organization_id = o.id
       WHERE LOWER(m.email) = LOWER($1)`,
      [email.trim()]
    );

    if (memberRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const member = memberRes.rows[0];
    const isMatch = await bcrypt.compare(password, member.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { email: member.email, role: 'admin', organizationId: member.organization_id, orgSlug: member.org_slug },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        email: member.email,
        role: 'admin',
        orgId: member.organization_id,
        organizationId: member.organization_id,
        orgName: member.org_name,
        orgSlug: member.org_slug
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server login failed: ' + error.message });
  }
});

// Get user profile (check session cookie validity)
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      const role = req.user.role;
      const email = req.user.email;
      const targetOrgId = req.user.organizationId || (req.user as any).orgId;

      if (role === 'admin' && targetOrgId) {
        const orgRes = await pool.query('SELECT name, slug, permissions FROM organizations WHERE id = $1', [targetOrgId]);
        const orgName = orgRes.rows[0]?.name || 'NGO Partner';
        const orgSlug = orgRes.rows[0]?.slug || req.user.orgSlug;
        const permissions = orgRes.rows[0]?.permissions || {};

        return res.status(200).json({
          success: true,
          user: {
            email,
            role: 'admin',
            orgId: targetOrgId,
            organizationId: targetOrgId,
            orgName,
            orgSlug,
            permissions
          }
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          email,
          role,
          orgId: targetOrgId,
          organizationId: targetOrgId
        }
      });
    }
    return res.status(401).json({ success: false, message: 'Session token invalid or expired' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/roles — list RBAC roles from PostgreSQL database
router.get('/roles', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const targetOrgId = user?.role === 'superadmin'
      ? (req.query.organizationId as string | undefined)
      : (user?.organizationId || user?.organization_id);

    const result = await pool.query(
      `SELECT id, name, display_name, description, is_system, permissions, created_at 
       FROM roles 
       WHERE is_system = true ${targetOrgId ? 'OR organization_id = $1' : ''} 
       ORDER BY is_system DESC, created_at ASC`,
      targetOrgId ? [targetOrgId] : []
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear session cookie on logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

export default router;
