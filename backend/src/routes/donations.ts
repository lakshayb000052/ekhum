import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import pool from '../config/db';
import { broadcast, broadcastDonationEvent } from '../websocket';
import { sendWhatsAppNotification, sendAWSEmailNotification } from '../services/notification';
import { triggerDonationSuccessEventsAndNotifications } from '../services/journeyExecutor';
import { initiateMultiGatewayPayment } from '../services/paymentRouter';
import { recalculateContactRollups, updateSubscriptionStats } from '../services/contactRollupService';
import { EncryptionService } from '../services/encryptionService';

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret'
});

import { authenticate, AuthenticatedRequest } from '../middleware/auth';

// Get transaction history querying Postgres with rich Razorpay donor details
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const targetOrgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || (user as any)?.organization_id);

    // Auto-reconcile stale initiated transactions older than 25 minutes to 'failed' status
    await pool.query(`
      UPDATE donations 
      SET status = 'failed', updated_at = NOW() 
      WHERE status IN ('initiated', 'pending') 
        AND (created_at < NOW() - INTERVAL '25 minutes')
    `);

    let query = `
      SELECT 
        d.id,
        d.id AS "paymentId",
        dn.id AS "donorId",
        COALESCE(dn.name, TRIM(CONCAT(COALESCE(dn.first_name, ''), ' ', COALESCE(dn.last_name, '')))) AS "donorName",
        dn.email AS "donorEmail",
        dn.phone AS "donorPhone",
        dn.tax_id AS "donorTaxId",
        CASE WHEN dn.tax_id IS NOT NULL AND TRIM(dn.tax_id) != '' THEN true ELSE false END AS "panCard",
        d.amount,
        d.currency,
        d.net_amount AS "netAmount",
        d.fee_covered AS "feeCovered",
        d.status,
        d.payment_gateway AS "paymentGateway",
        d.payment_method AS "paymentMethod",
        COALESCE(d.payment_type, CASE WHEN d.subscription_id IS NOT NULL THEN 'monthly_donation' ELSE 'one_time' END) AS "paymentType",
        d.subscription_id AS "subscriptionId",
        d.failure_reason AS "failureReason",
        COALESCE(d.eighty_g_sent_email, (r.email_delivery_status = 'delivered'), false) AS "eightyGSentEmail",
        COALESCE(d.eighty_g_sent_whatsapp, (r.whatsapp_delivery_status = 'delivered'), false) AS "eightyGSentWhatsapp",
        d.gateway_transaction_id AS "gatewayTransactionId",
        d.raw_gateway_response AS "rawGatewayResponse",
        d.custom_form_data AS "customFormData",
        d.tax_receipt_status AS "taxReceiptStatus",
        r.receipt_number AS "receiptNumber",
        r.pdf_url AS "receiptPdfUrl",
        d.created_at AS "createdAt",
        d.created_at AS "paymentDate",
        c.id AS "campaignId",
        c.title AS "campaignTitle",
        c.title AS "paymentCampaign",
        o.id AS "organizationId",
        o.name AS "organizationName"
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN campaigns c ON d.campaign_id = c.id
      LEFT JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN eighty_g_receipts r ON d.id = r.payment_id OR d.eighty_g_receipt_id = r.id
    `;
    
    const params: any[] = [];
    if (targetOrgId && targetOrgId !== 'all') {
      query += ` WHERE d.organization_id = $1 `;
      params.push(targetOrgId);
    }
    
    query += ` ORDER BY d.created_at DESC `;
    const { rows } = await pool.query(query, params);
    
    const enrichedDonations = rows.map((row: any) => {
      const rawTaxId = row.donorTaxId || '';
      const decryptedTaxId = rawTaxId ? EncryptionService.decrypt(rawTaxId) : '';
      const maskedTaxId = EncryptionService.maskPAN(decryptedTaxId);

      return {
        ...row,
        donorTaxId: decryptedTaxId,
        donorTaxIdMasked: maskedTaxId
      };
    });

    return res.status(200).json({ success: true, donations: enrichedDonations });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Initiate and Complete Payment (Fully functional Local Sandbox & Razorpay Routing)
router.post('/initiate', async (req: Request, res: Response) => {
  const { campaignId, amount, currency, email, name, taxId, coverFee, paymentMethod, phone } = req.body;

  const client = await pool.connect();
  try {
    if (!campaignId || !amount || !currency || !email || !name) {
      return res.status(400).json({ success: false, message: 'Missing required checkout parameters.' });
    }

    await client.query('BEGIN');

    // 1. Get Campaign to identify organization and campaign-specific Razorpay config
    const campaignResult = await client.query(
      `SELECT c.organization_id, c.title, c.payment_config AS camp_payment_config, o.name AS org_name, o.payment_gateways_config AS org_payment_config
       FROM campaigns c
       JOIN organizations o ON c.organization_id = o.id
       WHERE c.id = $1`,
      [campaignId]
    );
    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found');
    }
    const campRow = campaignResult.rows[0];
    const orgId = campRow.organization_id;
    const campaignTitle = campRow.title;
    const orgName = campRow.org_name;

    // 2. Insert or update Donor profile
    const donorQuery = `
      INSERT INTO donors (organization_id, name, email, phone, tax_id, tax_id_type, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id, email) 
      DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, donors.phone), tax_id = COALESCE(EXCLUDED.tax_id, donors.tax_id)
      RETURNING id, country, phone
    `;
    const isDomestic = currency === 'INR';
    const donorCountry = isDomestic ? 'IN' : 'US';
    const donorResult = await client.query(donorQuery, [
      orgId,
      name,
      email,
      phone || null,
      taxId || null,
      taxId ? 'PAN' : null,
      donorCountry
    ]);
    const donorId = donorResult.rows[0].id;
    const donorPhone = donorResult.rows[0].phone;

    // 3. Initiate payment via Unified Multi-Gateway Engine
    const donationAmount = Number(amount);
    const feePercent = 0.00; // Free Platform
    const platformFee = coverFee ? 0.00 : (donationAmount * feePercent);
    const donorFeeCovered = coverFee ? (donationAmount * feePercent) : 0.00;
    const netPayoutAmount = donationAmount - platformFee;
    const totalChargeAmount = donationAmount + donorFeeCovered;

    const paymentResult = await initiateMultiGatewayPayment({
      campaignId: campRow.id || campaignId,
      campaignTitle: campRow.title,
      campaignSlug: campRow.slug || 'campaign',
      organizationId: orgId,
      orgName: campRow.org_name,
      amount: totalChargeAmount,
      currency: currency.toUpperCase(),
      donorName: name,
      donorEmail: email,
      donorPhone: phone || donorPhone,
      donorTaxId: taxId,
      paymentConfig: campRow.camp_payment_config,
      orgPaymentConfig: campRow.org_payment_config,
      requestedGateway: req.body.gateway || req.body.requestedGateway,
      forceSandbox: req.body.forceSandbox
    });

    const isSandboxDirect = paymentResult.mode === 'sandbox' || req.body.forceSandbox;

    if (isSandboxDirect) {
      const txnId = paymentResult.orderId || `txn_sandbox_${Math.random().toString(36).substring(2, 11)}`;
      const donationQuery = `
        INSERT INTO donations (
          organization_id, campaign_id, donor_id, amount, currency, 
          net_amount, fee_covered, payment_gateway, gateway_transaction_id, 
          status, payment_method, tax_receipt_status, custom_form_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, 'generated', $11)
        RETURNING id
      `;
      const donationResult = await client.query(donationQuery, [
        orgId,
        campaignId,
        donorId,
        totalChargeAmount,
        currency.toUpperCase(),
        netPayoutAmount,
        donorFeeCovered,
        paymentResult.gateway || 'sandbox',
        txnId,
        paymentMethod || 'upi',
        JSON.stringify({ isFallback: paymentResult.isFallback, failoverReason: paymentResult.failoverReason })
      ]);
      const donationId = donationResult.rows[0].id;
      await client.query('COMMIT');

      // 80G Receipt PDF Record
      const receiptNum = `80G-${(paymentResult.gateway || 'DIR').toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
      const pdfUrl = `http://localhost:5000/receipts/${receiptNum}.pdf`;
      await pool.query(
        `INSERT INTO compliance_receipts (donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash, metadata)
         VALUES ($1, $2, '80G', $3, md5($4), $5)
         ON CONFLICT (donation_id) DO UPDATE SET metadata = EXCLUDED.metadata`,
        [donationId, receiptNum, pdfUrl, txnId, JSON.stringify({ source: 'direct_checkout', gateway: paymentResult.gateway })]
      );

      broadcast('donation_completed', {
        donationId,
        amount: totalChargeAmount,
        currency: currency.toUpperCase(),
        donorName: name,
        donorEmail: email,
        donorPhone: donorPhone,
        paymentGateway: paymentResult.gateway,
        receiptNumber: receiptNum,
        campaignTitle,
        organizationId: orgId
      });

      triggerDonationSuccessEventsAndNotifications({
        donationId,
        organizationId: orgId,
        donorId,
        donorName: name,
        donorEmail: email,
        donorPhone: donorPhone || null,
        campaignTitle,
        amount: totalChargeAmount,
        currency: currency.toUpperCase(),
        transactionId: txnId,
        receiptNumber: receiptNum,
        receiptPdfUrl: pdfUrl,
        orgName,
        gateway: paymentResult.gateway || 'direct'
      });

      await recalculateContactRollups(donorId, orgId);

      return res.status(200).json({
        success: true,
        mode: 'sandbox_completed',
        message: 'Transaction completed successfully.',
        donationId,
        transactionId: txnId,
        gateway: paymentResult.gateway,
        receiptNumber: receiptNum,
        amountPaid: totalChargeAmount
      });
    }

    // Live Gateway Flow (Cashfree, Razorpay, PayU, CCAvenue, Worldline)
    const donationQuery = `
      INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, 
        net_amount, fee_covered, payment_gateway, gateway_transaction_id, 
        status, payment_method, tax_receipt_status, custom_form_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, 'not_generated', $11)
      RETURNING id
    `;
    const donationResult = await client.query(donationQuery, [
      orgId,
      campaignId,
      donorId,
      totalChargeAmount,
      currency.toUpperCase(),
      netPayoutAmount,
      donorFeeCovered,
      paymentResult.gateway,
      paymentResult.orderId,
      paymentMethod || 'upi',
      JSON.stringify({ isFallback: paymentResult.isFallback, failoverReason: paymentResult.failoverReason })
    ]);
    const donationId = donationResult.rows[0].id;
    await client.query('COMMIT');

    // Broadcast live donation_initiated event to all dashboards
    broadcast('donation_initiated', {
      donationId,
      amount: totalChargeAmount,
      currency: currency.toUpperCase(),
      donorName: name,
      donorEmail: email,
      campaignTitle,
      organizationId: orgId,
      paymentGateway: paymentResult.gateway,
      status: 'initiated'
    });

    return res.status(200).json({
      success: true,
      mode: paymentResult.mode,
      gateway: paymentResult.gateway,
      orderId: paymentResult.orderId,
      amount: Math.round(totalChargeAmount * 100),
      currency: currency.toUpperCase(),
      keyId: paymentResult.checkoutPayload?.keyId || paymentResult.checkoutPayload?.appId || '',
      donationId,
      amountPaid: totalChargeAmount,
      checkoutPayload: paymentResult.checkoutPayload,
      availableRails: paymentResult.availableRails,
      isFallback: paymentResult.isFallback,
      failoverReason: paymentResult.failoverReason
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// Verification Route for Multi-Gateway payments
router.post('/verify', async (req: Request, res: Response) => {
  const { 
    donationId, 
    paymentGateway,
    razorpayPaymentId, 
    razorpayOrderId, 
    razorpaySignature,
    cashfreePaymentId,
    payuPaymentId,
    worldlineTransactionId,
    ccavenueTrackingId
  } = req.body;

  try {
    console.log(`[Payment Verification] Verifying payment for donation: ${donationId}`);
    
    // Query donation and retrieve organization & campaign payment details
    const donationQuery = `
      SELECT d.organization_id, d.donor_id, d.amount, d.currency, d.payment_gateway,
             c.title AS "campaignTitle", c.payment_config AS camp_payment_config,
             o.name AS "orgName", o.payment_gateways_config AS org_payment_config,
             dn.name AS "donorName", dn.email AS "donorEmail", dn.phone AS "donorPhone"
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      JOIN campaigns c ON d.campaign_id = c.id
      JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = $1
    `;
    const donationRes = await pool.query(donationQuery, [donationId]);
    if (donationRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }
    const row = donationRes.rows[0];
    const { organization_id: orgId, donor_id: donorId, amount, currency, campaignTitle, donorName, donorEmail, donorPhone, orgName } = row;
    const resolvedGateway = paymentGateway || row.payment_gateway || 'razorpay';
    const txnId = cashfreePaymentId || payuPaymentId || razorpayPaymentId || worldlineTransactionId || ccavenueTrackingId || `pay_${resolvedGateway}_${Date.now()}`;

    // Razorpay signature validation if razorpay
    if (resolvedGateway === 'razorpay' && razorpaySignature && razorpayOrderId && razorpayPaymentId) {
      const campPayment = row.camp_payment_config || {};
      const orgPayment = row.org_payment_config || {};
      let keySecret = campPayment.razorpay_key_secret || orgPayment.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || 'mock_secret';

      if (keySecret !== 'mock_secret') {
        const hash = crypto
          .createHmac('sha256', keySecret)
          .update(razorpayOrderId + '|' + razorpayPaymentId)
          .digest('hex');

        if (hash !== razorpaySignature) {
          return res.status(400).json({ success: false, message: 'Payment verification failed: Signature mismatch.' });
        }
      }
    }

    const rawPayload = {
      gateway: resolvedGateway,
      transactionId: txnId,
      razorpayPaymentId,
      razorpayOrderId,
      cashfreePaymentId,
      payuPaymentId,
      verification_status: 'verified',
      verified_at: new Date().toISOString()
    };

    // Update donation status to completed
    const query = `
      UPDATE donations 
      SET status = 'completed', 
          payment_gateway = $1,
          gateway_transaction_id = $2, 
          payment_method = 'upi',
          tax_receipt_status = 'generated',
          raw_gateway_response = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING id
    `;
    const { rows } = await pool.query(query, [
      resolvedGateway,
      txnId,
      JSON.stringify(rawPayload),
      donationId
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    // 80G Receipt PDF Record
    const receiptNum = `80G-${resolvedGateway.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
    const pdfUrl = `http://localhost:5000/receipts/${receiptNum}.pdf`;
    await pool.query(
      `INSERT INTO compliance_receipts (donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash, metadata)
       VALUES ($1, $2, '80G', $3, md5($4), $5)
       ON CONFLICT (donation_id) DO UPDATE SET metadata = EXCLUDED.metadata`,
      [donationId, receiptNum, pdfUrl, txnId, JSON.stringify({ source: 'direct_checkout', gateway: resolvedGateway })]
    );

    // Broadcast completed donation via WebSocket
    broadcast('donation_completed', {
      donationId,
      amount,
      currency,
      donorName,
      donorEmail,
      paymentGateway: resolvedGateway,
      receiptNumber: receiptNum,
      campaignTitle,
      organizationId: orgId
    });

    // Trigger events, journey auto-enrolment, and multi-channel notifications
    triggerDonationSuccessEventsAndNotifications({
      donationId,
      organizationId: orgId,
      donorName,
      donorEmail,
      donorPhone: donorPhone || null,
      campaignTitle,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      transactionId: txnId,
      receiptNumber: receiptNum,
      receiptPdfUrl: pdfUrl,
      orgName,
      gateway: resolvedGateway
    });

    if (donorId) {
      await recalculateContactRollups(donorId, orgId);
    }

    return res.status(200).json({
      success: true,
      message: `Payment verified via ${resolvedGateway.toUpperCase()} and 80G Tax Receipt generated successfully.`,
      donationId: rows[0].id,
      paymentGateway: resolvedGateway,
      receiptNumber: receiptNum
    });
  } catch (error: any) {
    console.error('Payment verification failed:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});


// On-demand Multi-Gateway Live Sync Endpoint for Cashfree, Razorpay, PayU, etc.
router.get(['/:id/sync', '/:id/gateway-sync', '/:id/razorpay-sync'], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const donationRes = await pool.query(
      `SELECT d.id, d.gateway_transaction_id, d.organization_id, d.campaign_id, d.raw_gateway_response,
              d.payment_gateway, d.status, d.amount, d.currency,
              c.title AS campaign_title, c.payment_config AS camp_payment_config, 
              o.name AS org_name, o.payment_gateways_config AS org_payment_config,
              dn.name AS donor_name, dn.email AS donor_email, dn.phone AS donor_phone
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN organizations o ON d.organization_id = o.id
       JOIN donors dn ON d.donor_id = dn.id
       WHERE (d.id::text = $1 OR d.gateway_transaction_id = $1)`,
      [id]
    );

    if (donationRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation record not found.' });
    }

    const dRow = donationRes.rows[0];
    const txnId = dRow.gateway_transaction_id;
    const gateway = (dRow.payment_gateway || 'razorpay').toLowerCase();
    const campPayment = dRow.camp_payment_config || {};
    const orgPayment = dRow.org_payment_config || {};

    if (!txnId || txnId.startsWith('pay_mock_') || txnId.startsWith('txn_sandbox_')) {
      return res.status(200).json({
        success: true,
        gateway,
        message: 'Sandbox transaction details retrieved.',
        donationId: dRow.id,
        rawGatewayResponse: dRow.raw_gateway_response || { id: txnId, status: dRow.status, gateway }
      });
    }

    // 1. CASHFREE LIVE SYNC
    if (gateway === 'cashfree') {
      const activeRails = orgPayment.gateways || [];
      const cfRail = activeRails.find((r: any) => r.type === 'cashfree') || {};
      const appId = cfRail.app_id || orgPayment.cashfree_app_id || process.env.CASHFREE_APP_ID;
      const secretKey = cfRail.secret_key || orgPayment.cashfree_secret_key || process.env.CASHFREE_SECRET_KEY;
      const isLive = cfRail.mode === 'production' || process.env.CASHFREE_MODE === 'production';
      const cfBaseUrl = isLive ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

      if (appId && secretKey && !appId.includes('mock')) {
        try {
          const cfRes = await fetch(`${cfBaseUrl}/orders/${txnId}/payments`, {
            method: 'GET',
            headers: {
              'x-client-id': appId,
              'x-client-secret': secretKey,
              'x-api-version': '2023-08-01'
            }
          });

          if (cfRes.ok) {
            const cfPayments: any = await cfRes.json();
            const latestPay = Array.isArray(cfPayments) && cfPayments.length > 0 ? cfPayments[0] : null;

            if (latestPay) {
              const payStatus = (latestPay.payment_status || 'SUCCESS').toUpperCase();
              const newStatus = (payStatus === 'SUCCESS' || payStatus === 'PAID') ? 'completed' : (payStatus === 'FAILED' || payStatus === 'USER_DROPPED') ? 'failed' : dRow.status;

              await pool.query(
                `UPDATE donations 
                 SET status = $1, 
                     raw_gateway_response = $2, 
                     payment_method = COALESCE($3, payment_method),
                     updated_at = NOW() 
                 WHERE id = $4`,
                [newStatus, JSON.stringify(latestPay), latestPay.payment_group || latestPay.payment_method?.type || 'upi', dRow.id]
              );

              // Broadcast status update
              broadcast(newStatus === 'completed' ? 'donation_completed' : newStatus === 'failed' ? 'donation_failed' : 'donation_initiated', {
                donationId: dRow.id,
                amount: Number(dRow.amount),
                currency: dRow.currency,
                donorName: dRow.donor_name,
                donorEmail: dRow.donor_email,
                campaignTitle: dRow.campaign_title,
                organizationId: dRow.organization_id,
                paymentGateway: 'cashfree',
                status: newStatus
              });

              return res.status(200).json({
                success: true,
                gateway: 'cashfree',
                message: `Live Cashfree payment synchronized (Status: ${newStatus}).`,
                donationId: dRow.id,
                paymentId: latestPay.cf_payment_id || txnId,
                rawGatewayResponse: latestPay
              });
            }
          }
        } catch (cfErr: any) {
          console.warn('[Cashfree Live Sync Notice]:', cfErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        gateway: 'cashfree',
        message: 'Cashfree transaction details retrieved.',
        donationId: dRow.id,
        paymentId: txnId,
        rawGatewayResponse: dRow.raw_gateway_response || { order_id: txnId, gateway: 'cashfree', status: dRow.status }
      });
    }

    // 2. RAZORPAY LIVE SYNC
    if (gateway === 'razorpay') {
      let keyId = campPayment.razorpay_key_id || orgPayment.razorpay_key_id || process.env.RAZORPAY_KEY_ID;
      let keySecret = campPayment.razorpay_key_secret || orgPayment.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

      if (!keySecret) {
        const settingsResult = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')");
        settingsResult.rows.forEach((r: any) => {
          if (r.key === 'RAZORPAY_KEY_ID') keyId = r.value;
          if (r.key === 'RAZORPAY_KEY_SECRET') keySecret = r.value;
        });
      }

      try {
        const dynamicRazorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const liveRazorpayPayload = await dynamicRazorpay.payments.fetch(txnId);

        const newStatus = liveRazorpayPayload.status === 'captured' ? 'completed' : liveRazorpayPayload.status === 'failed' ? 'failed' : dRow.status;

        // Save fresh live details to database
        await pool.query('UPDATE donations SET status = $1, raw_gateway_response = $2, updated_at = NOW() WHERE id = $3', [newStatus, JSON.stringify(liveRazorpayPayload), dRow.id]);

        broadcast(newStatus === 'completed' ? 'donation_completed' : newStatus === 'failed' ? 'donation_failed' : 'donation_initiated', {
          donationId: dRow.id,
          amount: Number(dRow.amount),
          currency: dRow.currency,
          donorName: dRow.donor_name,
          donorEmail: dRow.donor_email,
          campaignTitle: dRow.campaign_title,
          organizationId: dRow.organization_id,
          paymentGateway: 'razorpay',
          status: newStatus
        });

        return res.status(200).json({
          success: true,
          gateway: 'razorpay',
          message: 'Fresh donor and transaction payload fetched directly from Razorpay API.',
          donationId: dRow.id,
          paymentId: txnId,
          rawGatewayResponse: liveRazorpayPayload
        });
      } catch (apiErr: any) {
        console.warn('[Razorpay Live Sync Warning]:', apiErr?.message);
        return res.status(200).json({
          success: true,
          gateway: 'razorpay',
          message: 'Retrieved stored transaction payload.',
          donationId: dRow.id,
          paymentId: txnId,
          rawGatewayResponse: dRow.raw_gateway_response || { id: txnId, status: dRow.status, gateway: 'razorpay' }
        });
      }
    }

    // 3. OTHER GATEWAYS (PayU, CCAvenue, Worldline)
    return res.status(200).json({
      success: true,
      gateway,
      message: `Retrieved ${gateway.toUpperCase()} transaction details.`,
      donationId: dRow.id,
      paymentId: txnId,
      rawGatewayResponse: dRow.raw_gateway_response || { id: txnId, status: dRow.status, gateway }
    });
  } catch (error: any) {
    console.error('Payment sync error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Failed verification/lead callback route
router.post('/verify-failed', async (req: Request, res: Response) => {
  const { donationId, errorDescription } = req.body;
  try {
    console.log(`[Razorpay Verification Failed] Processing failed lead for donation: ${donationId}`);

    // Update status to failed
    const updateQuery = `
      UPDATE donations 
      SET status = 'failed'
      WHERE id = $1
      RETURNING id, organization_id, amount, currency, donor_id, campaign_id
    `;
    const updateRes = await pool.query(updateQuery, [donationId]);
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation record not found.' });
    }

    const { organization_id: orgId, amount, currency, donor_id: donorId, campaign_id: campaignId } = updateRes.rows[0];

    // Get donor and campaign details
    const detailsQuery = `
      SELECT 
        dn.name AS "donorName", dn.email AS "donorEmail", dn.phone AS "donorPhone",
        c.title AS "campaignTitle",
        o.name AS "orgName"
      FROM donors dn
      JOIN campaigns c ON c.id = $1
      JOIN organizations o ON o.id = $2
      WHERE dn.id = $3
    `;
    const detailsRes = await pool.query(detailsQuery, [campaignId, orgId, donorId]);
    if (detailsRes.rows.length > 0) {
      const { donorName, donorEmail, donorPhone, campaignTitle, orgName } = detailsRes.rows[0];

      // Broadcast failed transaction via WebSocket
      broadcast('donation_failed', {
        donationId,
        amount,
        currency,
        donorName,
        donorEmail,
        campaignTitle,
        organizationId: orgId,
        reason: errorDescription || 'Payment aborted/failed'
      });

      // Dispatch failed notifications
      sendWhatsAppNotification(orgId, donorName, donorPhone, campaignTitle, Number(amount), currency, false);
      sendAWSEmailNotification(donorEmail, donorName, campaignTitle, Number(amount), currency, false, donationId, orgName);
    }

    return res.status(200).json({
      success: true,
      message: 'Failed transaction lead logged and alerts sent.'
    });
  } catch (error: any) {
    console.error('Failed lead log error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Manual Donation
router.post('/manual', async (req: Request, res: Response) => {
  const { campaignId, donorName, donorEmail, amount, currency, paymentMethod, referenceNo } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Retrieve default Org
    const campaignResult = await client.query('SELECT organization_id FROM campaigns WHERE id = $1', [campaignId || '92da27d4-8395-46f8-9584-c81b2bd1eb1e']);
    const orgId = campaignResult.rows[0]?.organization_id || 'f728c312-d961-460d-a3df-6a982f1b0cd9';

    // Insert donor
    const donorResult = await client.query(`
      INSERT INTO donors (organization_id, name, email, country)
      VALUES ($1, $2, $3, 'IN')
      ON CONFLICT (organization_id, email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [orgId, donorName, donorEmail]);
    const donorId = donorResult.rows[0].id;

    // Save manual donation
    const query = `
      INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, 
        net_amount, payment_gateway, gateway_transaction_id, status, 
        payment_method, tax_receipt_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, 'completed', $8, 'not_generated')
      RETURNING id
    `;
    const { rows } = await client.query(query, [
      orgId,
      campaignId || '92da27d4-8395-46f8-9584-c81b2bd1eb1e',
      donorId,
      amount,
      currency || 'INR',
      amount,
      referenceNo || `REF-${Date.now()}`,
      paymentMethod || 'cash'
    ]);

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Offline donation logged.', donationId: rows[0].id });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
