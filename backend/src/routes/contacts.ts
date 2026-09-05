import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';
import { recalculateContactRollups, lookupIndianPincode, updateSubscriptionStats } from '../services/contactRollupService';
import { EncryptionService } from '../services/encryptionService';

const router = Router();

// GET /api/contacts/pincode/:pincode — automated Indian Postal City & State lookup
router.get('/pincode/:pincode', (req: Request, res: Response) => {
  const { pincode } = req.params;
  const result = lookupIndianPincode(pincode);
  if (!result) {
    return res.status(400).json({ success: false, message: 'Invalid 6-digit Indian PIN code format.' });
  }
  return res.json({ success: true, data: result });
});

// GET /api/contacts — list donors/contacts with advanced search, status filter, list views, and multi-NGO support
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    const { search, status, listView, sortBy = 'created_at', sortOrder = 'desc', page = 1, limit = 100 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT 
        d.*,
        COALESCE(d.name, TRIM(CONCAT(COALESCE(d.title, ''), ' ', COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, '')))) AS display_name,
        d.phone AS mobile,
        d.tax_id AS pan_number,
        d.birthdate AS date_of_birth,
        d.street_address_1 AS address_line_1,
        d.street_address_2 AS address_line_2,
        d.zip_code AS pincode,
        fgc.title AS first_gift_campaign_title,
        lgc.title AS last_gift_campaign_title,
        ac.title AS acquisition_campaign_title,
        (
          SELECT string_agg(DISTINCT o2.name, ', ') 
          FROM donations dn2 
          JOIN organizations o2 ON dn2.organization_id = o2.id 
          WHERE dn2.donor_id = d.id AND dn2.status IN ('completed', 'paid', 'success')
        ) AS multi_ngo_names,
        (
          SELECT string_agg(DISTINCT c2.title, ', ') 
          FROM donations dn3 
          JOIN campaigns c2 ON dn3.campaign_id = c2.id 
          WHERE dn3.donor_id = d.id AND dn3.status IN ('completed', 'paid', 'success')
        ) AS multi_campaign_titles
      FROM donors d
      LEFT JOIN campaigns fgc ON d.first_gift_campaign_id = fgc.id
      LEFT JOIN campaigns lgc ON d.last_gift_campaign_id = lgc.id
      LEFT JOIN campaigns ac ON d.acquisition_campaign_id = ac.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (organization_id && organization_id !== 'all') {
      query += ` AND d.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (status && status !== 'All') {
      query += ` AND LOWER(d.contact_status) = LOWER($${paramIndex++})`;
      params.push(status);
    }

    // Donor CRM List View Filters
    if (listView) {
      if (listView === 'active_donors') {
        query += ` AND COALESCE(d.total_paid_amount, 0) > 0`;
      } else if (listView === 'monthly_donors') {
        query += ` AND COALESCE(d.total_monthly_donations, 0) > 0`;
      } else if (listView === 'major_donors') {
        query += ` AND COALESCE(d.total_paid_amount, 0) >= 25000`;
      } else if (listView === 'leads') {
        query += ` AND (COALESCE(d.total_paid_amount, 0) = 0 OR LOWER(d.contact_status) = 'lead')`;
      } else if (listView === 'lapsed') {
        query += ` AND d.last_gift_date IS NOT NULL AND d.last_gift_date < CURRENT_DATE - INTERVAL '180 days'`;
      } else if (listView === 'missing_pan') {
        query += ` AND (d.tax_id IS NULL OR TRIM(d.tax_id) = '' OR UPPER(d.tax_id) = 'PAN_PENDING') AND COALESCE(d.total_paid_amount, 0) > 0`;
      }
    }

    if (search) {
      query += ` AND (
        d.first_name ILIKE $${paramIndex} OR 
        d.last_name ILIKE $${paramIndex} OR 
        d.name ILIKE $${paramIndex} OR 
        d.email ILIKE $${paramIndex} OR 
        d.phone ILIKE $${paramIndex} OR 
        d.tax_id ILIKE $${paramIndex} OR
        d.city ILIKE $${paramIndex} OR
        d.state ILIKE $${paramIndex} OR
        d.zip_code ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sort order
    const allowedSortColumns: Record<string, string> = {
      name: 'display_name',
      first_name: 'd.first_name',
      last_name: 'd.last_name',
      email: 'd.email',
      phone: 'd.phone',
      total_paid_amount: 'COALESCE(d.total_paid_amount, 0)',
      total_monthly_donations: 'COALESCE(d.total_monthly_donations, 0)',
      last_gift_date: 'd.last_gift_date',
      created_at: 'd.created_at'
    };
    const orderColumn = allowedSortColumns[String(sortBy)] || 'd.created_at';
    const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${orderColumn} ${direction} LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);
    
    // Add computed metrics on each returned row
    const enrichedRows = result.rows.map(row => {
      const paid = Number(row.total_paid_amount || 0);
      const lastGift = row.last_gift_date ? new Date(row.last_gift_date) : null;
      let daysSinceLast = null;
      if (lastGift) {
        daysSinceLast = Math.floor((Date.now() - lastGift.getTime()) / (1000 * 60 * 60 * 24));
      }

      let tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' = 'Bronze';
      if (paid >= 100000) tier = 'Platinum';
      else if (paid >= 25000) tier = 'Gold';
      else if (paid >= 5000) tier = 'Silver';

      let stage: 'lead' | 'first_time' | 'active_regular' | 'monthly_retained' | 'major_donor' | 'lapsed' = 'lead';
      if (paid === 0 && Number(row.total_monthly_donations || 0) === 0) {
        stage = 'lead';
      } else if (paid >= 50000) {
        stage = 'major_donor';
      } else if (Number(row.total_monthly_donations || 0) > 0) {
        stage = 'monthly_retained';
      } else if (daysSinceLast !== null && daysSinceLast > 180) {
        stage = 'lapsed';
      } else if (Number(row.total_gift_count_paid || 0) > 1) {
        stage = 'active_regular';
      } else {
        stage = 'first_time';
      }

      const rawPan = row.pan_number || row.tax_id || '';
      const decryptedPan = rawPan ? EncryptionService.decrypt(rawPan) : '';
      const maskedPan = EncryptionService.maskPAN(decryptedPan);

      return {
        ...row,
        tax_id: decryptedPan,
        pan_number: decryptedPan,
        masked_pan: maskedPan,
        donor_tier: tier,
        donor_lifecycle_stage: stage,
        days_since_last_gift: daysSinceLast
      };
    });

    let countQuery = `SELECT COUNT(*) FROM donors WHERE 1=1`;
    const countParams: any[] = [];
    if (organization_id && organization_id !== 'all') {
      countQuery += ` AND organization_id = $1`;
      countParams.push(organization_id);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({ 
      success: true, 
      data: enrichedRows,
      pagination: {
        total: parseInt(countResult.rows[0]?.count || '0'),
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contacts/:id — get 360° contact detail with all related objects & histories
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    let query = `
      SELECT 
        d.*,
        COALESCE(d.name, TRIM(CONCAT(COALESCE(d.title, ''), ' ', COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, '')))) AS display_name,
        d.phone AS mobile,
        d.tax_id AS pan_number,
        d.birthdate AS date_of_birth,
        d.street_address_1 AS address_line_1,
        d.street_address_2 AS address_line_2,
        d.zip_code AS pincode,
        o.name AS organization_name,
        fgc.title AS first_gift_campaign_title,
        lgc.title AS last_gift_campaign_title,
        (
          SELECT string_agg(DISTINCT o2.name, ', ') 
          FROM donations dn2 
          JOIN organizations o2 ON dn2.organization_id = o2.id 
          WHERE dn2.donor_id = d.id AND dn2.status IN ('completed', 'paid', 'success')
        ) AS multi_ngo_names,
        (
          SELECT string_agg(DISTINCT c2.title, ', ') 
          FROM donations dn3 
          JOIN campaigns c2 ON dn3.campaign_id = c2.id 
          WHERE dn3.donor_id = d.id AND dn3.status IN ('completed', 'paid', 'success')
        ) AS multi_campaign_titles
      FROM donors d
      LEFT JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN campaigns fgc ON d.first_gift_campaign_id = fgc.id
      LEFT JOIN campaigns lgc ON d.last_gift_campaign_id = lgc.id
      WHERE d.id = $1
    `;
    const params: any[] = [id];
    if (user?.role !== 'superadmin') {
      query += ` AND d.organization_id = $2`;
      params.push(user?.organizationId || user?.organization_id);
    }
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found or access denied' });
    }
    
    const contact = result.rows[0];

    // 1. Monthly Donation Object History (Subscriptions & Mandates)
    const monthlyDonationsRes = await pool.query(`
      SELECT 
        s.*,
        s.id AS monthly_donation_id,
        c.title AS signup_campaign_title,
        c.title AS campaign_title,
        o.name AS organization_name,
        COALESCE(s.pan_card, (d.tax_id IS NOT NULL AND TRIM(d.tax_id) != '')) AS pan_card,
        m.bank_name AS mandate_bank_name,
        m.mandate_method,
        m.umrn
      FROM subscriptions s
      LEFT JOIN donors d ON s.donor_id = d.id
      LEFT JOIN campaigns c ON s.signup_campaign_id = c.id OR s.campaign_id = c.id
      LEFT JOIN organizations o ON s.organization_id = o.id
      LEFT JOIN mandates m ON s.mandate_id = m.id OR m.monthly_donation_id = s.id
      WHERE s.donor_id = $1
      ORDER BY s.created_at DESC
    `, [id]);

    // 2. Payment Object History (One-time and Monthly installment payments)
    const paymentsRes = await pool.query(`
      SELECT 
        dn.*,
        dn.id AS payment_id,
        dn.created_at AS payment_date,
        c.title AS payment_campaign_title,
        c.title AS campaign_title,
        o.name AS organization_name,
        COALESCE(dn.payment_type, CASE WHEN dn.subscription_id IS NOT NULL THEN 'monthly_donation' ELSE 'one_time' END) AS payment_type,
        CASE WHEN d.tax_id IS NOT NULL AND TRIM(d.tax_id) != '' THEN true ELSE false END AS pan_card,
        r.receipt_number,
        r.pdf_url AS receipt_pdf_url,
        COALESCE(dn.eighty_g_sent_email, (r.email_delivery_status = 'delivered')) AS eighty_g_sent_email,
        COALESCE(dn.eighty_g_sent_whatsapp, (r.whatsapp_delivery_status = 'delivered')) AS eighty_g_sent_whatsapp
      FROM donations dn
      LEFT JOIN donors d ON dn.donor_id = d.id
      LEFT JOIN campaigns c ON dn.campaign_id = c.id
      LEFT JOIN organizations o ON dn.organization_id = o.id
      LEFT JOIN eighty_g_receipts r ON dn.id = r.payment_id OR dn.eighty_g_receipt_id = r.id
      WHERE dn.donor_id = $1
      ORDER BY dn.created_at DESC
    `, [id]);

    // 3. 80G Tax Exemption Receipts History
    const eightyGRes = await pool.query(`
      SELECT 
        r.*,
        r.id AS receipt_id,
        o.name AS organization_name
      FROM eighty_g_receipts r
      LEFT JOIN organizations o ON r.organization_id = o.id
      WHERE r.contact_id = $1
      ORDER BY r.generated_at DESC
    `, [id]);

    // 4. Form 10BD Statutory Tax History
    const tenBdRes = await pool.query(`
      SELECT 
        t.*,
        t.id AS ten_bd_id,
        t.financial_year AS fy,
        t.filing_status AS status,
        t.created_at AS date
      FROM ten_bd_exports t
      WHERE t.organization_id = $1
      ORDER BY t.created_at DESC
    `, [contact.organization_id]);

    // 5. Email Communications History
    const emailRes = await pool.query(`
      SELECT 
        e.*,
        e.sent_at AS date,
        'email' AS channel,
        c.title AS campaign_title
      FROM email_communications e
      LEFT JOIN campaigns c ON e.campaign_id = c.id
      WHERE e.contact_id = $1
      ORDER BY e.created_at DESC
    `, [id]);

    // 6. WhatsApp Communications History
    const whatsappRes = await pool.query(`
      SELECT 
        w.*,
        w.sent_at AS date,
        'whatsapp' AS channel,
        c.title AS campaign_title
      FROM whatsapp_communications w
      LEFT JOIN campaigns c ON w.campaign_id = c.id
      WHERE w.contact_id = $1
      ORDER BY w.created_at DESC
    `, [id]);

    // 7. Consent Records
    const consentRes = await pool.query(`
      SELECT * FROM consents WHERE contact_id = $1 ORDER BY created_at DESC
    `, [id]);

    // 8. Journey Enrolments
    const journeyRes = await pool.query(`
      SELECT 
        je.*,
        j.journey_name,
        j.description AS journey_description
      FROM journey_enrolments je
      JOIN journeys j ON je.journey_id = j.id
      WHERE je.contact_id = $1
      ORDER BY je.entered_at DESC
    `, [id]);

    // 9. Contact Notes / Call Logs
    let notesRes = { rows: [] as any[] };
    try {
      notesRes = await pool.query(`
        SELECT * FROM contact_notes WHERE contact_id = $1 ORDER BY created_at DESC
      `, [id]);
    } catch (e) {}

    // Financial KPI Aggregates & CRM Analytics
    const paidSum = Number(contact.total_paid_amount || 0);
    const completedPayments = paymentsRes.rows.filter((p: any) => p.status === 'completed' || p.status === 'paid' || p.status === 'success');
    const giftCount = completedPayments.length;
    const avgGift = giftCount > 0 ? Math.round(paidSum / giftCount) : 0;
    const largestPayment = completedPayments.sort((a: any, b: any) => Number(b.amount) - Number(a.amount))[0] || null;

    let daysSinceLast = null;
    if (contact.last_gift_date) {
      daysSinceLast = Math.floor((Date.now() - new Date(contact.last_gift_date).getTime()) / (1000 * 60 * 60 * 24));
    }

    let donorTier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' = 'Bronze';
    if (paidSum >= 100000) donorTier = 'Platinum';
    else if (paidSum >= 25000) donorTier = 'Gold';
    else if (paidSum >= 5000) donorTier = 'Silver';

    let donorLifecycleStage: 'lead' | 'first_time' | 'active_regular' | 'monthly_retained' | 'major_donor' | 'lapsed' = 'lead';
    if (giftCount === 0 && monthlyDonationsRes.rows.length === 0) {
      donorLifecycleStage = 'lead';
    } else if (paidSum >= 50000) {
      donorLifecycleStage = 'major_donor';
    } else if (monthlyDonationsRes.rows.some((m: any) => m.status === 'active')) {
      donorLifecycleStage = 'monthly_retained';
    } else if (daysSinceLast !== null && daysSinceLast > 180) {
      donorLifecycleStage = 'lapsed';
    } else if (giftCount > 1) {
      donorLifecycleStage = 'active_regular';
    } else {
      donorLifecycleStage = 'first_time';
    }

    const summary = {
      total_donated: paidSum,
      gift_count: giftCount,
      active_subscriptions: monthlyDonationsRes.rows.filter((s: any) => s.status === 'active').length,
      average_gift_amount: avgGift,
      largest_gift_amount: largestPayment ? Number(largestPayment.amount) : null,
      largest_gift_date: largestPayment ? largestPayment.payment_date || largestPayment.created_at : null,
      days_since_last_gift: daysSinceLast,
      donor_tier: donorTier,
      donor_lifecycle_stage: donorLifecycleStage,
      first_gift_date: contact.first_gift_date,
      last_gift_date: contact.last_gift_date,
      first_gift_campaign: contact.first_gift_campaign_title || 'Direct Donation',
      last_gift_campaign: contact.last_gift_campaign_title || 'Direct Donation',
      total_monthly_donations: Number(contact.total_monthly_donations || monthlyDonationsRes.rows.length),
      total_onetime_donations: Number(contact.total_onetime_donations || completedPayments.filter((p: any) => p.payment_type === 'one_time').length),
      email_count: emailRes.rows.length,
      whatsapp_count: whatsappRes.rows.length,
      eighty_g_count: eightyGRes.rows.length,
      notes_count: notesRes.rows.length
    };

    const rawContactPan = contact.pan_number || contact.tax_id || '';
    const decryptedContactPan = rawContactPan ? EncryptionService.decrypt(rawContactPan) : '';
    const maskedContactPan = EncryptionService.maskPAN(decryptedContactPan);

    res.json({
      success: true,
      data: {
        ...contact,
        tax_id: decryptedContactPan,
        pan_number: decryptedContactPan,
        masked_pan: maskedContactPan,
        donor_tier: donorTier,
        donor_lifecycle_stage: donorLifecycleStage,
        days_since_last_gift: daysSinceLast,
        summary,
        monthly_donations: monthlyDonationsRes.rows,
        payments: paymentsRes.rows,
        eighty_g_receipts: eightyGRes.rows,
        ten_bd_history: tenBdRes.rows,
        email_communications: emailRes.rows,
        whatsapp_communications: whatsappRes.rows,
        consents: consentRes.rows,
        journeys: journeyRes.rows,
        notes: notesRes.rows
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts — create donor/contact with complete KYC & Address attributes
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let organization_id = user?.role === 'superadmin'
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    if (!organization_id) {
      const orgLookup = await pool.query('SELECT id FROM organizations LIMIT 1');
      organization_id = orgLookup.rows[0]?.id;
    }

    const { 
      title, 
      first_name, 
      last_name, 
      name, 
      email, 
      phone, 
      mobile,
      birthdate, 
      date_of_birth,
      tax_id, 
      pan_number,
      country, 
      street_address_1, 
      street_address_2, 
      address,
      address_line_1,
      address_line_2,
      city, 
      state, 
      zip_code,
      pincode,
      contact_status 
    } = req.body;
    
    const finalFirstName = first_name || '';
    const finalLastName = last_name || '';
    const displayName = name || `${title ? title + ' ' : ''}${finalFirstName} ${finalLastName}`.trim() || 'Valued Donor';
    const finalPhone = phone || mobile || null;
    const finalPan = (tax_id || pan_number || '').toUpperCase().trim() || null;
    const finalBirthdate = birthdate || date_of_birth || null;
    const finalAddr1 = street_address_1 || address_line_1 || address || null;
    const finalAddr2 = street_address_2 || address_line_2 || null;
    const finalZip = zip_code || pincode || null;

    // Auto-resolve city/state from Indian PIN code if empty
    let finalCity = city;
    let finalState = state;
    if (finalZip && (!finalCity || !finalState)) {
      const pinLookup = lookupIndianPincode(finalZip);
      if (pinLookup) {
        if (!finalCity) finalCity = pinLookup.city;
        if (!finalState) finalState = pinLookup.state;
      }
    }

    const result = await pool.query(
      `INSERT INTO donors (
        organization_id, title, first_name, last_name, name, email, phone, 
        birthdate, tax_id, country, street_address_1, street_address_2, 
        city, state, zip_code, contact_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
      ON CONFLICT (organization_id, email) DO UPDATE 
      SET 
        title = COALESCE(EXCLUDED.title, donors.title),
        first_name = COALESCE(EXCLUDED.first_name, donors.first_name),
        last_name = COALESCE(EXCLUDED.last_name, donors.last_name),
        name = COALESCE(EXCLUDED.name, donors.name),
        phone = COALESCE(EXCLUDED.phone, donors.phone),
        birthdate = COALESCE(EXCLUDED.birthdate, donors.birthdate),
        tax_id = COALESCE(EXCLUDED.tax_id, donors.tax_id),
        street_address_1 = COALESCE(EXCLUDED.street_address_1, donors.street_address_1),
        street_address_2 = COALESCE(EXCLUDED.street_address_2, donors.street_address_2),
        city = COALESCE(EXCLUDED.city, donors.city),
        state = COALESCE(EXCLUDED.state, donors.state),
        zip_code = COALESCE(EXCLUDED.zip_code, donors.zip_code),
        contact_status = COALESCE(EXCLUDED.contact_status, donors.contact_status),
        updated_at = NOW()
      RETURNING *`,
      [
        organization_id, 
        title || null, 
        finalFirstName, 
        finalLastName, 
        displayName, 
        email, 
        finalPhone, 
        finalBirthdate, 
        finalPan, 
        country || 'India', 
        finalAddr1, 
        finalAddr2, 
        finalCity, 
        finalState, 
        finalZip, 
        contact_status || 'donor'
      ]
    );

    const savedContact = result.rows[0];
    await recalculateContactRollups(savedContact.id, organization_id);
    
    res.status(201).json({ success: true, data: savedContact });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/contacts/:id — update contact
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { 
      title, 
      first_name, 
      last_name, 
      name, 
      email, 
      phone, 
      mobile,
      birthdate, 
      date_of_birth,
      tax_id, 
      pan_number,
      country, 
      street_address_1, 
      street_address_2, 
      address,
      address_line_1,
      address_line_2,
      city, 
      state, 
      zip_code,
      pincode,
      contact_status 
    } = req.body;
    
    const finalFirstName = first_name !== undefined ? first_name : null;
    const finalLastName = last_name !== undefined ? last_name : null;
    const displayName = name || (first_name || last_name ? `${title ? title + ' ' : ''}${first_name || ''} ${last_name || ''}`.trim() : null);
    const finalPhone = phone || mobile || null;
    const finalPan = tax_id || pan_number ? (tax_id || pan_number).toUpperCase().trim() : null;
    const finalBirthdate = birthdate || date_of_birth || null;
    const finalAddr1 = street_address_1 || address_line_1 || address || null;
    const finalAddr2 = street_address_2 || address_line_2 || null;
    const finalZip = zip_code || pincode || null;

    let finalCity = city;
    let finalState = state;
    if (finalZip && (!finalCity || !finalState)) {
      const pinLookup = lookupIndianPincode(finalZip);
      if (pinLookup) {
        if (!finalCity) finalCity = pinLookup.city;
        if (!finalState) finalState = pinLookup.state;
      }
    }

    const userOrgId = user?.organizationId || user?.organization_id;
    
    let query = `
      UPDATE donors SET 
        title = COALESCE($1, title),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        name = COALESCE($4, name),
        email = COALESCE($5, email),
        phone = COALESCE($6, phone),
        birthdate = COALESCE($7, birthdate),
        tax_id = COALESCE($8, tax_id),
        country = COALESCE($9, country),
        street_address_1 = COALESCE($10, street_address_1),
        street_address_2 = COALESCE($11, street_address_2),
        city = COALESCE($12, city),
        state = COALESCE($13, state),
        zip_code = COALESCE($14, zip_code),
        contact_status = COALESCE($15, contact_status),
        updated_at = NOW()
      WHERE id = $16
    `;
    const params: any[] = [
      title, 
      finalFirstName, 
      finalLastName, 
      displayName, 
      email, 
      finalPhone, 
      finalBirthdate, 
      finalPan, 
      country, 
      finalAddr1, 
      finalAddr2, 
      finalCity, 
      finalState, 
      finalZip, 
      contact_status, 
      id
    ];
    
    if (user?.role !== 'superadmin') {
      query += ` AND organization_id = $17`;
      params.push(userOrgId);
    }
    query += ` RETURNING *`;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found or access denied' });
    
    await recalculateContactRollups(id, userOrgId);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts/:id/monthly-donations — create monthly donation for contact
router.post('/:id/monthly-donations', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { 
      campaign_id, 
      amount, 
      currency = 'INR', 
      payment_gateway = 'razorpay', 
      payment_method = 'upi_autopay',
      bank_name,
      signup_date,
      next_payment_due_date
    } = req.body;

    const contactRes = await pool.query('SELECT organization_id, tax_id FROM donors WHERE id = $1', [id]);
    if (contactRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    
    const orgId = contactRes.rows[0].organization_id;
    const panCard = Boolean(contactRes.rows[0].tax_id);

    const subRes = await pool.query(
      `INSERT INTO subscriptions (
        organization_id, donor_id, campaign_id, signup_campaign_id, amount, currency,
        interval, status, payment_gateway, payment_method, bank_name, pan_card,
        signup_date, next_payment_due_date
      ) VALUES ($1, $2, $3, $3, $4, $5, 'monthly', 'active', $6, $7, $8, $9, COALESCE($10, CURRENT_DATE), $11)
      RETURNING *`,
      [
        orgId, 
        id, 
        campaign_id || null, 
        Number(amount), 
        currency.toUpperCase(), 
        payment_gateway, 
        payment_method, 
        bank_name || null,
        panCard,
        signup_date || null,
        next_payment_due_date || null
      ]
    );

    await recalculateContactRollups(id, orgId);

    res.status(201).json({ success: true, data: subRes.rows[0], message: 'Monthly donation mandate registered successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/contacts/monthly-donations/:subId — manage monthly donation (Pause, Resume, Upgrade, Cancel, Helpdesk)
router.put('/monthly-donations/:subId', authenticate, async (req: Request, res: Response) => {
  try {
    const { subId } = req.params;
    const { 
      action, // 'pause', 'resume', 'upgrade', 'downgrade', 'cancel', 'update'
      paused_period,
      pause_start_date,
      pause_end_date,
      upgraded_value,
      amount,
      end_reason,
      helpdesk_ticket_id,
      helpdesk_status,
      next_payment_due_date
    } = req.body;

    let updateFields: string[] = [];
    let params: any[] = [subId];
    let pIdx = 2;

    if (action === 'pause') {
      updateFields.push(`status = 'paused'`, `paused = true`, `helpdesk_status = 'Paused'`);
      if (paused_period) { updateFields.push(`paused_period = $${pIdx++}`); params.push(Number(paused_period)); }
      if (pause_start_date) { updateFields.push(`pause_start_date = $${pIdx++}`); params.push(pause_start_date); }
      if (pause_end_date) { updateFields.push(`pause_end_date = $${pIdx++}`); params.push(pause_end_date); }
    } else if (action === 'resume') {
      updateFields.push(`status = 'active'`, `paused = false`, `helpdesk_status = 'Saved'`);
    } else if (action === 'upgrade') {
      updateFields.push(`value_upgrade = true`, `value_upgrade_date = CURRENT_DATE`);
      if (upgraded_value) { 
        updateFields.push(`upgraded_value = $${pIdx++}`, `amount = $${pIdx++}`); 
        params.push(Number(upgraded_value), Number(upgraded_value)); 
      }
    } else if (action === 'downgrade') {
      updateFields.push(`downgraded = true`, `helpdesk_status = 'Downgrade'`);
      if (amount) { updateFields.push(`amount = $${pIdx++}`); params.push(Number(amount)); }
    } else if (action === 'cancel') {
      updateFields.push(`status = 'cancelled'`, `end_date = CURRENT_DATE`, `helpdesk_status = 'Cancelled'`);
      if (end_reason) { updateFields.push(`end_reason = $${pIdx++}`); params.push(end_reason); }
    }

    if (helpdesk_ticket_id) { updateFields.push(`helpdesk_ticket_id = $${pIdx++}`); params.push(helpdesk_ticket_id); }
    if (helpdesk_status) { updateFields.push(`helpdesk_status = $${pIdx++}`); params.push(helpdesk_status); }
    if (next_payment_due_date) { updateFields.push(`next_payment_due_date = $${pIdx++}`); params.push(next_payment_due_date); }

    updateFields.push(`updated_at = NOW()`);

    const query = `UPDATE subscriptions SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly donation not found' });
    
    const sub = result.rows[0];
    await recalculateContactRollups(sub.donor_id, sub.organization_id);

    res.json({ success: true, data: sub, message: `Monthly donation successfully updated (${action || 'modified'}).` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts/:id/notes — log staff note / call log / task
router.post('/:id/notes', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { title, content, note_type = 'general_note', author_name } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const contactRes = await pool.query('SELECT organization_id FROM donors WHERE id = $1', [id]);
    if (contactRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    const orgId = contactRes.rows[0].organization_id;

    const author = author_name || user?.email?.split('@')[0] || 'System Staff';

    const insertRes = await pool.query(
      `INSERT INTO contact_notes (organization_id, contact_id, author_name, note_type, title, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, id, author, note_type, title, content]
    );

    res.status(201).json({ success: true, data: insertRes.rows[0], message: 'Note recorded successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contacts/:id/timeline — unified activity timeline stream
router.get('/:id/timeline', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [payments, mandates, eightyG, emails, whatsapps, notes, journeys] = await Promise.all([
      pool.query(`SELECT id, amount, currency, status, payment_gateway, payment_method, created_at, 'payment' as item_type FROM donations WHERE donor_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
      pool.query(`SELECT id, amount, status, payment_gateway, created_at, 'mandate' as item_type FROM subscriptions WHERE donor_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
      pool.query(`SELECT id, receipt_number, amount, financial_year, generated_at as created_at, 'eighty_g' as item_type FROM eighty_g_receipts WHERE contact_id = $1 ORDER BY generated_at DESC LIMIT 30`, [id]),
      pool.query(`SELECT id, subject_line, status, created_at, 'email' as item_type FROM email_communications WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 30`, [id]),
      pool.query(`SELECT id, template_name, status, created_at, 'whatsapp' as item_type FROM whatsapp_communications WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 30`, [id]),
      pool.query(`SELECT id, title, content, note_type, author_name, created_at, 'note' as item_type FROM contact_notes WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
      pool.query(`SELECT je.id, j.journey_name, je.status, je.entered_at as created_at, 'journey' as item_type FROM journey_enrolments je JOIN journeys j ON je.journey_id = j.id WHERE je.contact_id = $1 ORDER BY je.entered_at DESC LIMIT 20`, [id])
    ]);

    const timelineItems: any[] = [];

    // Map Payments
    payments.rows.forEach(p => {
      const isPaid = p.status === 'completed' || p.status === 'paid' || p.status === 'success';
      timelineItems.push({
        id: `pay-${p.id}`,
        type: 'payment',
        title: isPaid ? `Donation Received: ₹${Number(p.amount).toLocaleString()}` : `Payment Attempt: ₹${Number(p.amount).toLocaleString()} (${p.status})`,
        description: `Via ${p.payment_gateway?.toUpperCase() || 'Razorpay'} (${p.payment_method?.toUpperCase() || 'UPI'})`,
        status: p.status,
        timestamp: p.created_at,
        icon: isPaid ? '💰' : '⚠️',
        color: isPaid ? '#059669' : '#DC2626'
      });
    });

    // Map Mandates
    mandates.rows.forEach(m => {
      timelineItems.push({
        id: `man-${m.id}`,
        type: 'mandate',
        title: `Monthly Mandate (${m.status?.toUpperCase()}): ₹${Number(m.amount).toLocaleString()}/mo`,
        description: `Gateway: ${m.payment_gateway?.toUpperCase() || 'Razorpay'}`,
        status: m.status,
        timestamp: m.created_at,
        icon: '🔄',
        color: '#7C3AED'
      });
    });

    // Map 80G Receipts
    eightyG.rows.forEach(r => {
      timelineItems.push({
        id: `rec-${r.id}`,
        type: 'eighty_g',
        title: `80G Certificate Issued (${r.receipt_number})`,
        description: `FY: ${r.financial_year} &bull; Amount: ₹${Number(r.amount).toLocaleString()}`,
        status: 'Issued',
        timestamp: r.created_at,
        icon: '📜',
        color: '#2563EB'
      });
    });

    // Map Emails
    emails.rows.forEach(e => {
      timelineItems.push({
        id: `em-${e.id}`,
        type: 'email',
        title: `Email: ${e.subject_line || 'Notification'}`,
        description: `Status: ${e.status?.toUpperCase() || 'DELIVERED'}`,
        status: e.status,
        timestamp: e.created_at,
        icon: '✉️',
        color: '#0284C7'
      });
    });

    // Map WhatsApp
    whatsapps.rows.forEach(w => {
      timelineItems.push({
        id: `wa-${w.id}`,
        type: 'whatsapp',
        title: `WhatsApp: ${w.template_name || 'Update'}`,
        description: `Status: ${w.status?.toUpperCase() || 'DELIVERED'}`,
        status: w.status,
        timestamp: w.created_at,
        icon: '💬',
        color: '#16A34A'
      });
    });

    // Map Notes
    notes.rows.forEach(n => {
      timelineItems.push({
        id: `note-${n.id}`,
        type: 'note',
        title: `Note: ${n.title}`,
        description: `${n.content} (by ${n.author_name})`,
        status: n.note_type,
        timestamp: n.created_at,
        icon: '📝',
        color: '#D97706'
      });
    });

    // Map Journeys
    journeys.rows.forEach(j => {
      timelineItems.push({
        id: `jrn-${j.id}`,
        type: 'journey',
        title: `Enrolled in Journey: "${j.journey_name}"`,
        description: `Current status: ${j.status}`,
        status: j.status,
        timestamp: j.created_at,
        icon: '🚀',
        color: '#9333EA'
      });
    });

    // Sort strictly chronological descending
    timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, data: timelineItems });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts/:id/offline-donation — record manual/offline donation and generate 80G
router.post('/:id/offline-donation', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      amount, 
      payment_method = 'CHEQUE', 
      payment_gateway = 'OFFLINE_MANUAL',
      campaign_id,
      gateway_transaction_id,
      payment_date,
      generate_receipt = true,
      notes 
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid donation amount is required.' });
    }

    const contactRes = await pool.query('SELECT * FROM donors WHERE id = $1', [id]);
    if (contactRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    const contact = contactRes.rows[0];
    const orgId = contact.organization_id;

    const donationDate = payment_date || new Date().toISOString().split('T')[0];
    const txnRef = gateway_transaction_id || `OFFLINE-${Date.now().toString().slice(-6)}`;

    // Insert Donation
    const donRes = await pool.query(
      `INSERT INTO donations (
        organization_id, donor_id, campaign_id, amount, currency, status,
        payment_gateway, payment_method, gateway_transaction_id, payment_type,
        created_at, custom_form_data
      ) VALUES ($1, $2, $3, $4, 'INR', 'completed', $5, $6, $7, 'one_time', $8, $9)
      RETURNING *`,
      [
        orgId,
        id,
        campaign_id || null,
        Number(amount),
        payment_gateway,
        payment_method,
        txnRef,
        donationDate,
        notes ? JSON.stringify({ manual_notes: notes }) : '{}'
      ]
    );

    const donation = donRes.rows[0];

    // Auto-generate 80G receipt if requested
    let receipt = null;
    if (generate_receipt) {
      const year = new Date(donationDate).getFullYear();
      const month = new Date(donationDate).getMonth() + 1;
      const fy = month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
      const receiptNo = `80G-${fy}-${Date.now().toString().slice(-6)}`;

      const recRes = await pool.query(
        `INSERT INTO eighty_g_receipts (
          organization_id, contact_id, payment_id, receipt_number, financial_year,
          donation_date, amount, donor_name_snapshot, donor_pan_snapshot, donor_address_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          orgId,
          id,
          donation.id,
          receiptNo,
          fy,
          donationDate,
          Number(amount),
          contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Valued Donor',
          contact.tax_id || 'PAN_PENDING',
          `${contact.street_address_1 || ''}, ${contact.city || ''}, ${contact.state || ''} ${contact.zip_code || ''}`.trim()
        ]
      );
      receipt = recRes.rows[0];

      await pool.query('UPDATE donations SET eighty_g_receipt_id = $1 WHERE id = $2', [receipt.id, donation.id]);
    }

    // Recalculate Rollups
    await recalculateContactRollups(id, orgId);

    res.status(201).json({ 
      success: true, 
      data: { donation, receipt },
      message: 'Offline donation recorded successfully with 80G receipt.' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts/:id/enroll-journey — enroll contact into an automation journey
router.post('/:id/enroll-journey', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { journey_id } = req.body;

    if (!journey_id) return res.status(400).json({ success: false, message: 'journey_id is required' });

    const contactRes = await pool.query('SELECT organization_id FROM donors WHERE id = $1', [id]);
    if (contactRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    const orgId = contactRes.rows[0].organization_id;

    // First step of journey
    const stepRes = await pool.query('SELECT id FROM journey_steps WHERE journey_id = $1 ORDER BY step_order ASC LIMIT 1', [journey_id]);
    const firstStepId = stepRes.rows[0]?.id || null;

    const enrRes = await pool.query(
      `INSERT INTO journey_enrolments (
        organization_id, journey_id, contact_id, current_step_id, status, entered_at
      ) VALUES ($1, $2, $3, $4, 'active', NOW())
      RETURNING *`,
      [orgId, journey_id, id, firstStepId]
    );

    res.status(201).json({ success: true, data: enrRes.rows[0], message: 'Contact successfully enrolled in journey.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contacts/bulk-action — perform bulk operations
router.post('/bulk-action', authenticate, async (req: Request, res: Response) => {
  try {
    const { contact_ids, action, value } = req.body;
    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No contact IDs provided.' });
    }

    if (action === 'change_status') {
      await pool.query(
        `UPDATE donors SET contact_status = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
        [value || 'donor', contact_ids]
      );
      return res.json({ success: true, message: `Successfully updated ${contact_ids.length} contacts.` });
    }

    res.json({ success: true, message: 'Bulk action completed.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contacts/:id/segments — Return all active segments and cohort memberships for a contact
router.get('/:id/segments', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contactRes = await pool.query('SELECT id, organization_id FROM donors WHERE id = $1', [id]);
    if (contactRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    const orgId = contactRes.rows[0].organization_id;

    // Fetch matching segments & snapshot memberships
    const segmentsRes = await pool.query(
      `SELECT s.id, s.name, s.segment_name, s.type, s.description, s.created_at,
              EXISTS (SELECT 1 FROM segment_snapshots ss WHERE ss.segment_id = s.id AND ss.contact_id = $1) as is_snapshot_member
       FROM segments s
       WHERE (s.organization_id = $2 OR s.organization_id IS NULL) AND s.status = 'active'
       ORDER BY s.name ASC`,
      [id, orgId]
    );

    res.json({ success: true, data: segmentsRes.rows });
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
    await client.query('DELETE FROM contact_notes WHERE contact_id = $1', [id]);
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
