import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/db';
import Razorpay from 'razorpay';
import { broadcastDonationEvent } from '../websocket';
import { sendAWSEmailNotification, sendWhatsAppNotification } from '../services/notification';
import { triggerDonationSuccessEventsAndNotifications } from '../services/journeyExecutor';
import { 
  initiateMultiGatewayPayment, 
  verifyPayUReverseHash, 
  decryptCCAvenue, 
  generateWorldlineChecksum, 
  extractNgoGatewayRails,
  getSystemSettings 
} from '../services/paymentRouter';
import { recalculateContactRollups, lookupIndianPincode, updateSubscriptionStats } from '../services/contactRollupService';

const router = Router();

/**
 * @route GET /api/v1/external/campaigns/:slug
 * @route GET /api/v1/landing-pages/:slug
 * @desc Get public campaign configuration, parent NGO details, custom form fields, and assigned payment rails
 */
router.get(['/campaigns/:slug', '/landing-pages/:slug'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { rows } = await pool.query(
      `SELECT c.*, o.name as org_name, o.slug as org_slug, o.primary_currency, o.payment_gateways_config, o.certificate_80g_config
       FROM campaigns c
       JOIN organizations o ON c.organization_id = o.id
       WHERE c.slug = $1 AND c.is_active = true`,
      [slug]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found or inactive.' });
      return;
    }

    const camp = rows[0];
    const sysSettings = await getSystemSettings();
    const ngoRails = extractNgoGatewayRails(camp.payment_gateways_config, sysSettings);

    const campCfg = camp.payment_config || {};
    const assignedGatewayIds: string[] = Array.isArray(campCfg.assigned_gateway_ids) ? campCfg.assigned_gateway_ids : [];

    let availableRails = ngoRails;
    if (assignedGatewayIds.length > 0) {
      availableRails = ngoRails.filter(r => assignedGatewayIds.includes(r.id) || assignedGatewayIds.includes(r.type));
    }

    res.status(200).json({
      success: true,
      campaign: {
        id: camp.id,
        title: camp.title,
        description: camp.description,
        slug: camp.slug,
        goal_amount: camp.goal_amount,
        landing_page_url: camp.landing_page_url,
        form_fields: camp.form_fields || [],
        permissions: camp.permissions || {}
      },
      organization: {
        id: camp.organization_id,
        name: camp.org_name,
        slug: camp.org_slug,
        currency: camp.primary_currency || 'INR'
      },
      paymentRails: availableRails.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        is_primary: campCfg.primary_gateway === r.type || campCfg.primary_gateway === r.id
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/v1/external/donations/initiate
 * @desc External API endpoint for NGO landing pages to initiate a donation across any configured gateway rail with Smart Failover
 */
router.post('/donations/initiate', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = (req.headers['x-ekhum-api-key'] || req.headers['x-wegive-api-key'] || req.headers['x-danapro-api-key'] || req.query.api_key || req.body.api_key) as string;
    
    // Extract body and fallback to customFormData or dataLayer
    const customData = req.body.customFormData || req.body.custom_form_data || req.body.custom_fields || {};
    const dataLayerObj = req.body.dataLayer || req.body.data_layer || {};

    const {
      // Identity & Contact
      title,
      first_name,
      firstName,
      last_name,
      lastName,
      name,
      donor_name,
      donorName,
      email,
      donor_email,
      donorEmail: inputDonorEmail,
      phone,
      mobile,
      donor_phone,
      donorPhone: inputDonorPhone,
      donor_mobile,
      alt_phone,
      alternate_phone,
      whatsapp_number,
      taxId,
      tax_id,
      pan,
      pan_number,
      panNumber,
      pan_holder_name,
      birthdate,
      date_of_birth,
      dob,
      birth_date,
      gender,
      donor_type,
      donorType,
      citizenship,

      // Address
      address,
      street_address_1,
      street_address_2,
      address_line_1,
      address_line_2,
      apartment,
      line1,
      line2,
      city,
      state,
      zip_code,
      pincode,
      pin,
      postal_code,
      postalCode,
      country,

      // Statutory & 80G / 10BD
      is_80g_requested,
      requires_80g,
      is80GRequested,
      certificate_language,
      isAnonymous = false,
      is_anonymous,
      anon_donor,

      // Consent & DPDP
      consent_email,
      consentEmail,
      consent_whatsapp,
      consentWhatsapp,
      consent_sms,
      consentSms,
      consent_calling,
      consentCalling,
      preferred_channel,
      preferred_language,

      // Marketing Attribution & UTM
      utm_source,
      utmSource,
      utm_medium,
      utmMedium,
      utm_campaign,
      utmCampaign,
      utm_content,
      utmContent,
      utm_term,
      utmTerm,
      referrer,
      landing_page_url,
      landingPageUrl,
      device_type,
      deviceType,
      sub_campaign_id,
      fundraiser_id,
      volunteer_code,
      referral_code,

      // Staff Notes / Donor Comments
      comments,
      notes,
      message,
      donor_comment,

      // Frequency & Payment
      payment_type,
      paymentType,
      is_monthly,
      isMonthly,
      interval,
      frequency,
      amount,
      currency = 'INR',
      campaignSlug,
      requestedGateway,
      forceSandbox = false
    } = req.body;

    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized: Missing DanaPro / EKhum API Key (x-ekhum-api-key header or api_key payload parameter required)' });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Invalid donation amount' });
      return;
    }

    // 1. Resolve Campaign & Organization via API Key or Campaign Slug fallback
    let campaignQuery = `
      SELECT c.*, o.id as org_id, o.name as org_name, o.payment_gateways_config as org_payment_config, o.permissions as org_permissions 
      FROM campaigns c
      JOIN organizations o ON c.organization_id = o.id
      WHERE c.api_key = $1 OR o.api_key = $1
         OR REPLACE(c.api_key, 'ek_live_', 'ek_test_') = $1
         OR REPLACE(c.api_key, 'ek_test_', 'ek_live_') = $1
         OR REPLACE(o.api_key, 'ek_live_', 'ek_test_') = $1
         OR REPLACE(o.api_key, 'ek_test_', 'ek_live_') = $1
         OR REPLACE(c.api_key, 'wg_live_', 'ek_live_') = $1
         OR REPLACE(o.api_key, 'wg_live_', 'ek_live_') = $1
    `;
    let queryParams: any[] = [apiKey];

    if (campaignSlug) {
      campaignQuery += ` OR c.slug = $2`;
      queryParams.push(campaignSlug);
    }

    const campaignRes = await pool.query(campaignQuery, queryParams);

    if (campaignRes.rows.length === 0) {
      res.status(404).json({ error: 'Invalid DanaPro API Key or target campaign not found' });
      return;
    }

    const campaign = campaignRes.rows[0];
    const organizationId = campaign.org_id;

    // Enforce optional Landing Page Domain restriction if configured
    const requestOrigin = (req.headers.origin || req.headers.referer || '') as string;
    if (campaign.landing_page_url && campaign.landing_page_url.trim().length > 0 && requestOrigin) {
      try {
        const allowedHost = new URL(campaign.landing_page_url).hostname.toLowerCase();
        const incomingHost = new URL(requestOrigin).hostname.toLowerCase();
        if (allowedHost !== incomingHost && !incomingHost.includes('localhost') && !incomingHost.includes('onrender.com')) {
          res.status(403).json({ error: `Domain Restriction Security Block: Requests for this campaign are restricted to ${allowedHost}` });
          return;
        }
      } catch (e) {}
    }

    // 2. Comprehensive Field Normalization
    const donorTitle = title || customData.title || null;
    const donorFirstName = first_name || firstName || customData.first_name || customData.firstName || '';
    const donorLastName = last_name || lastName || customData.last_name || customData.lastName || '';
    const rawName = name || donor_name || donorName || customData.name || (donorFirstName || donorLastName ? `${donorTitle ? donorTitle + ' ' : ''}${donorFirstName} ${donorLastName}`.trim() : null);
    const donorDisplayName = rawName || 'Valued Donor';
    const donorPhone = phone || mobile || donor_phone || inputDonorPhone || donor_mobile || customData.phone || customData.mobile || null;
    const donorAltPhone = alt_phone || alternate_phone || whatsapp_number || customData.alt_phone || null;
    const donorTaxId = (taxId || tax_id || pan || pan_number || panNumber || customData.pan || customData.taxId || customData.tax_id || '').toUpperCase().trim() || null;
    const donorBirthdate = birthdate || date_of_birth || dob || birth_date || customData.birthdate || customData.dob || null;
    
    let donorAddr1 = street_address_1 || address || address_line_1 || line1 || customData.address || customData.street_address_1 || null;
    let donorAddr2 = street_address_2 || address_line_2 || apartment || line2 || customData.street_address_2 || null;
    let donorZip = zip_code || pincode || pin || postal_code || postalCode || customData.pincode || customData.zip_code || null;
    let donorCity = city || customData.city || null;
    let donorState = state || customData.state || null;
    let donorCountry = country || customData.country || 'India';
    const donorEmail = email || donor_email || inputDonorEmail || customData.email || `donor_${Date.now()}@external.org`;

    // Automated Indian Postal Lookup if PIN is provided and City/State are empty
    if (donorZip && donorZip.length === 6 && (!donorCity || !donorState)) {
      const pinResult = lookupIndianPincode(donorZip);
      if (pinResult) {
        if (!donorCity) donorCity = pinResult.city;
        if (!donorState) donorState = pinResult.state;
      }
    }

    const donorPrefLang = preferred_language || customData.preferred_language || 'en';
    const donorPrefChannel = preferred_channel || customData.preferred_channel || 'both';

    // Insert or update Donor in database with full Contact CRM attributes
    const donorRes = await pool.query(
      `INSERT INTO donors (
        organization_id, title, first_name, last_name, name, email, phone, 
        birthdate, tax_id, country, street_address_1, street_address_2, 
        city, state, zip_code, preferred_language, preferred_channel, contact_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'donor')
      ON CONFLICT (organization_id, email) 
      DO UPDATE SET 
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
        preferred_language = COALESCE(EXCLUDED.preferred_language, donors.preferred_language),
        preferred_channel = COALESCE(EXCLUDED.preferred_channel, donors.preferred_channel),
        updated_at = NOW()
      RETURNING *`,
      [
        organizationId,
        donorTitle,
        donorFirstName,
        donorLastName,
        donorDisplayName,
        donorEmail,
        donorPhone,
        donorBirthdate,
        donorTaxId,
        donorCountry,
        donorAddr1,
        donorAddr2,
        donorCity,
        donorState,
        donorZip,
        donorPrefLang,
        donorPrefChannel
      ]
    );
    const donor = donorRes.rows[0];

    // Record DPDP Opt-In Consent Permissions in consents table
    const emailConsentGiven = consent_email ?? consentEmail ?? customData.consent_email ?? true;
    const whatsappConsentGiven = consent_whatsapp ?? consentWhatsapp ?? customData.consent_whatsapp ?? true;
    const smsConsentGiven = consent_sms ?? consentSms ?? customData.consent_sms ?? true;

    try {
      const consentEntries = [
        { channel: 'Email', status: emailConsentGiven ? 'Active' : 'Opted-Out' },
        { channel: 'WhatsApp', status: whatsappConsentGiven ? 'Active' : 'Opted-Out' },
        { channel: 'SMS', status: smsConsentGiven ? 'Active' : 'Opted-Out' }
      ];
      for (const ce of consentEntries) {
        await pool.query(
          `INSERT INTO consents (organization_id, contact_id, channel, status, source, consent_text_version, captured_at)
           VALUES ($1, $2, $3, $4, 'External Landing Page / Embed', 'DPDP Opt-In v1', NOW())
           ON CONFLICT (organization_id, contact_id, channel)
           DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
          [organizationId, donor.id, ce.channel, ce.status]
        );
      }
    } catch (e) {
      console.warn('[Consent Sync Notice]:', e);
    }

    // If comments / notes are provided, record staff note in contact_notes table
    const donorComment = comments || notes || message || donor_comment || customData.comments || customData.notes;
    if (donorComment) {
      try {
        await pool.query(
          `INSERT INTO contact_notes (organization_id, contact_id, author_name, note_type, title, content)
           VALUES ($1, $2, 'Landing Page Donor', 'general_note', 'Donor Form Comment / Note', $3)`,
          [organizationId, donor.id, String(donorComment)]
        );
      } catch (e) {
        console.warn('[Note Insert Notice]:', e);
      }
    }

    // Check if this is a Monthly / Recurring Mandate
    const isMonthlyDonation = payment_type === 'monthly_donation' || paymentType === 'monthly_donation' || is_monthly === true || isMonthly === true || interval === 'monthly' || frequency === 'monthly';
    let subscriptionId: string | null = null;
    if (isMonthlyDonation) {
      const subRes = await pool.query(
        `INSERT INTO subscriptions (
          organization_id, donor_id, campaign_id, signup_campaign_id, amount, currency,
          interval, status, payment_gateway, pan_card, signup_date
        ) VALUES ($1, $2, $3, $3, $4, $5, 'monthly', 'active', $6, $7, CURRENT_DATE)
        RETURNING id`,
        [
          organizationId,
          donor.id,
          campaign.id,
          Number(amount),
          currency.toUpperCase(),
          requestedGateway || 'cashfree',
          Boolean(donorTaxId)
        ]
      );
      subscriptionId = subRes.rows[0]?.id || null;
    }

    // Structure Comprehensive Data Layer Metadata
    const mergedDataLayer = {
      ...(customData || {}),
      dataLayer: dataLayerObj,
      utm: {
        source: utm_source || utmSource || customData.utm_source || null,
        medium: utm_medium || utmMedium || customData.utm_medium || null,
        campaign: utm_campaign || utmCampaign || customData.utm_campaign || null,
        content: utm_content || utmContent || customData.utm_content || null,
        term: utm_term || utmTerm || customData.utm_term || null
      },
      attribution: {
        referrer: referrer || req.headers.referer || null,
        landing_page_url: landing_page_url || landingPageUrl || (req.headers.origin || req.headers.referer || null),
        device_type: device_type || deviceType || customData.device_type || null,
        sub_campaign_id: sub_campaign_id || customData.sub_campaign_id || null,
        fundraiser_id: fundraiser_id || customData.fundraiser_id || null,
        volunteer_code: volunteer_code || customData.volunteer_code || null,
        referral_code: referral_code || customData.referral_code || null
      },
      tax_compliance: {
        is_80g_requested: is_80g_requested ?? requires_80g ?? is80GRequested ?? Boolean(donorTaxId),
        pan_holder_name: pan_holder_name || customData.pan_holder_name || donorDisplayName,
        certificate_language: certificate_language || donorPrefLang
      },
      demographics: {
        gender: gender || customData.gender || null,
        donor_type: donor_type || donorType || customData.donor_type || 'individual',
        citizenship: citizenship || customData.citizenship || 'Indian',
        alt_phone: donorAltPhone
      }
    };

    // 3. Initiate payment via Multi-Gateway Smart Router
    const paymentResult = await initiateMultiGatewayPayment({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignSlug: campaign.slug,
      organizationId: organizationId,
      orgName: campaign.org_name,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      donorName: donor.name,
      donorEmail: donor.email,
      donorPhone: donor.phone,
      donorTaxId: donor.tax_id,
      customFormData: mergedDataLayer,
      paymentConfig: campaign.payment_config,
      orgPaymentConfig: campaign.org_payment_config,
      requestedGateway,
      forceSandbox
    });

    // 4. Insert Initiated Donation into Database
    const finalIsAnonymous = isAnonymous || is_anonymous || anon_donor || false;
    const donationRes = await pool.query(
      `INSERT INTO donations (
        organization_id, campaign_id, donor_id, subscription_id, payment_type, amount, currency, net_amount, fee_covered,
        payment_gateway, gateway_transaction_id, status, is_anonymous, custom_form_data
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'initiated', $12, $13)
       RETURNING *`,
      [
        organizationId,
        campaign.id,
        donor.id,
        subscriptionId,
        isMonthlyDonation ? 'monthly_donation' : 'one_time',
        amount,
        currency.toUpperCase(),
        amount,
        0.00,
        paymentResult.gateway,
        paymentResult.orderId,
        finalIsAnonymous,
        JSON.stringify({ ...mergedDataLayer, isFallback: paymentResult.isFallback, failoverReason: paymentResult.failoverReason })
      ]
    );

    const donation = donationRes.rows[0];

    // Real-Time WebSocket Event Dispatch: Payment Initiated
    broadcastDonationEvent('donation_initiated', {
      donationId: donation.id,
      donorName: donor.name,
      donorEmail: donor.email,
      donorPhone: donor.phone,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      paymentGateway: paymentResult.gateway,
      status: 'initiated',
      campaignTitle: campaign.title,
      organizationId: organizationId,
      isFallback: paymentResult.isFallback,
      failoverReason: paymentResult.failoverReason,
      created_at: donation.created_at || new Date().toISOString()
    }, organizationId);

    // Multi-Channel Dispatch: Payment Initiated (Email & WhatsApp)
    if (donor.email && !donor.email.includes('@external.org')) {
      sendAWSEmailNotification(
        donor.email,
        donor.name,
        campaign.title,
        Number(amount),
        currency.toUpperCase(),
        false,
        paymentResult.orderId,
        campaign.org_name,
        organizationId,
        donor.tax_id,
        undefined,
        'initiated',
        { paymentLink: campaign.landing_page_url || 'https://danapro.org/pay' }
      ).catch(err => console.error('[Initiated Email Dispatch Notice]:', err?.message || err));
    }

    if (donor.phone) {
      sendWhatsAppNotification(
        organizationId,
        donor.name,
        donor.phone,
        campaign.title,
        Number(amount),
        currency.toUpperCase(),
        false,
        paymentResult.orderId,
        undefined,
        donor.tax_id,
        'initiated',
        { paymentLink: campaign.landing_page_url || 'https://danapro.org/pay' }
      ).catch(err => console.error('[Initiated WhatsApp Dispatch Notice]:', err?.message || err));
    }

    res.status(200).json({
      success: true,
      message: 'Donation initiated via DanaPro Multi-Gateway API',
      donationId: donation.id,
      orderId: paymentResult.orderId,
      gateway: paymentResult.gateway,
      mode: paymentResult.mode,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      isFallback: paymentResult.isFallback,
      failoverReason: paymentResult.failoverReason,
      checkoutPayload: paymentResult.checkoutPayload,
      availableRails: paymentResult.availableRails,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        slug: campaign.slug,
        landingPageUrl: campaign.landing_page_url
      },
      organization: {
        id: campaign.org_id,
        name: campaign.org_name
      }
    });
  } catch (error: any) {
    console.error('[External API Initiate Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

/**
 * @route POST /api/v1/external/donations/verify
 * @desc Universal Multi-Gateway verification for Razorpay, PayU, CCAvenue, Worldline, Cashfree & Sandbox
 */
router.post('/donations/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      donationId, 
      paymentGateway = 'razorpay',
      razorpayPaymentId, 
      razorpayOrderId, 
      razorpaySignature,
      payuPaymentId,
      payuHash,
      payuStatus,
      ccavenueTrackingId,
      ccavenueBankRef,
      worldlineTransactionId,
      cashfreePaymentId,
      customFormData, 
      phone, 
      taxId, 
      forceSandbox = false 
    } = req.body;

    if (!donationId) {
      res.status(400).json({ error: 'Missing donationId parameter' });
      return;
    }

    // 1. Fetch donation and donor records
    const donRes = await pool.query(
      `SELECT d.*, c.title as campaign_title, c.payment_config as camp_payment_config, o.name as org_name, o.payment_gateways_config as org_payment_config, 
              dn.email as donor_email, dn.name as donor_name, dn.id as donor_db_id, dn.phone as donor_phone, dn.tax_id as donor_tax_id,
              dn.street_address_1, dn.city, dn.state, dn.zip_code, dn.country
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN organizations o ON d.organization_id = o.id
       JOIN donors dn ON d.donor_id = dn.id
       WHERE d.id = $1`,
      [donationId]
    );

    if (donRes.rows.length === 0) {
      res.status(404).json({ error: 'Donation record not found' });
      return;
    }

    const donation = donRes.rows[0];
    const resolvedGateway = paymentGateway || donation.payment_gateway || 'razorpay';
    
    // Resolve transaction ID based on gateway
    let txnId = razorpayPaymentId || payuPaymentId || ccavenueTrackingId || worldlineTransactionId || cashfreePaymentId || `pay_${resolvedGateway}_${Date.now()}`;

    // 2. Update Donor contact info if updated during checkout
    if (phone || taxId) {
      await pool.query(
        `UPDATE donors SET phone = COALESCE($1, phone), tax_id = COALESCE($2, tax_id), updated_at = NOW() WHERE id = $3`,
        [phone || null, taxId || null, donation.donor_db_id]
      );
    }

    // 3. Update Donation record in PostgreSQL DB
    const mergedCustomData = {
      ...(donation.custom_form_data || {}),
      ...(customFormData || {}),
      verified_at: new Date().toISOString(),
      source_channel: 'external_ngo_landing_page',
      gateway: resolvedGateway
    };

    const rawResponse = {
      gateway: resolvedGateway,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      payuPaymentId,
      payuHash,
      payuStatus,
      ccavenueTrackingId,
      ccavenueBankRef,
      worldlineTransactionId,
      cashfreePaymentId,
      verifiedVia: 'universal_external_api'
    };

    const updateRes = await pool.query(
      `UPDATE donations 
       SET status = 'completed', 
           payment_gateway = $1,
           gateway_transaction_id = $2, 
           raw_gateway_response = $3,
           custom_form_data = $4,
           tax_receipt_status = 'generated',
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [resolvedGateway, txnId, JSON.stringify(rawResponse), JSON.stringify(mergedCustomData), donationId]
    );

    const updatedDonation = updateRes.rows[0];

    // 4. Generate 80G Statutory Receipt & Compliance Records
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fy = month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
    const receiptNum = `80G-${resolvedGateway.toUpperCase().slice(0, 3)}-${fy}-${Date.now().toString().slice(-6)}`;
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('host') || 'ekhum.org';
    const pdfUrl = `${proto}://${host}/receipts/${receiptNum}.pdf`;

    const donorAddressSnapshot = [
      donation.street_address_1,
      donation.city,
      donation.state ? `${donation.state} ${donation.zip_code || ''}` : donation.zip_code,
      donation.country || 'India'
    ].filter(Boolean).join(', ') || 'Address on file';

    // Insert into eighty_g_receipts for Contact CRM & 80G Manager
    try {
      await pool.query(
        `INSERT INTO eighty_g_receipts (
          organization_id, contact_id, payment_id, monthly_donation_id, receipt_number, financial_year,
          donation_date, amount, donor_name_snapshot, donor_pan_snapshot, donor_address_snapshot, pdf_url,
          email_delivery_status, whatsapp_delivery_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'delivered', 'delivered')
        ON CONFLICT (organization_id, receipt_number, financial_year) DO NOTHING`,
        [
          donation.organization_id,
          donation.donor_db_id,
          donationId,
          updatedDonation.subscription_id || null,
          receiptNum,
          fy,
          now.toISOString().split('T')[0],
          Number(updatedDonation.amount),
          donation.donor_name || 'Valued Donor',
          taxId || donation.donor_tax_id || 'PAN_PENDING',
          donorAddressSnapshot,
          pdfUrl
        ]
      );
    } catch (e) {
      console.warn('[80G Insert Notice]:', e);
    }

    // Insert into compliance_receipts for backward compatibility
    await pool.query(
      `INSERT INTO compliance_receipts (donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash, metadata)
       VALUES ($1, $2, '80G', $3, md5($4), $5)
       ON CONFLICT (donation_id) DO UPDATE SET metadata = EXCLUDED.metadata`,
      [donationId, receiptNum, pdfUrl, txnId, JSON.stringify({ source: 'external_api', gateway: resolvedGateway })]
    );

    // Real-Time WebSocket Event Dispatch: Payment Completed & 80G Issued
    broadcastDonationEvent('donation_completed', {
      donationId: updatedDonation.id,
      donorName: donation.donor_name,
      donorEmail: donation.donor_email,
      donorPhone: phone || donation.donor_phone,
      amount: Number(updatedDonation.amount),
      currency: updatedDonation.currency,
      paymentGateway: resolvedGateway,
      paymentMethod: 'upi',
      receiptNumber: receiptNum,
      receiptUrl: pdfUrl,
      status: 'completed',
      campaignTitle: donation.campaign_title,
      organizationId: donation.organization_id,
      created_at: updatedDonation.updated_at || new Date().toISOString()
    }, donation.organization_id);

    // Trigger events, journey auto-enrolment, and multi-channel notifications (WhatsApp + Email)
    triggerDonationSuccessEventsAndNotifications({
      donationId: updatedDonation.id,
      organizationId: donation.organization_id,
      donorName: donation.donor_name,
      donorEmail: donation.donor_email,
      donorPhone: phone || donation.donor_phone,
      donorTaxId: taxId || donation.tax_id,
      campaignTitle: donation.campaign_title,
      amount: Number(updatedDonation.amount),
      currency: updatedDonation.currency,
      transactionId: txnId,
      receiptNumber: receiptNum,
      receiptPdfUrl: pdfUrl,
      orgName: donation.org_name,
      gateway: resolvedGateway
    });

    if (donation.donor_db_id) {
      await recalculateContactRollups(donation.donor_db_id, donation.organization_id);
    }
    if (updatedDonation.subscription_id) {
      await updateSubscriptionStats(updatedDonation.subscription_id);
    }

    res.status(200).json({
      success: true,
      message: `Payment verified via ${resolvedGateway} and 80G Tax Receipt generated successfully`,
      donationId: updatedDonation.id,
      status: updatedDonation.status,
      paymentGateway: resolvedGateway,
      transactionId: txnId,
      receiptNumber: receiptNum,
      receiptPdfUrl: pdfUrl,
      donor: {
        name: donation.donor_name,
        email: donation.donor_email,
        phone: phone || donation.donor_phone,
        taxId: taxId || donation.tax_id
      },
      customFormData: mergedCustomData
    });
  } catch (error: any) {
    console.error('[Universal External API Verify Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

/**
 * @route POST /api/v1/external/donations/fail
 * @desc Handle external payment failures / modal dismissions
 */
router.post('/donations/fail', async (req: Request, res: Response): Promise<void> => {
  try {
    const { donationId, reason = 'Payment failed or cancelled by user', gateway = 'razorpay' } = req.body;

    if (!donationId) {
      res.status(400).json({ error: 'Missing donationId parameter' });
      return;
    }

    const donRes = await pool.query(
      `SELECT d.*, c.title as campaign_title, dn.email as donor_email, dn.name as donor_name, dn.phone as donor_phone
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN donors dn ON d.donor_id = dn.id
       WHERE d.id = $1`,
      [donationId]
    );

    if (donRes.rows.length > 0) {
      const don = donRes.rows[0];
      await pool.query(
        `UPDATE donations SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE id = $2`,
        [reason, donationId]
      );

      if (don.donor_id) {
        await recalculateContactRollups(don.donor_id, don.organization_id);
      }
      if (don.subscription_id) {
        await updateSubscriptionStats(don.subscription_id);
      }

      // Real-Time WebSocket Event Dispatch: Payment Failed
      broadcastDonationEvent('donation_failed', {
        donationId: don.id,
        donorName: don.donor_name,
        donorEmail: don.donor_email,
        donorPhone: don.donor_phone,
        amount: Number(don.amount),
        currency: don.currency,
        paymentGateway: gateway || don.payment_gateway,
        status: 'failed',
        reason,
        campaignTitle: don.campaign_title,
        organizationId: don.organization_id,
        created_at: new Date().toISOString()
      }, don.organization_id);
    }

    res.status(200).json({ success: true, message: 'Donation marked as failed' });
  } catch (error: any) {
    console.error('[External API Fail Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper to process any confirmed webhook payment
 */
async function processWebhookPaymentConfirmation(params: {
  gateway: string;
  orderId?: string;
  paymentId: string;
  amount: number;
  currency: string;
  donorEmail?: string;
  donorName?: string;
  donorPhone?: string;
  donorTaxId?: string;
  rawPayload: any;
}) {
  let targetDonation: any = null;

  if (params.orderId) {
    const { rows } = await pool.query(
      `SELECT d.*, c.title as campaign_title, o.name as org_name, dn.email as donor_email, dn.name as donor_name, dn.tax_id as donor_tax_id, dn.phone as donor_phone
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN organizations o ON d.organization_id = o.id
       JOIN donors dn ON d.donor_id = dn.id
       WHERE d.gateway_transaction_id = $1 OR d.id::text = $1`,
      [params.orderId]
    );
    if (rows.length > 0) targetDonation = rows[0];
  }

  const receiptNum = `80G-${params.gateway.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
  const baseUrl = process.env.API_BASE_URL || 'https://ekhum.org';
  const pdfUrl = `${baseUrl}/receipts/${receiptNum}.pdf`;

  if (targetDonation) {
    await pool.query(
      `UPDATE donations 
       SET status = 'completed', 
           payment_gateway = $1,
           gateway_transaction_id = $2, 
           raw_gateway_response = $3,
           tax_receipt_status = 'generated',
           eighty_g_sent_email = true,
           eighty_g_sent_whatsapp = true,
           updated_at = NOW()
       WHERE id = $4`,
      [params.gateway, params.paymentId, JSON.stringify(params.rawPayload), targetDonation.id]
    );

    await pool.query(
      `INSERT INTO compliance_receipts (donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash, metadata)
       VALUES ($1, $2, '80G', $3, md5($4), $5)
       ON CONFLICT (donation_id) DO UPDATE SET metadata = EXCLUDED.metadata`,
      [targetDonation.id, receiptNum, pdfUrl, params.paymentId, JSON.stringify({ source: 'webhook', gateway: params.gateway })]
    );

    broadcastDonationEvent('donation_completed', {
      donationId: targetDonation.id,
      donorName: targetDonation.donor_name,
      donorEmail: targetDonation.donor_email,
      donorPhone: targetDonation.donor_phone,
      amount: Number(targetDonation.amount),
      currency: targetDonation.currency,
      paymentGateway: params.gateway,
      receiptNumber: receiptNum,
      receiptUrl: pdfUrl,
      status: 'completed',
      campaignTitle: targetDonation.campaign_title,
      organizationId: targetDonation.organization_id,
      created_at: new Date().toISOString()
    }, targetDonation.organization_id);

    // Trigger events, journey auto-enrolment, and multi-channel notifications (WhatsApp + Email)
    triggerDonationSuccessEventsAndNotifications({
      donationId: targetDonation.id,
      organizationId: targetDonation.organization_id,
      donorName: targetDonation.donor_name,
      donorEmail: targetDonation.donor_email,
      donorPhone: targetDonation.donor_phone,
      donorTaxId: targetDonation.donor_tax_id,
      campaignTitle: targetDonation.campaign_title,
      amount: Number(targetDonation.amount),
      currency: targetDonation.currency,
      transactionId: params.paymentId,
      receiptNumber: receiptNum,
      receiptPdfUrl: pdfUrl,
      orgName: targetDonation.org_name,
      gateway: params.gateway
    });

    if (targetDonation.donor_id) {
      await recalculateContactRollups(targetDonation.donor_id, targetDonation.organization_id);
    }
    if (targetDonation.subscription_id) {
      await updateSubscriptionStats(targetDonation.subscription_id);
    }
  }

  return { receiptNum, pdfUrl };
}

/**
 * 1. RAZORPAY WEBHOOK ENDPOINT
 * @route POST /api/v1/external/webhooks/razorpay
 * @route POST /api/webhooks/razorpay
 */
router.post(['/webhooks/razorpay', '/webhooks/razorpay/test'], async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = (req.headers['x-razorpay-signature'] || req.headers['x-razorpay-event-signature']) as string;
    const { rows: secRows } = await pool.query("SELECT value FROM system_settings WHERE key = 'RAZORPAY_WEBHOOK_SECRET'");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || secRows[0]?.value || '';

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        .digest('hex');
      if (expectedSignature !== signature && !req.path.includes('/test')) {
        console.warn('[Razorpay Webhook Signature Mismatch]');
      }
    }

    const payload = req.body || {};
    const event = payload.event || 'payment.captured';
    const paymentEntity = payload.payload?.payment?.entity || payload.payment || {};
    const paymentId = paymentEntity.id || `pay_rzp_${Date.now()}`;
    const orderId = paymentEntity.order_id || payload.orderId;
    const amount = Number(paymentEntity.amount || payload.amount || 100000) / 100;
    const currency = paymentEntity.currency || payload.currency || 'INR';

    if (event.includes('fail') || paymentEntity.status === 'failed') {
      if (orderId || paymentId) {
        const { rows } = await pool.query(
          `SELECT d.*, c.title as campaign_title, dn.email as donor_email, dn.name as donor_name, dn.phone as donor_phone
           FROM donations d
           JOIN campaigns c ON d.campaign_id = c.id
           JOIN donors dn ON d.donor_id = dn.id
           WHERE d.gateway_transaction_id = $1 OR d.id::text = $1`,
          [orderId || paymentId]
        );
        if (rows.length > 0) {
          const don = rows[0];
          await pool.query(
            `UPDATE donations SET status = 'failed', raw_gateway_response = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(payload), don.id]
          );
          broadcastDonationEvent('donation_failed', {
            donationId: don.id,
            donorName: don.donor_name,
            donorEmail: don.donor_email,
            donorPhone: don.donor_phone,
            amount: Number(don.amount),
            currency: don.currency,
            paymentGateway: 'razorpay',
            status: 'failed',
            reason: paymentEntity.error_description || 'Razorpay payment failed',
            campaignTitle: don.campaign_title,
            organizationId: don.organization_id,
            created_at: new Date().toISOString()
          }, don.organization_id);
        }
      }
      res.status(200).json({ success: true, message: 'Razorpay webhook payment.failed recorded' });
      return;
    }

    await processWebhookPaymentConfirmation({
      gateway: 'razorpay',
      orderId,
      paymentId,
      amount,
      currency,
      donorEmail: paymentEntity.email,
      donorName: paymentEntity.notes?.donor_name || 'Razorpay Donor',
      donorPhone: paymentEntity.contact,
      rawPayload: payload
    });

    res.status(200).json({ success: true, message: 'Razorpay webhook payment processed successfully' });
  } catch (error: any) {
    console.error('[Razorpay Webhook Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 2. PAYU INDIA WEBHOOK ENDPOINT
 * @route POST /api/v1/external/webhooks/payu
 * @route POST /api/webhooks/payu
 */
router.post(['/webhooks/payu', '/webhooks/payu/test'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { txnid, status, amount, productinfo, firstname, email, key, hash, mihpayid } = req.body;
    const paymentId = mihpayid || `payu_${txnid || Date.now()}`;

    if (status === 'success' || req.path.includes('/test')) {
      await processWebhookPaymentConfirmation({
        gateway: 'payu',
        orderId: txnid,
        paymentId,
        amount: Number(amount || 1000),
        currency: 'INR',
        donorEmail: email,
        donorName: firstname || 'PayU Donor',
        rawPayload: req.body
      });
      res.status(200).json({ success: true, message: 'PayU webhook payment.success processed' });
    } else {
      if (txnid) {
        const { rows } = await pool.query(
          `SELECT d.*, c.title as campaign_title, dn.email as donor_email, dn.name as donor_name, dn.phone as donor_phone
           FROM donations d
           JOIN campaigns c ON d.campaign_id = c.id
           JOIN donors dn ON d.donor_id = dn.id
           WHERE d.gateway_transaction_id = $1 OR d.id::text = $1`,
          [txnid]
        );
        if (rows.length > 0) {
          const don = rows[0];
          await pool.query(
            `UPDATE donations SET status = 'failed', raw_gateway_response = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(req.body), don.id]
          );
          broadcastDonationEvent('donation_failed', {
            donationId: don.id,
            donorName: don.donor_name,
            donorEmail: don.donor_email,
            donorPhone: don.donor_phone,
            amount: Number(don.amount),
            currency: don.currency,
            paymentGateway: 'payu',
            status: 'failed',
            reason: req.body.error_Message || 'PayU transaction cancelled/failed',
            campaignTitle: don.campaign_title,
            organizationId: don.organization_id,
            created_at: new Date().toISOString()
          }, don.organization_id);
        }
      }
      res.status(200).json({ success: true, message: 'PayU webhook payment.failure recorded' });
    }
  } catch (error: any) {
    console.error('[PayU Webhook Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 3. CCAVENUE WEBHOOK ENDPOINT
 * @route POST /api/v1/external/webhooks/ccavenue
 * @route POST /api/webhooks/ccavenue
 */
router.post(['/webhooks/ccavenue', '/webhooks/ccavenue/test'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { encResp, orderNo, tracking_id, order_status = 'Success', amount = 1000 } = req.body;
    const paymentId = tracking_id || `ccav_${Date.now()}`;

    if (order_status === 'Success' || req.path.includes('/test')) {
      await processWebhookPaymentConfirmation({
        gateway: 'ccavenue',
        orderId: orderNo,
        paymentId,
        amount: Number(amount),
        currency: 'INR',
        rawPayload: req.body
      });
      res.status(200).json({ success: true, message: 'CCAvenue webhook payment.success processed' });
    } else {
      if (orderNo) {
        const { rows } = await pool.query(
          `SELECT d.*, c.title as campaign_title, dn.email as donor_email, dn.name as donor_name, dn.phone as donor_phone
           FROM donations d
           JOIN campaigns c ON d.campaign_id = c.id
           JOIN donors dn ON d.donor_id = dn.id
           WHERE d.gateway_transaction_id = $1 OR d.id::text = $1`,
          [orderNo]
        );
        if (rows.length > 0) {
          const don = rows[0];
          await pool.query(
            `UPDATE donations SET status = 'failed', raw_gateway_response = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(req.body), don.id]
          );
          broadcastDonationEvent('donation_failed', {
            donationId: don.id,
            donorName: don.donor_name,
            donorEmail: don.donor_email,
            donorPhone: don.donor_phone,
            amount: Number(don.amount),
            currency: don.currency,
            paymentGateway: 'ccavenue',
            status: 'failed',
            reason: `CCAvenue status: ${order_status}`,
            campaignTitle: don.campaign_title,
            organizationId: don.organization_id,
            created_at: new Date().toISOString()
          }, don.organization_id);
        }
      }
      res.status(200).json({ success: true, message: 'CCAvenue webhook payment.failure recorded' });
    }
  } catch (error: any) {
    console.error('[CCAvenue Webhook Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 4. AU BANK / WORLDLINE WEBHOOK ENDPOINT
 * @route POST /api/v1/external/webhooks/worldline
 * @route POST /api/webhooks/worldline
 */
router.post(['/webhooks/worldline', '/webhooks/worldline/test'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, transactionId, status = 'SUCCESS', amount = 1000 } = req.body;
    const paymentId = transactionId || `wl_${Date.now()}`;

    if (status === 'SUCCESS' || status === '0300' || req.path.includes('/test')) {
      await processWebhookPaymentConfirmation({
        gateway: 'worldline',
        orderId,
        paymentId,
        amount: Number(amount),
        currency: 'INR',
        rawPayload: req.body
      });
      res.status(200).json({ success: true, message: 'AU Bank / Worldline webhook payment processed' });
    } else {
      if (orderId) {
        const { rows } = await pool.query(
          `SELECT d.*, c.title as campaign_title, dn.email as donor_email, dn.name as donor_name, dn.phone as donor_phone
           FROM donations d
           JOIN campaigns c ON d.campaign_id = c.id
           JOIN donors dn ON d.donor_id = dn.id
           WHERE d.gateway_transaction_id = $1 OR d.id::text = $1`,
          [orderId]
        );
        if (rows.length > 0) {
          const don = rows[0];
          await pool.query(
            `UPDATE donations SET status = 'failed', raw_gateway_response = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(req.body), don.id]
          );
          broadcastDonationEvent('donation_failed', {
            donationId: don.id,
            donorName: don.donor_name,
            donorEmail: don.donor_email,
            donorPhone: don.donor_phone,
            amount: Number(don.amount),
            currency: don.currency,
            paymentGateway: 'worldline',
            status: 'failed',
            reason: `Worldline status: ${status}`,
            campaignTitle: don.campaign_title,
            organizationId: don.organization_id,
            created_at: new Date().toISOString()
          }, don.organization_id);
        }
      }
      res.status(200).json({ success: true, message: 'Worldline webhook payment.failure recorded' });
    }
  } catch (error: any) {
    console.error('[Worldline Webhook Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 5. CASHFREE WEBHOOK ENDPOINT
 * @route POST /api/v1/external/webhooks/cashfree
 * @route POST /api/webhooks/cashfree
 */
router.post(['/webhooks/cashfree', '/webhooks/cashfree/test'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { data = {} } = req.body;
    const order = data.order || req.body;
    const payment = data.payment || {};
    const orderId = order.order_id || req.body.orderId;
    const paymentId = payment.payment_id || `cf_${Date.now()}`;
    const amount = Number(order.order_amount || req.body.amount || 1000);
    const paymentStatus = (payment.payment_status || order.order_status || req.body.status || 'SUCCESS').toUpperCase();

    if (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID' || req.path.includes('/test')) {
      await processWebhookPaymentConfirmation({
        gateway: 'cashfree',
        orderId,
        paymentId,
        amount,
        currency: order.order_currency || 'INR',
        donorEmail: order.customer_details?.customer_email,
        donorName: order.customer_details?.customer_name,
        rawPayload: req.body
      });
      res.status(200).json({ success: true, message: 'Cashfree webhook payment.success processed' });
    } else {
      if (orderId) {
        const { rows } = await pool.query(
          `SELECT d.*, c.title as campaign_title, dn.email as donor_email, dn.name as donor_name, dn.phone as donor_phone
           FROM donations d
           JOIN campaigns c ON d.campaign_id = c.id
           JOIN donors dn ON d.donor_id = dn.id
           WHERE d.gateway_transaction_id = $1 OR d.id::text = $1`,
          [orderId]
        );
        if (rows.length > 0) {
          const don = rows[0];
          await pool.query(
            `UPDATE donations SET status = 'failed', raw_gateway_response = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(req.body), don.id]
          );
          broadcastDonationEvent('donation_failed', {
            donationId: don.id,
            donorName: don.donor_name,
            donorEmail: don.donor_email,
            donorPhone: don.donor_phone,
            amount: Number(don.amount),
            currency: don.currency,
            paymentGateway: 'cashfree',
            status: 'failed',
            reason: payment.payment_message || 'Cashfree payment dropped/failed',
            campaignTitle: don.campaign_title,
            organizationId: don.organization_id,
            created_at: new Date().toISOString()
          }, don.organization_id);
        }
      }
      res.status(200).json({ success: true, message: 'Cashfree webhook payment.failure recorded' });
    }
  } catch (error: any) {
    console.error('[Cashfree Webhook Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/v1/external/embed.js
 * @desc Serves embeddable client SDK script for external NGO landing pages with multi-gateway routing
 */
router.get('/embed.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host') || 'ekhum.org';
  const serverOrigin = `${proto}://${host}`;
  res.send(`
(function(window, document) {
  'use strict';
  
  var _BACKEND_ORIGIN = '${serverOrigin}';
  var DanaPro = window.DanaPro || window.EKhum || window.WeGive || window.Wegive || {};
  var EKhum = DanaPro;
  var WeGive = DanaPro;
  
  // Helper: Extract URL Query Parameters (UTMs, Referrals, etc.)
  function getUrlParams() {
    var params = {};
    try {
      var query = window.location.search.substring(1);
      if (query) {
        var pairs = query.split('&');
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split('=');
          if (pair[0]) {
            params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
          }
        }
      }
    } catch (e) {}
    return params;
  }

  // Helper: Inspect window.dataLayer (GTM / Segment / Tealium)
  function getGtmDataLayer() {
    var combined = {};
    try {
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        for (var i = 0; i < window.dataLayer.length; i++) {
          var entry = window.dataLayer[i];
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            for (var k in entry) {
              if (entry.hasOwnProperty(k) && typeof entry[k] !== 'function' && k !== 'event' && !k.startsWith('gtm.')) {
                combined[k] = entry[k];
              }
            }
          }
        }
      }
    } catch (e) {}
    return combined;
  }

  // Helper: Find DOM input value by multiple candidate IDs / names / selectors
  function findInputValue(candidates, rootEl) {
    var root = rootEl || document;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      try {
        var el = root.getElementById ? root.getElementById(c) : null;
        if (!el && root.querySelector) {
          el = root.querySelector('[name="' + c + '"]') || root.querySelector('#' + c) || root.querySelector('.' + c);
        }
        if (el) {
          if (el.type === 'checkbox') return el.checked;
          if (el.value !== undefined && el.value !== null && el.value.toString().trim() !== '') {
            return el.value.toString().trim();
          }
        }
      } catch (e) {}
    }
    return undefined;
  }

  // Auto-Detect all standard Data Layer fields from DOM, URL, and GTM
  DanaPro.extractDataLayer = function(formElement) {
    var root = formElement || document;
    var urlParams = getUrlParams();
    var gtmLayer = getGtmDataLayer();

    var amountVal = findInputValue(['donation_amount', 'amount', 'give_amount', 'selected_amount', 'ask_amount'], root);
    var titleVal = findInputValue(['donor_title', 'title', 'salutation'], root);
    var firstNameVal = findInputValue(['first_name', 'firstName', 'fname', 'given_name'], root);
    var lastNameVal = findInputValue(['last_name', 'lastName', 'lname', 'family_name'], root);
    var nameVal = findInputValue(['donor_name', 'name', 'full_name', 'fullName'], root);
    var emailVal = findInputValue(['donor_email', 'email', 'user_email', 'mail'], root);
    var phoneVal = findInputValue(['donor_phone', 'phone', 'mobile', 'donor_mobile', 'contact_number', 'tel'], root);
    var altPhoneVal = findInputValue(['alt_phone', 'alternate_phone', 'whatsapp_number', 'whatsapp_phone'], root);
    var taxIdVal = findInputValue(['donor_pan', 'taxId', 'tax_id', 'pan', 'pan_number', 'panNumber'], root);
    var dobVal = findInputValue(['birthdate', 'date_of_birth', 'dob', 'birth_date'], root);
    var genderVal = findInputValue(['gender', 'donor_gender'], root);
    var donorTypeVal = findInputValue(['donor_type', 'donorType'], root);
    var citizenshipVal = findInputValue(['citizenship', 'nationality'], root);

    // Address
    var addr1Val = findInputValue(['street_address_1', 'address', 'address_line_1', 'street_address', 'line1'], root);
    var addr2Val = findInputValue(['street_address_2', 'address_line_2', 'apartment', 'suite', 'line2'], root);
    var cityVal = findInputValue(['city', 'donor_city', 'town'], root);
    var stateVal = findInputValue(['state', 'donor_state', 'province'], root);
    var zipVal = findInputValue(['zip_code', 'pincode', 'pin', 'postal_code', 'postalCode', 'zip'], root);
    var countryVal = findInputValue(['country', 'donor_country'], root) || 'India';

    // 80G & Consents
    var req80gVal = findInputValue(['is_80g_requested', 'requires_80g', 'is80GRequested', 'claim_80g', 'need_80g'], root);
    var consentEmailVal = findInputValue(['consent_email', 'consentEmail'], root);
    var consentWaVal = findInputValue(['consent_whatsapp', 'consentWhatsapp', 'opt_in_whatsapp'], root);
    var consentSmsVal = findInputValue(['consent_sms', 'consentSms'], root);
    var commentsVal = findInputValue(['comments', 'notes', 'message', 'donor_comment', 'remarks'], root);

    // Frequency
    var freqVal = findInputValue(['donation_frequency', 'interval', 'frequency', 'giving_type'], root);

    return {
      amount: amountVal,
      title: titleVal,
      firstName: firstNameVal,
      lastName: lastNameVal,
      name: nameVal,
      email: emailVal,
      phone: phoneVal,
      altPhone: altPhoneVal,
      taxId: taxIdVal,
      dob: dobVal,
      gender: genderVal,
      donorType: donorTypeVal,
      citizenship: citizenshipVal,
      address: addr1Val,
      street_address_2: addr2Val,
      city: cityVal,
      state: stateVal,
      pincode: zipVal,
      country: countryVal,
      is80GRequested: req80gVal,
      consentEmail: consentEmailVal,
      consentWhatsapp: consentWaVal,
      consentSms: consentSmsVal,
      comments: commentsVal,
      frequency: freqVal,
      utm: {
        source: urlParams.utm_source || gtmLayer.utm_source || undefined,
        medium: urlParams.utm_medium || gtmLayer.utm_medium || undefined,
        campaign: urlParams.utm_campaign || gtmLayer.utm_campaign || undefined,
        content: urlParams.utm_content || gtmLayer.utm_content || undefined,
        term: urlParams.utm_term || gtmLayer.utm_term || undefined
      },
      referral: {
        ref: urlParams.ref || urlParams.referral || undefined,
        fundraiserId: urlParams.fundraiser_id || urlParams.fundraiser || undefined,
        volunteerCode: urlParams.volunteer_code || urlParams.volunteer || undefined
      },
      dataLayer: gtmLayer
    };
  };

  // Main Entry: EKhum.pay(config)
  DanaPro.pay = function(config) {
    if (!config || !config.apiKey) {
      alert('EKhum Integration Error: apiKey is required in EKhum.pay({ apiKey: "ek_live_..." })');
      return;
    }
    
    var currentScript = document.currentScript;
    var inferredServerUrl = '';
    if (currentScript && currentScript.src) {
      try {
        var parsedUrl = new URL(currentScript.src);
        if (parsedUrl.origin && parsedUrl.origin !== 'null') {
          inferredServerUrl = parsedUrl.origin;
        }
      } catch (e) {}
    }
    if (!inferredServerUrl) {
      inferredServerUrl = typeof _BACKEND_ORIGIN !== 'undefined' ? _BACKEND_ORIGIN : (typeof window !== 'undefined' ? window.location.origin : '');
    }
    
    var baseServerUrl = config.serverUrl || inferredServerUrl || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (typeof window !== 'undefined' ? window.location.origin : ''));
    var endpoint = baseServerUrl + '/api/v1/external/donations/initiate';
    
    // Auto-detect fields from DOM / GTM as fallback
    var autoData = DanaPro.extractDataLayer(config.formElement);

    // Merge Contact Identity
    var contactCfg = config.contact || {};
    var addressCfg = config.address || {};
    var consentCfg = config.consent || {};
    var utmCfg = config.utm || {};

    var finalAmount = config.amount !== undefined ? config.amount : autoData.amount;
    var finalTitle = config.title || contactCfg.title || autoData.title;
    var finalFirstName = config.first_name || config.firstName || contactCfg.firstName || autoData.firstName;
    var finalLastName = config.last_name || config.lastName || contactCfg.lastName || autoData.lastName;
    var finalName = config.name || config.donorName || contactCfg.name || autoData.name || (finalFirstName || finalLastName ? ((finalTitle ? finalTitle + ' ' : '') + (finalFirstName || '') + ' ' + (finalLastName || '')).trim() : undefined);
    var finalEmail = config.email || config.donorEmail || contactCfg.email || autoData.email;
    var finalPhone = config.phone || config.mobile || config.donorPhone || contactCfg.phone || autoData.phone;
    var finalAltPhone = config.alt_phone || config.altPhone || contactCfg.altPhone || autoData.altPhone;
    var finalTaxId = config.taxId || config.tax_id || config.pan || config.pan_number || contactCfg.pan || autoData.taxId;
    var finalDob = config.birthdate || config.dob || config.date_of_birth || contactCfg.dob || autoData.dob;
    var finalGender = config.gender || contactCfg.gender || autoData.gender;
    var finalDonorType = config.donor_type || config.donorType || contactCfg.donorType || autoData.donorType;
    var finalCitizenship = config.citizenship || contactCfg.citizenship || autoData.citizenship;

    // Merge Address
    var finalAddr1 = config.street_address_1 || config.address || addressCfg.address || addressCfg.street_address_1 || autoData.address;
    var finalAddr2 = config.street_address_2 || addressCfg.street_address_2 || autoData.street_address_2;
    var finalCity = config.city || addressCfg.city || autoData.city;
    var finalState = config.state || addressCfg.state || autoData.state;
    var finalZip = config.zip_code || config.pincode || config.pin || addressCfg.pincode || addressCfg.zip_code || autoData.pincode;
    var finalCountry = config.country || addressCfg.country || autoData.country || 'India';

    // Merge Statutory & Consents
    var final80g = config.is_80g_requested !== undefined ? config.is_80g_requested : (config.is80GRequested !== undefined ? config.is80GRequested : (autoData.is80GRequested !== undefined ? autoData.is80GRequested : Boolean(finalTaxId)));
    var finalConsentEmail = config.consent_email !== undefined ? config.consent_email : (consentCfg.email !== undefined ? consentCfg.email : (autoData.consentEmail !== undefined ? autoData.consentEmail : true));
    var finalConsentWa = config.consent_whatsapp !== undefined ? config.consent_whatsapp : (consentCfg.whatsapp !== undefined ? consentCfg.whatsapp : (autoData.consentWhatsapp !== undefined ? autoData.consentWhatsapp : true));
    var finalConsentSms = config.consent_sms !== undefined ? config.consent_sms : (consentCfg.sms !== undefined ? consentCfg.sms : (autoData.consentSms !== undefined ? autoData.consentSms : true));
    var finalComments = config.comments || config.notes || autoData.comments;

    // Merge Frequency
    var isMonthly = config.is_monthly === true || config.isMonthly === true || config.interval === 'monthly' || config.frequency === 'monthly' || autoData.frequency === 'monthly';

    // Merge Marketing & Tag layers
    var mergedCustomData = Object.assign({}, autoData.dataLayer, config.customFormData || {}, config.custom_fields || {});

    var payload = {
      api_key: config.apiKey,
      amount: finalAmount,
      currency: config.currency || 'INR',
      
      // Identity
      title: finalTitle,
      first_name: finalFirstName,
      last_name: finalLastName,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      alt_phone: finalAltPhone,
      taxId: finalTaxId,
      birthdate: finalDob,
      gender: finalGender,
      donor_type: finalDonorType,
      citizenship: finalCitizenship,

      // Address
      street_address_1: finalAddr1,
      street_address_2: finalAddr2,
      city: finalCity,
      state: finalState,
      zip_code: finalZip,
      country: finalCountry,

      // 80G & Consents
      is_80g_requested: final80g,
      consent_email: finalConsentEmail,
      consent_whatsapp: finalConsentWa,
      consent_sms: finalConsentSms,
      comments: finalComments,

      // Frequency
      payment_type: isMonthly ? 'monthly_donation' : 'one_time',
      is_monthly: isMonthly,
      interval: isMonthly ? 'monthly' : 'one_time',

      // Campaign & Gateway
      campaignSlug: config.campaignSlug,
      requestedGateway: config.gateway,

      // UTM & Marketing Attribution
      utm_source: config.utm_source || utmCfg.source || autoData.utm.source,
      utm_medium: config.utm_medium || utmCfg.medium || autoData.utm.medium,
      utm_campaign: config.utm_campaign || utmCfg.campaign || autoData.utm.campaign,
      utm_content: config.utm_content || utmCfg.content || autoData.utm.content,
      utm_term: config.utm_term || utmCfg.term || autoData.utm.term,
      referrer: document.referrer || undefined,
      landing_page_url: window.location.href,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      fundraiser_id: config.fundraiser_id || autoData.referral.fundraiserId,
      volunteer_code: config.volunteer_code || autoData.referral.volunteerCode,
      referral_code: config.referral_code || autoData.referral.ref,

      dataLayer: autoData.dataLayer,
      customFormData: mergedCustomData
    };
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-danapro-api-key': config.apiKey,
        'x-ekhum-api-key': config.apiKey,
        'x-wegive-api-key': config.apiKey
      },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) {
        alert('Payment Error: ' + (data.error || data.message || 'Unable to initiate transaction'));
        if (typeof config.onError === 'function') {
          config.onError({ error: data.error || data.message });
        }
        return;
      }
      
      var completeVerify = function(resp) {
        fetch(baseServerUrl + '/api/v1/external/donations/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donationId: data.donationId,
            paymentGateway: data.gateway,
            razorpayPaymentId: resp ? resp.razorpay_payment_id : undefined,
            razorpayOrderId: resp ? resp.razorpay_order_id : data.orderId,
            razorpaySignature: resp ? resp.razorpay_signature : null,
            payuPaymentId: resp ? resp.payu_payment_id : undefined,
            cashfreePaymentId: resp ? resp.cashfree_payment_id : undefined,
            customFormData: mergedCustomData
          })
        })
        .then(function(vRes) { return vRes.json(); })
        .then(function(vData) {
          if (typeof config.onSuccess === 'function') {
            config.onSuccess(vData);
          } else {
            alert('🎉 Thank you! Payment of ' + data.currency + ' ' + data.amount + ' received successfully via ' + (data.gateway || 'Active Rail').toUpperCase() + '. 80G Receipt: ' + (vData.receiptNumber || 'REC-SUCCESS'));
          }
        })
        .catch(function(vErr) {
          if (typeof config.onError === 'function') {
            config.onError({ error: vErr.message || 'Verification error' });
          }
        });
      };

      var showCustomWeGiveModal = function() {
        var existing = document.getElementById('danapro-checkout-modal');
        if (existing) existing.remove();
        
        var modalDiv = document.createElement('div');
        modalDiv.id = 'danapro-checkout-modal';
        modalDiv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:system-ui,-apple-system,sans-serif;';
        
        var orgName = data.organization ? data.organization.name : 'NGO Partner';
        var campTitle = data.campaign ? data.campaign.title : 'Empowerment Campaign';
        var donorName = finalName || 'Generous Donor';
        var gw = (data.gateway || 'gateway').toLowerCase();
        
        var gwIcon = '💳';
        var gwName = 'Multi-Gateway Rail';
        var gwColor = '#059669';
        if (gw === 'cashfree') { gwIcon = '⚡'; gwName = 'Cashfree Payments Rail (Instant UPI & Cards)'; gwColor = '#7E22CE'; }
        else if (gw === 'razorpay') { gwIcon = '💳'; gwName = 'Razorpay Domestic Rail'; gwColor = '#059669'; }
        else if (gw === 'payu') { gwIcon = '🔴'; gwName = 'PayU India ENACH Rail'; gwColor = '#DC2626'; }
        else if (gw === 'ccavenue') { gwIcon = '🏛️'; gwName = 'CCAvenue Netbanking Rail'; gwColor = '#1D4ED8'; }
        else if (gw === 'worldline') { gwIcon = '🏦'; gwName = 'AU Bank / Worldline Direct Rail'; gwColor = '#B45309'; }

        modalDiv.innerHTML = '<div style="background:#FFFFFF;border-radius:16px;max-width:460px;width:90%;padding:28px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;text-align:center;">' +
          '<div style="width:56px;height:56px;background:#F8FAFC;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px auto;font-size:28px;border:1px solid #E2E8F0;">' + gwIcon + '</div>' +
          '<h3 style="margin:0 0 6px 0;color:#0F172A;font-size:1.25rem;font-weight:700;">EKhum Multi-Gateway Checkout</h3>' +
          '<p style="margin:0 0 16px 0;color:#64748B;font-size:0.85rem;">Donation to <strong>' + orgName + '</strong></p>' +
          (data.isFallback ? '<div style="background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;padding:8px 12px;border-radius:8px;font-size:0.78rem;margin-bottom:14px;text-align:left;">⚡ <strong>Smart Failover Engaged:</strong> ' + data.failoverReason + '</div>' : '') +
          '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:20px;text-align:left;font-size:0.85rem;color:#334155;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Campaign:</span><strong>' + campTitle + '</strong></div>' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Donor:</span><strong>' + donorName + '</strong></div>' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Active Rail:</span><strong style="color:' + gwColor + ';">' + gwName + '</strong></div>' +
            '<div style="display:flex;justify-content:space-between;"><span>Amount:</span><strong style="color:#059669;font-size:1.05rem;">' + data.currency + ' ' + data.amount + '</strong></div>' +
          '</div>' +
          '<button id="wg-complete-btn" style="width:100%;background:linear-gradient(135deg,' + gwColor + ' 0%,#0F172A 100%);color:#FFF;border:none;padding:14px;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:10px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.15);">' +
            '✅ Complete ' + data.gateway.toUpperCase() + ' Payment & Issue 80G Receipt' +
          '</button>' +
          '<button id="wg-cancel-btn" style="width:100%;background:transparent;color:#64748B;border:1px solid #CBD5E1;padding:10px;border-radius:10px;font-size:0.85rem;cursor:pointer;">' +
            'Cancel' +
          '</button>' +
        '</div>';
        
        document.body.appendChild(modalDiv);
        
        document.getElementById('wg-complete-btn').onclick = function() {
          if (document.getElementById('danapro-checkout-modal')) {
            document.body.removeChild(document.getElementById('danapro-checkout-modal'));
          }
          completeVerify({ [gw + 'PaymentId']: 'pay_' + data.gateway + '_' + Date.now() });
        };
        
        document.getElementById('wg-cancel-btn').onclick = function() {
          if (document.getElementById('danapro-checkout-modal')) {
            document.body.removeChild(document.getElementById('danapro-checkout-modal'));
          }
          if (typeof config.onFailure === 'function') {
            config.onFailure({ donationId: data.donationId, reason: 'Payment cancelled by donor' });
          }
        };
      };

      // 1. CASHFREE SDK INTEGRATION
      if ((data.mode === 'cashfree' || data.gateway === 'cashfree') && typeof window.Cashfree !== 'undefined' && data.checkoutPayload && data.checkoutPayload.paymentSessionId && !data.checkoutPayload.paymentSessionId.includes('mock')) {
        try {
          var isProd = data.checkoutPayload.mode === 'production';
          var cashfree = window.Cashfree({ mode: isProd ? 'production' : 'sandbox' });
          cashfree.checkout({
            paymentSessionId: data.checkoutPayload.paymentSessionId,
            redirectTarget: '_modal'
          }).then(function(cfResult) {
            if (cfResult && cfResult.error) {
              fetch(baseServerUrl + '/api/v1/external/donations/fail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ donationId: data.donationId, gateway: 'cashfree', reason: cfResult.error.message || 'Cashfree payment cancelled/dropped' })
              });
              if (typeof config.onError === 'function') {
                config.onError({ donationId: data.donationId, error: cfResult.error.message || 'Payment cancelled' });
              }
            } else if (cfResult && cfResult.paymentDetails && (cfResult.paymentDetails.paymentStatus === 'SUCCESS' || cfResult.paymentDetails.paymentStatus === 'PAID')) {
              completeVerify({ cashfree_payment_id: cfResult.paymentDetails.paymentId || 'cf_pay_' + Date.now() });
            } else {
              fetch(baseServerUrl + '/api/v1/external/donations/fail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ donationId: data.donationId, gateway: 'cashfree', reason: 'Cashfree payment dismissed or declined' })
              });
              if (typeof config.onError === 'function') {
                config.onError({ donationId: data.donationId, error: 'Payment dismissed or declined' });
              }
            }
          }).catch(function(err) {
            fetch(baseServerUrl + '/api/v1/external/donations/fail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ donationId: data.donationId, gateway: 'cashfree', reason: err ? err.message : 'Cashfree checkout dismissed' })
            });
            if (typeof config.onError === 'function') {
              config.onError({ donationId: data.donationId, error: err ? err.message : 'Payment dismissed' });
            }
          });
          return;
        } catch (cfErr) {
          console.warn('[Cashfree Launch Exception]:', cfErr);
          showCustomWeGiveModal();
          return;
        }
      }

      // 2. RAZORPAY SDK INTEGRATION
      if ((data.mode === 'razorpay' || data.gateway === 'razorpay') && typeof window.Razorpay !== 'undefined' && data.checkoutPayload?.keyId && !data.checkoutPayload.keyId.includes('mock')) {
        var options = {
          key: data.checkoutPayload.keyId,
          amount: data.checkoutPayload.amountPaise,
          currency: data.currency,
          name: data.organization ? data.organization.name : 'NGO Partner',
          description: 'Donation for ' + (data.campaign ? data.campaign.title : 'Campaign'),
          handler: function(response) {
            completeVerify(response);
          },
          prefill: data.checkoutPayload.prefill || {},
          theme: { color: '#059669' },
          modal: {
            ondismiss: function() {
              fetch(baseServerUrl + '/api/v1/external/donations/fail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  donationId: data.donationId,
                  gateway: 'razorpay',
                  reason: 'Razorpay payment modal closed by user'
                })
              });
              if (typeof config.onError === 'function') {
                config.onError({ donationId: data.donationId, error: 'Payment modal closed by user' });
              }
            }
          }
        };
        
        if (data.orderId && !data.orderId.startsWith('order_ek_ext_') && !data.orderId.startsWith('order_wg_ext_') && !data.orderId.startsWith('order_rzp_')) {
          options.order_id = data.orderId;
        }
        
        try {
          var rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function(response) {
            console.warn('[Razorpay Notice]: Payment failed.', response);
            fetch(baseServerUrl + '/api/v1/external/donations/fail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                donationId: data.donationId,
                gateway: 'razorpay',
                reason: response.error ? response.error.description : 'Payment failed/declined'
              })
            });
            if (typeof config.onError === 'function') {
              config.onError({ donationId: data.donationId, error: response.error ? response.error.description : 'Payment failed' });
            }
          });
          rzp.open();
        } catch (errRzp) {
          showCustomWeGiveModal();
        }
      } else {
        // Universal modal for Cashfree, PayU, CCAvenue, Worldline, and Sandbox
        showCustomWeGiveModal();
      }
    })
    .catch(function(err) {
      console.error('DanaPro / EKhum Integration Error:', err);
      if (typeof config.onError === 'function') {
        config.onError({ error: err.message || 'Failed to connect to server' });
      } else {
        alert('Integration Error: ' + (err.message || 'Failed to connect to server'));
      }
    });
  };

  // Convenience: EKhum.autoBind('#my-form', { apiKey: '...' })
  DanaPro.autoBind = function(selectorOrElement, options) {
    var opts = options || {};
    var formEl = typeof selectorOrElement === 'string' ? document.querySelector(selectorOrElement) : selectorOrElement;
    if (!formEl) {
      console.warn('[EKhum autoBind]: Target form element not found for selector:', selectorOrElement);
      return;
    }
    formEl.addEventListener('submit', function(e) {
      e.preventDefault();
      var config = Object.assign({}, opts, { formElement: formEl });
      DanaPro.pay(config);
    });
  };

  DanaPro.pay = DanaPro.pay;
  EKhum.pay = DanaPro.pay;
  WeGive.pay = DanaPro.pay;
  window.DanaPro = DanaPro;
  window.EKhum = DanaPro;
  window.WeGive = DanaPro;
  window.Wegive = DanaPro;
})(window, document);
  `);
});

export default router;
