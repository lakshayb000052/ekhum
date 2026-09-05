import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole, AuthenticatedRequest } from '../middleware/auth';
import { renderTemplateContent, WHITELIST_VAR_DESCRIPTIONS, WhitelistVariables } from '../services/templateEngine';

const router = Router();

// GET /api/templates/variables - List all supported whitelist variables
router.get('/variables', (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    variables: WHITELIST_VAR_DESCRIPTIONS
  });
});

// GET /api/templates - List templates
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { organizationId, orgId, type } = req.query;
  const targetOrg = (organizationId || orgId) as string | undefined;

  try {
    let query = `
      SELECT t.*, o.name AS organization_name 
      FROM templates t
      LEFT JOIN organizations o ON t.organization_id = o.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by organization if provided, or if non-superadmin
    const userOrgId = (req.user as any)?.organization_id || req.user?.organizationId;
    if (req.user?.role !== 'superadmin' && userOrgId) {
      params.push(userOrgId);
      query += ` AND (t.organization_id = $${params.length} OR t.is_default = TRUE)`;
    } else if (targetOrg) {
      if (targetOrg === 'default') {
        query += ` AND (t.organization_id IS NULL OR t.is_default = TRUE)`;
      } else {
        params.push(targetOrg);
        query += ` AND (t.organization_id = $${params.length} OR t.is_default = TRUE)`;
      }
    }

    if (type) {
      params.push(type);
      query += ` AND t.type = $${params.length}`;
    }

    query += ` ORDER BY t.is_default DESC, t.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    return res.status(200).json({
      success: true,
      data: rows,
      templates: rows
    });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/templates - Create or Replace NGO Template
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { organization_id, type, name, subject, content, is_default } = req.body;

  try {
    if (!type || !name || !content) {
      return res.status(400).json({ success: false, message: 'Type, name, and content are required.' });
    }

    // Determine created_by role
    const createdBy = req.user?.role === 'superadmin' ? 'superadmin' : 'ngo';
    const targetOrgId = req.user?.role === 'superadmin' ? (organization_id || null) : req.user?.organizationId;

    // If superadmin sets is_default to true, clear existing default for this type
    if (is_default && req.user?.role === 'superadmin') {
      await pool.query('UPDATE templates SET is_default = FALSE WHERE type = $1', [type]);
    }

    // STRICT 1-TO-1 REGULATION: If an NGO already has a template for this type, AUTOMATICALLY REPLACE IT!
    if (targetOrgId) {
      const existingOrgTmpl = await pool.query(
        'SELECT id FROM templates WHERE organization_id = $1 AND type = $2',
        [targetOrgId, type]
      );
      if (existingOrgTmpl.rows.length > 0) {
        const replaceQuery = `
          UPDATE templates 
          SET name = $1, subject = $2, content = $3, is_default = $4, created_by = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING *
        `;
        const { rows } = await pool.query(replaceQuery, [
          name,
          subject || null,
          content,
          is_default || false,
          createdBy,
          existingOrgTmpl.rows[0].id
        ]);

        return res.status(200).json({
          success: true,
          replacedExisting: true,
          message: `Existing ${type} template for this NGO was automatically replaced with the new configuration!`,
          template: rows[0]
        });
      }
    }

    const query = `
      INSERT INTO templates (organization_id, type, name, subject, content, is_default, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      targetOrgId,
      type,
      name,
      subject || null,
      content,
      is_default || false,
      createdBy
    ]);

    return res.status(201).json({
      success: true,
      replacedExisting: false,
      message: 'Template created and assigned successfully!',
      template: rows[0]
    });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/templates/:id - Update Template
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, subject, content, is_default } = req.body;

  try {
    // Check permission
    const existing = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    const tmpl = existing.rows[0];
    if (req.user?.role !== 'superadmin' && tmpl.organization_id !== req.user?.organizationId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot edit another organization template.' });
    }

    if (is_default && req.user?.role === 'superadmin') {
      await pool.query('UPDATE templates SET is_default = FALSE WHERE type = $1', [tmpl.type]);
    }

    const updateQuery = `
      UPDATE templates 
      SET name = COALESCE($1, name),
          subject = COALESCE($2, subject),
          content = COALESCE($3, content),
          is_default = COALESCE($4, is_default),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const { rows } = await pool.query(updateQuery, [
      name,
      subject,
      content,
      is_default,
      id
    ]);

    return res.status(200).json({
      success: true,
      message: 'Template updated successfully!',
      template: rows[0]
    });
  } catch (error: any) {
    console.error('Error updating template:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/templates/:id - Delete Template (Superadmin Only)
router.delete('/:id', authenticate, authorizeRole(['superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    await pool.query('DELETE FROM templates WHERE id = $1', [id]);
    return res.status(200).json({
      success: true,
      message: 'Template deleted successfully.'
    });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/templates/preview - Live Whitelist Preview Rendering
router.post('/preview', async (req: Request, res: Response) => {
  const { content, subject, customVars, organization_id, campaign_id } = req.body;
  const orgId = organization_id || (req as any).user?.organization_id;

  let ngoName = 'Organization';
  let ngoUrn = '';
  let ngoSignatory = '';
  let ngoCountry = 'IN';

  if (orgId) {
    try {
      const orgRes = await pool.query('SELECT name, tax_id, authorized_signatory, country FROM organizations WHERE id = $1', [orgId]);
      if (orgRes.rows.length > 0) {
        ngoName = orgRes.rows[0].name || ngoName;
        ngoUrn = orgRes.rows[0].tax_id || ngoUrn;
        ngoSignatory = orgRes.rows[0].authorized_signatory || ngoSignatory;
        ngoCountry = orgRes.rows[0].country || ngoCountry;
      }
    } catch (err) {
      console.error('Error fetching org for preview:', err);
    }
  }

  let campaignTitle = 'General Campaign';
  if (campaign_id) {
    try {
      const campRes = await pool.query('SELECT title FROM campaigns WHERE id = $1', [campaign_id]);
      if (campRes.rows.length > 0) {
        campaignTitle = campRes.rows[0].title || campaignTitle;
      }
    } catch (err) {
      console.error('Error fetching campaign for preview:', err);
    }
  }

  const previewVars: WhitelistVariables = {
    donor_name: 'Donor Name',
    donor_email: 'donor@example.com',
    donor_phone: '+91 9000000000',
    donor_tax_id: 'ABCDE1234F',
    donor_country: 'IN',
    donation_amount: '1,000',
    donation_currency: 'INR',
    donation_date: new Date().toISOString().split('T')[0],
    transaction_id: `pay_${Date.now().toString(36)}`,
    payment_method: 'UPI',
    campaign_title: campaignTitle,
    ngo_name: ngoName,
    ngo_urn: ngoUrn,
    ngo_signatory: ngoSignatory,
    ngo_country: ngoCountry,
    receipt_url: '/receipts/download',
    ...customVars
  };

  const renderedContent = renderTemplateContent(content || '', previewVars);
  const renderedSubject = subject ? renderTemplateContent(subject, previewVars) : undefined;

  return res.status(200).json({
    success: true,
    renderedContent,
    renderedSubject,
    previewVars
  });
});

export default router;
