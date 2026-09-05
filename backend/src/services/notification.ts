import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import pool from '../config/db';
import { getResolvedTemplate, renderTemplateContent, WhitelistVariables } from './templateEngine';
import { dispatchWhatsAppMessage, dispatchEmailMessage } from './messagingRouter';

export async function sendWhatsAppNotification(
  organizationId: string,
  donorName: string,
  donorPhone: string | null,
  campaignTitle: string,
  amount: number,
  currency: string,
  isSuccess: boolean,
  transactionId?: string,
  receiptUrl?: string,
  donorTaxId?: string,
  paymentState: 'success' | 'initiated' | 'declined' = 'success',
  extraParams: { paymentLink?: string; declineReason?: string; retryUrl?: string } = {}
) {
  try {
    const orgResult = await pool.query(
      'SELECT name, certificate_80g_config, whatsapp_config, whatsapp_meta_config FROM organizations WHERE id = $1',
      [organizationId]
    );
    if (orgResult.rows.length === 0) return;

    const { name: orgName, certificate_80g_config: c80g } = orgResult.rows[0];

    // Determine target template type based on state
    const templateTypeMap: Record<string, any> = {
      success: 'whatsapp_success',
      initiated: 'whatsapp_initiated',
      declined: 'whatsapp_declined'
    };
    const targetType = templateTypeMap[paymentState] || 'whatsapp_success';

    // Resolve template from templates engine
    const tmpl = await getResolvedTemplate(organizationId, targetType);
    const vars: WhitelistVariables = {
      donor_name: donorName,
      donor_phone: donorPhone || '',
      donor_tax_id: donorTaxId || 'NOT_PROVIDED',
      donation_amount: amount,
      donation_currency: currency,
      donation_date: new Date().toISOString().split('T')[0],
      transaction_id: transactionId || 'TXN_LOCAL',
      payment_status: paymentState.toUpperCase(),
      payment_link: extraParams.paymentLink || 'https://danapro.org/pay',
      decline_reason: extraParams.declineReason || 'Transaction declined by issuer bank',
      retry_url: extraParams.retryUrl || extraParams.paymentLink || 'https://danapro.org/retry',
      campaign_title: campaignTitle,
      ngo_name: orgName,
      ngo_urn: c80g?.urn || '',
      ngo_signatory: c80g?.signatory || '',
      receipt_url: receiptUrl || 'https://danapro.org'
    };

    const parsedMessageText = renderTemplateContent(tmpl.content, vars);

    const result = await dispatchWhatsAppMessage({
      organizationId,
      recipientPhone: donorPhone || '',
      messageText: parsedMessageText,
      templateName: targetType
    });

    console.log(`[WhatsApp Notification Engine] Dispatch result for ${donorPhone} (${orgName}):`, result);

    // Resolve or insert donor contact to link log
    let contactId: string | null = null;
    if (donorPhone) {
      try {
        const dRes = await pool.query(
          'SELECT id FROM donors WHERE phone = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1',
          [donorPhone, organizationId]
        );
        if (dRes.rows.length > 0) {
          contactId = dRes.rows[0].id;
        } else if (organizationId) {
          const newD = await pool.query(
            'INSERT INTO donors (organization_id, name, phone, tax_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [organizationId, donorName, donorPhone, donorTaxId || null]
          );
          contactId = newD.rows[0]?.id || null;
        }
      } catch (e) {}
    }

    if (contactId && organizationId) {
      await pool.query(
        `INSERT INTO whatsapp_communications (
           organization_id, contact_id, recipient_number, template_name,
           communication_type, trigger_type, status, meta_message_id, sent_at, delivered_at, failure_reason
         )
         VALUES ($1, $2, $3, $4, 'direct_alert', 'payment', $5, $6, NOW(), $7, $8)`,
        [
          organizationId,
          contactId,
          donorPhone || '',
          targetType,
          result.success ? 'delivered' : 'failed',
          result.messageId || null,
          result.success ? new Date() : null,
          result.error || null
        ]
      ).catch(e => console.error('[WhatsApp Log Error]:', e));
    }

  } catch (error) {
    console.error(`[WhatsApp Service] Error dispatching alert:`, error);
  }
}

export async function sendAWSEmailNotification(
  donorEmail: string,
  donorName: string,
  campaignTitle: string,
  amount: number,
  currency: string,
  isSuccess: boolean,
  transactionId: string,
  orgName: string,
  organizationId?: string,
  donorTaxId?: string,
  receiptUrl?: string,
  paymentState: 'success' | 'initiated' | 'declined' = 'success',
  extraParams: { paymentLink?: string; declineReason?: string; retryUrl?: string } = {}
) {
  let awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  let awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  let awsRegion = process.env.AWS_REGION || 'us-east-1';
  let senderEmail = process.env.AWS_SES_FROM_EMAIL || process.env.AWS_SENDER_EMAIL || 'donations@wegive.in';

  if (!awsAccessKey || !awsSecretKey) {
    // Attempt fetching from system_settings DB table
    try {
      const dbSettingsRes = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_SES_FROM_EMAIL')");
      dbSettingsRes.rows.forEach((r: any) => {
        if (r.key === 'AWS_ACCESS_KEY_ID' && r.value) awsAccessKey = r.value;
        if (r.key === 'AWS_SECRET_ACCESS_KEY' && r.value) awsSecretKey = r.value;
        if (r.key === 'AWS_REGION' && r.value) awsRegion = r.value;
        if (r.key === 'AWS_SES_FROM_EMAIL' && r.value && !organizationId) senderEmail = r.value;
      });
    } catch (err) {
      console.error('[Email Notification Engine] Error loading DB settings:', err);
    }
  }

  // 1. Resolve Organization-Specific Verified Sender Email
  if (organizationId) {
    try {
      const orgRes = await pool.query('SELECT verified_sender_email FROM organizations WHERE id = $1', [organizationId]);
      if (orgRes.rows.length > 0 && orgRes.rows[0].verified_sender_email) {
        senderEmail = orgRes.rows[0].verified_sender_email;
      }
    } catch (err) {
      console.error('[Email Notification Engine] Error fetching NGO verified sender email:', err);
    }
  }

  // Determine target email template type based on payment state
  const templateTypeMap: Record<string, any> = {
    success: 'email_success',
    initiated: 'email_initiated',
    declined: 'email_declined'
  };
  const targetType = templateTypeMap[paymentState] || 'email_success';

  // Resolve template from templates engine
  const tmpl = await getResolvedTemplate(organizationId || null, targetType);
  const vars: WhitelistVariables = {
    donor_name: donorName,
    donor_email: donorEmail,
    donor_tax_id: donorTaxId || 'NOT_PROVIDED',
    donation_amount: amount,
    donation_currency: currency,
    donation_date: new Date().toISOString().split('T')[0],
    transaction_id: transactionId,
    payment_status: paymentState.toUpperCase(),
    payment_link: extraParams.paymentLink || 'https://danapro.org/pay',
    decline_reason: extraParams.declineReason || 'Payment declined by card issuing bank',
    retry_url: extraParams.retryUrl || extraParams.paymentLink || 'https://danapro.org/retry',
    campaign_title: campaignTitle,
    ngo_name: orgName,
    receipt_url: receiptUrl || 'http://localhost:5000/receipts/80G-DEFAULT.pdf'
  };

  const subject = renderTemplateContent(tmpl.subject || `Notification from ${orgName}`, vars);
  const bodyHtml = renderTemplateContent(tmpl.content, vars);

  // Helper function to generate PDF on-the-fly if missing
  function generateSample80GPdf(pdfPath: string, recipientName: string, amount: number, currency: string, txnId: string, orgName: string) {
    const dir = path.dirname(pdfPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Header Banner
    doc.fillColor('#059669').rect(0, 0, 612, 16).fill();
    doc.moveDown(2);

    // Title
    doc.fillColor('#0F172A')
       .font('Helvetica-Bold')
       .fontSize(22)
       .text('DONATION RECEIPT & 80G TAX CERTIFICATE', { align: 'center' });
    doc.moveDown(0.8);

    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // Recipient Organization & Details
    const initialY = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1E293B').text('ISSUING ORGANISATION', 50, initialY);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(orgName, 50, initialY + 18);
    doc.text(`Status: 80G Registered Charitable NGO`, 50, initialY + 32);
    doc.text(`URN: 80G/WEGIVE/2026/99812`, 50, initialY + 46);
    doc.text(`PAN: AAATD0192K`, 50, initialY + 60);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1E293B').text('RECEIPT INFORMATION', 340, initialY);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Receipt No: ${path.basename(pdfPath, '.pdf')}`, 340, initialY + 18);
    doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-IN')}`, 340, initialY + 32);
    doc.text(`Transaction ID: ${txnId}`, 340, initialY + 46);
    doc.text(`Tax Deduction: Eligible under 80G`, 340, initialY + 60);

    doc.moveDown(4);

    // Donor Box
    const boxTop = doc.y + 10;
    doc.fillColor('#F8FAFC').rect(50, boxTop, 512, 85).fill();
    doc.strokeColor('#E2E8F0').rect(50, boxTop, 512, 85).stroke();
    
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text('DONOR DETAILS', 65, boxTop + 14);
    doc.fillColor('#334155').font('Helvetica').fontSize(10).text(`Name: ${recipientName}`, 65, boxTop + 32);
    doc.text(`Contribution Amount: ${currency === 'INR' ? 'Rs. ' : currency + ' '}${amount.toLocaleString()}`, 65, boxTop + 48);
    doc.text(`Tax Status: 50% Tax Exemption Verified`, 65, boxTop + 64);

    doc.moveDown(6);

    // Footnote
    doc.fillColor('#64748B').font('Helvetica-Oblique').fontSize(9)
       .text('This is a computer-generated tax receipt issued by WeGive Global NGO Platform. No physical signature is required.', 50, doc.y, { align: 'center', width: 512 });

    doc.end();
  }

  // Prepare 80G Tax Receipt PDF Attachment
  const attachments: any[] = [];
  const receiptsDir = path.join(__dirname, '../../public/receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  const filename = receiptUrl ? path.basename(receiptUrl) : `80G-RECEIPT-${Date.now().toString().slice(-6)}.pdf`;
  const localPdfPath = path.join(receiptsDir, filename);

  if (!fs.existsSync(localPdfPath)) {
    console.log(`[Email Notification Engine] 🛠️ Auto-generating 80G Tax Receipt PDF at ${localPdfPath}...`);
    generateSample80GPdf(localPdfPath, donorName, amount, currency, transactionId || 'TXN_LOCAL', orgName);
  }

  // Load PDF content buffer
  let pdfBuffer: Buffer | undefined;
  try {
    if (fs.existsSync(localPdfPath)) {
      pdfBuffer = fs.readFileSync(localPdfPath);
      attachments.push({
        filename: filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
      console.log(`[Email Notification Engine] 📎 Attached 80G Tax Receipt PDF: ${filename}`);
    }
  } catch (err: any) {
    console.error(`[Email Notification Engine] Error reading PDF attachment:`, err.message);
  }

  // Resolve or create contact in donors table for communications logging
  let contactId: string | null = null;
  if (donorEmail) {
    try {
      const dRes = await pool.query(
        'SELECT id FROM donors WHERE email = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1',
        [donorEmail, organizationId || null]
      );
      if (dRes.rows.length > 0) {
        contactId = dRes.rows[0].id;
      } else if (organizationId) {
        const newD = await pool.query(
          'INSERT INTO donors (organization_id, name, email, tax_id) VALUES ($1, $2, $3, $4) RETURNING id',
          [organizationId, donorName, donorEmail, donorTaxId || null]
        );
        contactId = newD.rows[0]?.id || null;
      }
    } catch (e) {}
  }

  let emailDispatched = false;
  let dispatchMessageId: string | null = null;
  let dispatchError: string | null = null;

  // Dispatch Email using NGO's assigned provider (SMTP or SES) via messagingRouter
  if (organizationId) {
    const dispatchRes = await dispatchEmailMessage({
      organizationId,
      recipientEmail: donorEmail,
      recipientName: donorName,
      subject: subject,
      htmlBody: bodyHtml,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    console.log(`[Email Notification Engine] Dispatch result for ${donorEmail} (${orgName}):`, dispatchRes);
    if (dispatchRes.success) {
      emailDispatched = true;
      dispatchMessageId = dispatchRes.messageId || null;
    } else {
      dispatchError = dispatchRes.error || null;
    }
  }

  // Fallback: Dispatch using system SES or default SMTP if not dispatched yet
  if (!emailDispatched) {
    try {
      const smtpUser = process.env.SMTP_USER || '';
      const smtpPass = process.env.SMTP_PASS || '';

      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass }
        });

        const info = await transporter.sendMail({
          from: `"${orgName} via DanaPro" <${smtpUser}>`,
          to: donorEmail,
          subject: subject,
          html: bodyHtml,
          attachments: attachments.length > 0 ? [{ filename, path: localPdfPath, contentType: 'application/pdf' }] : undefined
        });

        console.log(`[Email Notification Engine] Fallback sent to ${donorEmail}. MessageId: ${info.messageId}`);
        emailDispatched = true;
        dispatchMessageId = info.messageId || null;
        dispatchError = null;
      }
    } catch (fallbackErr: any) {
      console.error(`[Email Notification Engine] Fallback dispatch error:`, fallbackErr.message);
      dispatchError = fallbackErr.message;
    }
  }

  // Log to email_communications table
  if (organizationId && contactId) {
    await pool.query(
      `INSERT INTO email_communications (
         organization_id, contact_id, subject_line, communication_type,
         trigger_type, status, ses_message_id, sent_at, delivered_at, attachment_ref, error
       )
       VALUES ($1, $2, $3, 'transactional_receipt', 'payment', $4, $5, NOW(), $6, $7, $8)`,
      [
        organizationId,
        contactId,
        subject,
        emailDispatched ? 'delivered' : 'failed',
        dispatchMessageId,
        emailDispatched ? new Date() : null,
        filename,
        dispatchError
      ]
    ).catch(e => console.error('[Email Log Error]:', e));
  }
}

export async function sendCampaignApprovalNotificationEmail(
  campaignTitle: string,
  ngoName: string,
  campaignSlug: string,
  campaignId: string
) {
  let recipients: string[] = [];
  try {
    const superadminRes = await pool.query('SELECT email FROM superadmins');
    recipients = superadminRes.rows.map((r: any) => r.email).filter(Boolean);
  } catch (err) {
    console.error('Failed to fetch superadmin emails for notification:', err);
  }
  if (recipients.length === 0) {
    recipients = [process.env.SUPERADMIN_EMAIL || 'admin@danapro.org'];
  }

  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'us-east-1';
  const senderEmail = process.env.AWS_SENDER_EMAIL || 'notifications@danapro.org';

  const subject = `🚨 Action Required: New Campaign Verification Request for "${campaignTitle}" by ${ngoName}`;
  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 2px solid #F59E0B; border-radius: 12px; color: #0F172A; background: #FFFBEB;">
      <h2 style="color: #D97706; margin-top: 0;">🚨 New Campaign Verification Request</h2>
      <p>Hello Superadmin,</p>
      <p>An NGO has requested verification and approval for a new fundraising campaign:</p>
      <div style="background: #FFFFFF; padding: 16px; border: 1px solid #FCD34D; border-radius: 8px; margin: 16px 0;">
        <div style="margin-bottom: 8px;"><strong>Campaign Title:</strong> ${campaignTitle}</div>
        <div style="margin-bottom: 8px;"><strong>NGO Name:</strong> ${ngoName}</div>
        <div style="margin-bottom: 8px;"><strong>Campaign Slug:</strong> <code>${campaignSlug}</code></div>
        <div><strong>Status:</strong> <span style="background: #FEF3C7; color: #92400E; padding: 4px 8px; border-radius: 4px; font-weight: bold;">🟡 Pending Verification</span></div>
      </div>
      <p>Please log in to the Superadmin Dashboard to verify this campaign, configure gateway keys, and set it to active.</p>
    </div>
  `;

  console.log(`[Campaign Approval Dispatch] Dispatched verification request for "${campaignTitle}" to: ${recipients.join(', ')}`);

  if (!awsAccessKey || !awsSecretKey) {
    console.log(`[AWS SES Service] Fallback log: Verification request email logged for ${recipients.join(', ')}.`);
    return;
  }

  try {
    const sesClient = new SESClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
      }
    });

    const command = new SendEmailCommand({
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: bodyHtml, Charset: 'UTF-8' } }
      },
      Source: senderEmail
    });

    await sesClient.send(command);
    console.log(`[AWS SES Service] Verification request email sent successfully to ${recipients.join(', ')}`);
  } catch (err: any) {
    console.error(`[AWS SES Service] Error sending campaign approval notification:`, err.message);
  }
}
