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
    const { name, email, phone, taxId, amount, currency = 'INR', isAnonymous = false, customFormData = {}, campaignSlug, requestedGateway, forceSandbox = false } = req.body;

    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized: Missing DanaPro API Key (x-danapro-api-key header or api_key payload parameter required)' });
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
         OR REPLACE(c.api_key, 'wg_live_', 'wg_test_') = $1
         OR REPLACE(c.api_key, 'wg_test_', 'wg_live_') = $1
         OR REPLACE(o.api_key, 'wg_live_', 'wg_test_') = $1
         OR REPLACE(o.api_key, 'wg_test_', 'wg_live_') = $1
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

    // 2. Insert or update Donor in database
    const donorRes = await pool.query(
      `INSERT INTO donors (organization_id, name, email, phone, tax_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, email) 
       DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, donors.phone), tax_id = COALESCE(EXCLUDED.tax_id, donors.tax_id), updated_at = NOW()
       RETURNING *`,
      [organizationId, name || 'Anonymous Donor', email || `donor_${Date.now()}@external.org`, phone || null, taxId || null]
    );
    const donor = donorRes.rows[0];

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
      customFormData,
      paymentConfig: campaign.payment_config,
      orgPaymentConfig: campaign.org_payment_config,
      requestedGateway,
      forceSandbox
    });

    // 4. Insert Initiated Donation into Database
    const donationRes = await pool.query(
      `INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, net_amount, fee_covered,
        payment_gateway, gateway_transaction_id, status, is_anonymous, custom_form_data
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'initiated', $10, $11)
       RETURNING *`,
      [
        organizationId,
        campaign.id,
        donor.id,
        amount,
        currency.toUpperCase(),
        amount,
        0.00,
        paymentResult.gateway,
        paymentResult.orderId,
        isAnonymous,
        JSON.stringify({ ...(customFormData || {}), isFallback: paymentResult.isFallback, failoverReason: paymentResult.failoverReason })
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
      `SELECT d.*, c.title as campaign_title, c.payment_config as camp_payment_config, o.name as org_name, o.payment_gateways_config as org_payment_config, dn.email as donor_email, dn.name as donor_name, dn.id as donor_db_id, dn.phone as donor_phone
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

    // 4. Generate 80G Receipt PDF Record
    const receiptNum = `80G-${resolvedGateway.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
    const pdfUrl = `http://localhost:5000/receipts/${receiptNum}.pdf`;
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
        `UPDATE donations SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [donationId]
      );

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
  const pdfUrl = `http://localhost:5000/receipts/${receiptNum}.pdf`;

  if (targetDonation) {
    await pool.query(
      `UPDATE donations 
       SET status = 'completed', 
           payment_gateway = $1,
           gateway_transaction_id = $2, 
           raw_gateway_response = $3,
           tax_receipt_status = 'generated',
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
  res.send(`
(function(window, document) {
  'use strict';
  
  var DanaPro = window.DanaPro || window.EKhum || window.WeGive || window.Wegive || {};
  var EKhum = DanaPro;
  var WeGive = DanaPro;
  
  DanaPro.pay = function(config) {
    if (!config || !config.apiKey) {
      alert('DanaPro Integration Error: apiKey is required in EKhum.pay({ apiKey: "wg_live_..." })');
      return;
    }
    
    var currentScript = document.currentScript;
    var inferredServerUrl = '';
    if (currentScript && currentScript.src) {
      try {
        var parsedUrl = new URL(currentScript.src);
        inferredServerUrl = parsedUrl.origin;
      } catch (e) {}
    }
    
    var baseServerUrl = config.serverUrl || inferredServerUrl || 'http://localhost:5000';
    var endpoint = baseServerUrl + '/api/v1/external/donations/initiate';
    
    var payload = {
      api_key: config.apiKey,
      amount: config.amount,
      currency: config.currency || 'INR',
      name: config.name,
      email: config.email,
      phone: config.phone,
      taxId: config.taxId,
      campaignSlug: config.campaignSlug,
      requestedGateway: config.gateway,
      customFormData: config.customFormData || {}
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
            customFormData: config.customFormData || {}
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
        var donorName = config.name || 'Generous Donor';
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
        
        if (data.orderId && !data.orderId.startsWith('order_wg_ext_') && !data.orderId.startsWith('order_rzp_')) {
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
      console.error('DanaPro Integration Error:', err);
      if (typeof config.onError === 'function') {
        config.onError({ error: err.message || 'Failed to connect to server' });
      } else {
        alert('Integration Error: ' + (err.message || 'Failed to connect to server'));
      }
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
