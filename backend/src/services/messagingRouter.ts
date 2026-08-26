import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import pool from '../config/db';

export interface WhatsAppDispatchResult {
  success: boolean;
  provider: 'meta' | 'evolution_go' | 'none';
  messageId?: string;
  rawResponse?: any;
  error?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  provider: 'ses' | 'smtp' | 'none';
  messageId?: string;
  rawResponse?: any;
  error?: string;
}

export interface WhatsAppDispatchParams {
  organizationId?: string;
  recipientPhone: string;
  messageText: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  filename?: string;
  templateName?: string;
  configOverride?: {
    provider?: 'meta' | 'evolution_go';
    meta?: any;
    evolution_go?: {
      api_url?: string;
      api_key?: string;
      instance_name?: string;
    };
  };
}

export interface EmailDispatchParams {
  organizationId?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * Format phone number to international E.164-like clean digits string
 */
export function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned; // Default to India prefix if 10 digits
  }
  return cleaned;
}

/**
 * Dispatches a WhatsApp message using the specific Organization's configured provider (Meta or Evolution Go)
 */
export async function dispatchWhatsAppMessage(params: WhatsAppDispatchParams): Promise<WhatsAppDispatchResult> {
  const { organizationId, recipientPhone: rawPhone, messageText, mediaUrl, filename, configOverride } = params;
  const recipientPhone = cleanPhoneNumber(rawPhone);

  if (!recipientPhone) {
    return { success: false, provider: 'none', error: 'Invalid or missing recipient phone number.' };
  }

  try {
    let waConfig: any = configOverride || {};
    let legacyMeta: any = {};
    let orgName = 'DanaPro NGO';

    if (organizationId) {
      const orgResult = await pool.query(
        `SELECT name, whatsapp_config, whatsapp_meta_config FROM organizations WHERE id = $1`,
        [organizationId]
      );
      if (orgResult.rows.length > 0) {
        const org = orgResult.rows[0];
        orgName = org.name;
        waConfig = configOverride || org.whatsapp_config || {};
        legacyMeta = org.whatsapp_meta_config || {};
      }
    }

    // Determine active provider
    let provider: 'meta' | 'evolution_go' | 'none' = waConfig.provider || (legacyMeta.phone_id ? 'meta' : 'evolution_go');

    // -------------------------------------------------------------
    // PROVIDER: EVOLUTION GO (whatsmeow / REST Microservice)
    // -------------------------------------------------------------
    if (provider === 'evolution_go') {
      const evoConfig = waConfig.evolution_go || waConfig;
      const apiUrl = (evoConfig.api_url || process.env.EVOLUTION_GO_API_URL || 'http://localhost:8080').replace(/\/$/, '');
      const apiKey = evoConfig.api_key || process.env.EVOLUTION_GO_API_KEY || '';
      const instanceName = evoConfig.instance_name || orgName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'danapro_main';

      if (!apiUrl) {
        return { success: false, provider: 'evolution_go', error: 'Evolution Go API URL is not configured.' };
      }

      console.log(`[MessagingRouter] Sending WhatsApp via Evolution Go [${instanceName}] to ${recipientPhone}...`);

      let endpoint = `${apiUrl}/message/sendText`;
      let payload: any = {
        number: recipientPhone,
        text: messageText,
        options: {
          delay: 1200,
          presence: 'composing'
        }
      };

      // Support media if provided
      if (mediaUrl) {
        endpoint = `${apiUrl}/message/sendMedia`;
        payload = {
          number: recipientPhone,
          media: mediaUrl,
          mediatype: params.mediaType || 'document',
          fileName: filename || 'document.pdf',
          caption: messageText
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Instance': instanceName
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const resData: any = await response.json().catch(() => ({}));
        
        if (response.ok) {
          const messageId = resData?.key?.id || resData?.messageId || resData?.id || `evo_${Date.now()}`;
          return {
            success: true,
            provider: 'evolution_go',
            messageId,
            rawResponse: resData
          };
        } else {
          return {
            success: false,
            provider: 'evolution_go',
            error: resData?.message || resData?.error || `HTTP ${response.status} from Evolution Go`,
            rawResponse: resData
          };
        }
      } catch (networkErr: any) {
        return {
          success: false,
          provider: 'evolution_go',
          error: `Failed to connect to Evolution Go at ${apiUrl}: ${networkErr.message}`
        };
      }
    }

    // -------------------------------------------------------------
    // PROVIDER: META WHATSAPP CLOUD API (Official Graph API)
    // -------------------------------------------------------------
    if (provider === 'meta' || provider === 'none') {
      const meta = waConfig.meta || legacyMeta;
      const { waba_id, phone_id, token } = meta;

      if (!phone_id || !token) {
        return {
          success: false,
          provider: 'meta',
          error: `Meta WhatsApp Cloud API credentials not configured for "${orgName}".`
        };
      }

      console.log(`[MessagingRouter] Sending WhatsApp via Meta Cloud API [${phone_id}] to ${recipientPhone}...`);

      const url = `https://graph.facebook.com/v19.0/${phone_id}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: messageText }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData: any = await response.json().catch(() => ({}));

      if (response.ok && resData?.messages?.[0]?.id) {
        return {
          success: true,
          provider: 'meta',
          messageId: resData.messages[0].id,
          rawResponse: resData
        };
      } else {
        const errMsg = resData?.error?.message || `Meta API Error (${response.status})`;
        return {
          success: false,
          provider: 'meta',
          error: errMsg,
          rawResponse: resData
        };
      }
    }

    return { success: false, provider: 'none', error: 'No active WhatsApp provider configured.' };
  } catch (error: any) {
    console.error('[MessagingRouter] WhatsApp dispatch exception:', error);
    return { success: false, provider: 'none', error: error.message };
  }
}

/**
 * Dispatches an Email using the specific Organization's configured provider (AWS SES or Custom SMTP)
 */
export async function dispatchEmailMessage(params: EmailDispatchParams): Promise<EmailDispatchResult> {
  const { organizationId, recipientEmail, recipientName, subject, htmlBody, textBody, attachments } = params;

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, provider: 'none', error: 'Invalid recipient email address.' };
  }

  try {
    const orgResult = await pool.query(
      `SELECT name, email_config, verified_sender_email, reply_to_email, sender_name FROM organizations WHERE id = $1`,
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return { success: false, provider: 'none', error: 'Organization not found.' };
    }

    const org = orgResult.rows[0];
    const emailConfig = org.email_config || {};
    const provider: 'ses' | 'smtp' = emailConfig.provider || 'ses';

    const senderName = emailConfig.sender_name || org.sender_name || org.name || 'DanaPro Notifications';
    const fromEmail = emailConfig.from_email || org.verified_sender_email || process.env.AWS_SES_FROM_EMAIL || 'donations@danapro.org';
    const replyTo = emailConfig.reply_to || org.reply_to_email || fromEmail;
    const formattedFrom = `"${senderName}" <${fromEmail}>`;

    // -------------------------------------------------------------
    // PROVIDER: CUSTOM SMTP
    // -------------------------------------------------------------
    if (provider === 'smtp') {
      const smtp = emailConfig.smtp || {};
      if (!smtp.host) {
        return { success: false, provider: 'smtp', error: 'SMTP host is not configured for this organization.' };
      }

      console.log(`[MessagingRouter] Sending Email via SMTP [${smtp.host}:${smtp.port || 587}] to ${recipientEmail}...`);

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: Boolean(smtp.secure || Number(smtp.port) === 465),
        auth: smtp.user ? {
          user: smtp.user,
          pass: smtp.pass
        } : undefined,
        tls: {
          rejectUnauthorized: false
        }
      });

      const mailOptions: any = {
        from: formattedFrom,
        to: recipientName ? `"${recipientName}" <${recipientEmail}>` : recipientEmail,
        replyTo: replyTo,
        subject: subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>?/gm, '')
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }));
      }

      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId,
        rawResponse: info
      };
    }

    // -------------------------------------------------------------
    // PROVIDER: AWS SES (Per-NGO or System Managed)
    // -------------------------------------------------------------
    if (provider === 'ses') {
      const sesConfig = emailConfig.ses || {};
      const region = sesConfig.region || process.env.AWS_REGION || 'ap-south-1';

      console.log(`[MessagingRouter] Sending Email via AWS SES (${region}) to ${recipientEmail}...`);

      let sesClient: SESClient;
      if (sesConfig.access_key_id && sesConfig.secret_access_key) {
        sesClient = new SESClient({
          region,
          credentials: {
            accessKeyId: sesConfig.access_key_id,
            secretAccessKey: sesConfig.secret_access_key
          }
        });
      } else {
        // Platform default SES Client
        sesClient = new SESClient({ region });
      }

      // If attachments are present, use nodemailer with SES transport
      if (attachments && attachments.length > 0) {
        const sesTransporter = nodemailer.createTransport({
          SES: { ses: sesClient, aws: { SendEmailCommand } }
        } as any);

        const info = await sesTransporter.sendMail({
          from: formattedFrom,
          to: recipientEmail,
          replyTo: replyTo,
          subject: subject,
          html: htmlBody,
          text: textBody || htmlBody.replace(/<[^>]*>?/gm, ''),
          attachments: attachments.map(att => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType
          }))
        });

        return {
          success: true,
          provider: 'ses',
          messageId: info.messageId,
          rawResponse: info
        };
      }

      // Standard SES command
      const command = new SendEmailCommand({
        Source: formattedFrom,
        Destination: { ToAddresses: [recipientEmail] },
        ReplyToAddresses: [replyTo],
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody || htmlBody.replace(/<[^>]*>?/gm, ''), Charset: 'UTF-8' }
          }
        }
      });

      const response = await sesClient.send(command);
      return {
        success: true,
        provider: 'ses',
        messageId: response.MessageId,
        rawResponse: response
      };
    }

    return { success: false, provider: 'none', error: 'No active Email provider configured.' };
  } catch (error: any) {
    console.error('[MessagingRouter] Email dispatch exception:', error);
    return { success: false, provider: 'none', error: error.message };
  }
}

/**
 * Evolution Go helper: Initialize or create instance
 */
export async function createEvolutionInstance(apiUrl: string, apiKey: string, instanceName: string) {
  const base = (apiUrl || 'http://localhost:8080').replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': apiKey || '',
    'Authorization': `Bearer ${apiKey || ''}`,
    'Instance': instanceName
  };

  try {
    const res = await fetch(`${base}/instance/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSMEOW'
      })
    });
    const data: any = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Evolution Go helper: Test connection or check instance state
 */
export async function checkEvolutionInstanceStatus(apiUrl: string, apiKey: string, instanceName: string) {
  const base = (apiUrl || 'http://localhost:8080').replace(/\/$/, '');
  const headers: Record<string, string> = {
    'apikey': apiKey || '',
    'Authorization': `Bearer ${apiKey || ''}`,
    'Instance': instanceName
  };

  const statusEndpoints = [
    `${base}/instance/connectionState/${instanceName}`,
    `${base}/instance/${instanceName}/status`,
    `${base}/instance/status/${instanceName}`,
    `${base}/instance/connect/${instanceName}`
  ];

  let lastError = '';
  for (const ep of statusEndpoints) {
    try {
      const res = await fetch(ep, { method: 'GET', headers });
      if (res.ok) {
        const data: any = await res.json().catch(() => ({}));
        const state = data?.instance?.state || data?.state || data?.status || (res.ok ? 'connected' : 'unknown');
        return { ok: true, status: state, data };
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  return { ok: false, status: 'unreachable', error: lastError || 'Server unreachable' };
}

/**
 * Evolution Go helper: Get pairing QR code for scanning
 */
export async function getEvolutionInstanceQrCode(apiUrl: string, apiKey: string, instanceName: string) {
  const base = (apiUrl || 'http://localhost:8080').replace(/\/$/, '');
  const headers: Record<string, string> = {
    'apikey': apiKey || '',
    'Authorization': `Bearer ${apiKey || ''}`,
    'Instance': instanceName
  };

  const qrEndpoints = [
    `${base}/instance/qrcode/${instanceName}`,
    `${base}/instance/${instanceName}/qrcode`,
    `${base}/instance/connect/${instanceName}`,
    `${base}/instance/${instanceName}/connect`,
    `${base}/instance/qr/${instanceName}`
  ];

  let isOffline = false;
  let lastError = '';

  for (const ep of qrEndpoints) {
    try {
      const res = await fetch(ep, { method: 'GET', headers });
      const data: any = await res.json().catch(() => ({}));
      
      // Extract QR string whether string or nested object
      let qr: string | null = null;
      if (typeof data?.qrcode === 'string') {
        qr = data.qrcode;
      } else if (data?.qrcode?.base64) {
        qr = data.qrcode.base64;
      } else if (data?.qrcode?.code) {
        qr = data.qrcode.code;
      } else if (typeof data?.base64 === 'string') {
        qr = data.base64;
      } else if (typeof data?.qr === 'string') {
        qr = data.qr;
      } else if (typeof data?.code === 'string') {
        qr = data.code;
      } else if (data?.instance?.qrcode) {
        qr = typeof data.instance.qrcode === 'string' ? data.instance.qrcode : (data.instance.qrcode.base64 || data.instance.qrcode.code);
      }

      // If a QR code is returned, ALWAYS prioritize presenting it for camera scanning
      if (qr) {
        return { ok: true, qrcode: qr, state: data?.state || data?.instance?.state || 'qrcode', data };
      }

      // If explicitly paired and open without pending QR
      if (data?.state === 'open' || data?.instance?.state === 'open' || (data?.status === 'connected' && !qr)) {
        return { ok: true, isConnected: true, state: 'open', message: `Instance [${instanceName}] is connected & paired with WhatsApp!`, data };
      }
    } catch (e: any) {
      isOffline = true;
      lastError = e.message;
    }
  }

  // If instance does not exist on server, attempt auto-creation
  if (!isOffline) {
    try {
      const createRes = await createEvolutionInstance(apiUrl, apiKey, instanceName);
      if (createRes.ok && createRes.data) {
        const qr = typeof createRes.data?.qrcode === 'string' 
          ? createRes.data.qrcode 
          : (createRes.data?.qrcode?.base64 || createRes.data?.base64 || createRes.data?.code);
        if (qr) {
          return { ok: true, qrcode: qr, data: createRes.data };
        }
      }
    } catch (e: any) {
      // Continue
    }
  }

  return { 
    ok: false, 
    isOffline, 
    error: isOffline 
      ? `Evolution Go server is not running or unreachable at ${base} (${lastError || 'Connection refused'}).` 
      : `Unable to retrieve QR code from instance [${instanceName}]. Click "Initialize / Create Instance" to initialize.`,
    data: null 
  };
}

/**
 * Log out and clear session for an Evolution Go instance to trigger a new QR code scan
 */
export async function logoutEvolutionInstance(apiUrl: string, apiKey: string, instanceName: string) {
  const base = apiUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Instance': instanceName
  };

  const logoutEndpoints = [
    { url: `${base}/instance/logout/${instanceName}`, method: 'DELETE' },
    { url: `${base}/instance/logout/${instanceName}`, method: 'POST' },
    { url: `${base}/instance/delete/${instanceName}`, method: 'DELETE' },
    { url: `${base}/instance/delete/${instanceName}`, method: 'POST' },
    { url: `${base}/instance/logout`, method: 'POST' },
    { url: `${base}/instance/delete`, method: 'POST' }
  ];

  for (const ep of logoutEndpoints) {
    try {
      const res = await fetch(ep.url, { 
        method: ep.method, 
        headers, 
        body: JSON.stringify({ instanceName, name: instanceName }) 
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok || data.success) {
        return { ok: true, data };
      }
    } catch (e) {
      // Try next
    }
  }

  return { ok: true, message: `Session cleared for ${instanceName}` };
}

