import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();

// GET /api/contacts — list donors/contacts with search, status filter, and pagination
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    const { search, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT 
        d.*,
        COALESCE(d.total_paid_amount, (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE donor_id = d.id AND status = 'completed'), 0) AS total_paid_amount,
        COALESCE(c.title, 'Direct Web Donation') AS acquisition_source
      FROM donors d
      LEFT JOIN campaigns c ON d.acquisition_campaign_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (organization_id) {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (status && status !== 'All') {
      query += ` AND LOWER(d.contact_status) = LOWER($${paramIndex++})`;
      params.push(status);
    }
    if (search) {
      query += ` AND (d.first_name ILIKE $${paramIndex} OR d.last_name ILIKE $${paramIndex} OR d.name ILIKE $${paramIndex} OR d.email ILIKE $${paramIndex} OR d.phone ILIKE $${paramIndex} OR d.tax_id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);
    
    let countQuery = `SELECT COUNT(*) FROM donors WHERE 1=1`;
    const countParams: any[] = [];
    if (organization_id) {
      countQuery += ` AND organization_id = $1`;
      countParams.push(organization_id);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({ 
      success: true, 
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contacts/:id — get 360 contact detail
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    let query = `SELECT * FROM donors WHERE id = $1`;
    const params: any[] = [id];
    if (user?.role !== 'superadmin') {
      query += ` AND organization_id = $2`;
      params.push(user?.organizationId || user?.organization_id);
    }
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    
    const contact = result.rows[0];
    
    const summaryResult = await pool.query(`
      SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE donor_id = $1 AND status = 'completed') as total_donations,
        (SELECT COUNT(*) FROM email_communications WHERE contact_id = $1) as email_count,
        (SELECT COUNT(*) FROM whatsapp_communications WHERE contact_id = $1) as whatsapp_count,
        (SELECT COUNT(*) FROM mandates WHERE contact_id = $1 AND status = 'active') as active_subscriptions
    `, [id]);

    res.json({ success: true, data: { ...contact, summary: summaryResult.rows[0] } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts — create donor/contact
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin'
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);
    const { first_name, last_name, name, email, phone, tax_id, country, address, city, state, zip_code } = req.body;
    
    const displayName = name || `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous';
    
    const result = await pool.query(
      `INSERT INTO donors (
        organization_id, first_name, last_name, name, email, phone, 
        tax_id, country, street_address_1, city, state, zip_code, contact_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'donor') 
      ON CONFLICT (organization_id, email) DO UPDATE 
      SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone
      RETURNING *`,
      [organization_id, first_name, last_name, displayName, email, phone, tax_id, country || 'IN', address, city, state, zip_code]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/contacts/:id — update contact
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { first_name, last_name, name, email, phone, tax_id, city, state, zip_code, contact_status } = req.body;
    
    const displayName = name || `${first_name || ''} ${last_name || ''}`.trim();
    const userOrgId = user?.organizationId || user?.organization_id;
    
    let query = `
      UPDATE donors SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        name = COALESCE($3, name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        tax_id = COALESCE($6, tax_id),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        zip_code = COALESCE($9, zip_code),
        contact_status = COALESCE($10, contact_status),
        updated_at = NOW()
      WHERE id = $11
    `;
    const params: any[] = [first_name, last_name, displayName, email, phone, tax_id, city, state, zip_code, contact_status, id];
    
    if (user?.role !== 'superadmin') {
      query += ` AND organization_id = $12`;
      params.push(userOrgId);
    }
    query += ` RETURNING *`;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found or access denied' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/contacts/:id — delete contact (Strictly Superadmin Only)
router.delete('/:id', authenticate, authorizeRole(['superadmin']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM donations WHERE donor_id = $1', [id]);
    await client.query('DELETE FROM subscriptions WHERE donor_id = $1', [id]);
    await client.query('DELETE FROM eighty_g_receipts WHERE contact_id = $1', [id]);
    await client.query('DELETE FROM consents WHERE contact_id = $1', [id]);
    await client.query('DELETE FROM journey_enrolments WHERE contact_id = $1', [id]);
    await client.query('DELETE FROM email_communications WHERE contact_id = $1', [id]);
    await client.query('DELETE FROM whatsapp_communications WHERE contact_id = $1', [id]);
    const delRes = await client.query('DELETE FROM donors WHERE id = $1 RETURNING id, name', [id]);
    await client.query('COMMIT');
    if (delRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: `Contact "${delRes.rows[0].name}" permanently deleted.` });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
