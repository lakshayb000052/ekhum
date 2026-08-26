import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get campaigns for organization from Postgres
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    let targetOrgId = req.query.organizationId as string | undefined;
    
    // Check if token cookie or header exists for NGO user
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'danapro_local_jwt_secret_token_change_in_production');
        if (decoded.role === 'admin' && decoded.organizationId) {
          targetOrgId = decoded.organizationId;
        }
      } catch (e) {}
    }

    let query = `
      SELECT c.id, c.title, c.description, c.slug, c.api_key, c.landing_page_url, c.is_active, 
             c.goal_amount, c.payment_config, c.permissions, c.form_fields, c.approval_status,
             c.created_at, c.organization_id, o.name AS "orgName", o.name AS organization_name,
             o.payment_gateways_config AS org_payment_config, o.payment_gateways_config
      FROM campaigns c
      LEFT JOIN organizations o ON c.organization_id = o.id
    `;
    const params: any[] = [];
    if (targetOrgId && targetOrgId.trim() !== '') {
      query += ' WHERE c.organization_id = $1';
      params.push(targetOrgId.trim());
    }
    query += ' ORDER BY c.created_at DESC';
    const { rows } = await pool.query(query, params);
    return res.status(200).json({ success: true, campaigns: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get campaign publicly by slug (for the checkout widget embed)
router.get('/public/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.description, c.slug, c.form_fields, o.name AS "orgName", o.logo_url AS "logoUrl", o.primary_currency AS "currency"
       FROM campaigns c
       JOIN organizations o ON c.organization_id = o.id
       WHERE c.slug = $1 AND c.is_active = true`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    return res.status(200).json({
      success: true,
      campaign: rows[0]
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

import { sendCampaignApprovalNotificationEmail } from '../services/notification';

// Create new campaign
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, slug, formFields, organizationId } = req.body;
  try {
    let orgId = organizationId || 'f728c312-d961-460d-a3df-6a982f1b0cd9';
    let isPendingApproval = false;
    let approvalStatus = 'approved';
    let isActive = true;

    // Enforce multi-tenant isolation and pending approval workflow for NGO workers
    if (req.user?.role === 'admin') {
      if (req.user.organizationId) {
        orgId = req.user.organizationId;
      }
      isPendingApproval = true;
      approvalStatus = 'pending';
      isActive = false; // Must be verified and activated by Superadmin
    }

    // Get Organization name for notification email
    const orgRes = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
    const orgName = orgRes.rows[0]?.name || 'NGO Partner';
    
    const query = `
      INSERT INTO campaigns (organization_id, title, description, slug, form_fields, is_active, approval_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, slug, is_active, approval_status
    `;
    
    const { rows } = await pool.query(query, [
      orgId,
      title,
      description || '',
      slug,
      JSON.stringify(formFields || []),
      isActive,
      approvalStatus
    ]);

    const createdCamp = rows[0];

    if (isPendingApproval) {
      // Trigger instant email notification to lakshayb057@gmail.com & spikemarketingsolutions@gmail.com
      sendCampaignApprovalNotificationEmail(title, orgName, slug, createdCamp.id);

      return res.status(201).json({
        success: true,
        isPendingApproval: true,
        message: 'Campaign submitted successfully! Superadmin verification request sent to lakshayb057@gmail.com & spikemarketingsolutions@gmail.com. Superadmin will verify and configure final gateway keys.',
        campaign: createdCamp
      });
    }

    return res.status(201).json({
      success: true,
      isPendingApproval: false,
      message: 'Campaign created and published successfully!',
      campaign: createdCamp
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update campaign
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, slug, is_active } = req.body;
  try {
    const query = `
      UPDATE campaigns 
      SET title = $1, description = $2, slug = $3, is_active = $4
      WHERE id = $5
      RETURNING id, title, slug, is_active
    `;
    const { rows } = await pool.query(query, [title, description, slug, is_active, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }
    return res.status(200).json({ success: true, message: 'Campaign updated successfully!', campaign: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Delete campaign (Superadmin Only)
router.delete('/:id', authenticate, authorizeRole(['superadmin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Cascade delete campaign-related donations, landing pages, and references
    await client.query('DELETE FROM donations WHERE campaign_id = $1', [id]);
    await client.query('DELETE FROM landing_pages WHERE campaign_id = $1', [id]);
    await client.query('DELETE FROM subscriptions WHERE campaign_id = $1', [id]);
    await client.query('DELETE FROM campaigns WHERE id = $1', [id]);
    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Campaign and associated records deleted successfully!' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
