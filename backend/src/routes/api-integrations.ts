import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate, authorizeRole } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// GET /api/integrations — list webhooks
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    
    let query = 'SELECT * FROM api_integrations';
    const params: any[] = [];
    if (organization_id) {
      query += ' WHERE organization_id = $1';
      params.push(organization_id);
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations — register webhook
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);
    const { name, webhook_url, events_subscribed, auth_type, auth_config } = req.body;
    
    const result = await pool.query(
      `INSERT INTO api_integrations (organization_id, name, webhook_url, events_subscribed, auth_type, auth_config, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [organization_id, name, webhook_url, JSON.stringify(events_subscribed || []), auth_type || 'hmac', JSON.stringify(auth_config || {})]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// PUT /api/integrations/:id — update webhook
router.put('/:id', authenticate, async (req: Request, res: Response, next: any) => {
  const { id } = req.params;
  if (!uuidRegex.test(id)) {
    return next();
  }
  try {
    const user = (req as any).user;
    const { name, webhook_url, events_subscribed, status } = req.body;
    
    let query = `UPDATE api_integrations SET 
        name = COALESCE($1, name), 
        webhook_url = COALESCE($2, webhook_url), 
        events_subscribed = COALESCE($3, events_subscribed), 
        status = COALESCE($4, status), 
        updated_at = NOW() 
       WHERE id = $5`;
    const params: any[] = [name, webhook_url, events_subscribed ? JSON.stringify(events_subscribed) : null, status, id];
    if (user?.role !== 'superadmin') {
      query += ` AND organization_id = $6`;
      params.push(user.organizationId || user.organization_id);
    }
    query += ` RETURNING *`;
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Integration not found or unauthorized' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/integrations/:id — remove webhook (Superadmin Only)
router.delete('/:id', authenticate, authorizeRole(['superadmin']), async (req: Request, res: Response, next: any) => {
  const { id } = req.params;
  if (!uuidRegex.test(id)) {
    return next();
  }
  try {
    const result = await pool.query('DELETE FROM api_integrations WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Integration not found' });
    
    res.json({ success: true, message: 'Integration deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/integrations/keys OR /api/api-keys — list API keys
router.get('/keys', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    
    let query = 'SELECT id, organization_id, key_prefix, name, description, scopes, rate_limit_per_minute, last_used_at, expires_at, status, created_at FROM api_keys';
    const params: any[] = [];
    if (organization_id) {
      query += ' WHERE organization_id = $1';
      params.push(organization_id);
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/keys — generate scoped API key
router.post('/keys', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);
    const { name, description, scopes, rate_limit_per_minute } = req.body;
    
    // Generate secure API key
    const rawKey = `ek_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 10);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const result = await pool.query(
      `INSERT INTO api_keys (organization_id, key_prefix, key_hash, name, description, scopes, rate_limit_per_minute, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id, key_prefix, name, scopes, status, created_at`,
      [organization_id, keyPrefix, keyHash, name, description, JSON.stringify(scopes || ['read:donations']), rate_limit_per_minute || 60]
    );

    res.status(201).json({ 
      success: true, 
      data: {
        ...result.rows[0],
        full_key: rawKey // only returned once upon creation!
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/integrations/keys/:id — revoke API key (Superadmin Only)
router.delete('/keys/:id', authenticate, authorizeRole(['superadmin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query("UPDATE api_keys SET status = 'revoked' WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'API key not found' });
    
    res.json({ success: true, message: 'API key revoked' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// MULTI-PROVIDER COMMUNICATIONS GATEWAY (WhatsApp: Meta + EvoGo / Email: SES + SMTP)
// =========================================================================

import { 
  dispatchWhatsAppMessage, 
  dispatchEmailMessage, 
  checkEvolutionInstanceStatus, 
  getEvolutionInstanceQrCode,
  createEvolutionInstance,
  logoutEvolutionInstance
} from '../services/messagingRouter';

// GET /api/integrations/communications — Get communication configs for organization
router.get('/communications', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    if (!organization_id) {
      return res.status(400).json({ success: false, message: 'Organization ID is required' });
    }

    const result = await pool.query(
      `SELECT id, name, whatsapp_config, whatsapp_meta_config, email_config, verified_sender_email, reply_to_email, sender_name 
       FROM organizations WHERE id = $1`,
      [organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const org = result.rows[0];
    
    // Normalize whatsapp_config
    const rawWa = org.whatsapp_config || {};
    const legacyMeta = org.whatsapp_meta_config || {};
    const whatsapp_config = {
      provider: rawWa.provider || (legacyMeta.phone_id ? 'meta' : (rawWa.evolution_go?.api_url ? 'evolution_go' : 'none')),
      meta: {
        waba_id: rawWa.meta?.waba_id || legacyMeta.waba_id || '',
        phone_id: rawWa.meta?.phone_id || legacyMeta.phone_id || '',
        token: rawWa.meta?.token || legacyMeta.token || ''
      },
      evolution_go: {
        api_url: rawWa.evolution_go?.api_url || '',
        api_key: rawWa.evolution_go?.api_key || '',
        instance_name: rawWa.evolution_go?.instance_name || org.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
      }
    };

    // Normalize email_config
    const rawEmail = org.email_config || {};
    const email_config = {
      provider: rawEmail.provider || (rawEmail.ses?.access_key_id ? 'ses' : (rawEmail.smtp?.host ? 'smtp' : 'none')),
      sender_name: rawEmail.sender_name || org.sender_name || org.name || 'DanaPro',
      from_email: rawEmail.from_email || org.verified_sender_email || 'donations@danapro.org',
      reply_to: rawEmail.reply_to || org.reply_to_email || '',
      ses: {
        region: rawEmail.ses?.region || 'ap-south-1',
        access_key_id: rawEmail.ses?.access_key_id || '',
        secret_access_key: rawEmail.ses?.secret_access_key || ''
      },
      smtp: {
        host: rawEmail.smtp?.host || '',
        port: rawEmail.smtp?.port || 587,
        user: rawEmail.smtp?.user || '',
        pass: rawEmail.smtp?.pass || '',
        secure: Boolean(rawEmail.smtp?.secure)
      }
    };

    res.json({
      success: true,
      data: {
        organization_id: org.id,
        organization_name: org.name,
        whatsapp_config,
        email_config
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/integrations/communications — Save communication configs
router.put('/communications', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    if (!organization_id) {
      return res.status(400).json({ success: false, message: 'Organization ID is required' });
    }

    const { whatsapp_config, email_config } = req.body;

    const legacyMeta = whatsapp_config?.meta || {};
    const verifiedSender = email_config?.from_email || null;
    const replyTo = email_config?.reply_to || null;
    const senderName = email_config?.sender_name || null;

    const result = await pool.query(
      `UPDATE organizations SET 
         whatsapp_config = $1,
         whatsapp_meta_config = $2,
         email_config = $3,
         verified_sender_email = COALESCE($4, verified_sender_email),
         reply_to_email = COALESCE($5, reply_to_email),
         sender_name = COALESCE($6, sender_name)
       WHERE id = $7
       RETURNING id, name, whatsapp_config, email_config, verified_sender_email`,
      [
        JSON.stringify(whatsapp_config || {}),
        JSON.stringify(legacyMeta || {}),
        JSON.stringify(email_config || {}),
        verifiedSender,
        replyTo,
        senderName,
        organization_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.json({
      success: true,
      message: 'Communication gateways updated successfully!',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/whatsapp/test — Send test WhatsApp message
router.post('/whatsapp/test', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    const { phone, message, provider, api_url, api_key, instance_name, meta } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required.' });
    }

    const testText = message || '✨ *DanaPro Test Message*\n\nYour WhatsApp connection is configured and working perfectly! 🎉';

    let configOverride: any = undefined;
    if (provider) {
      configOverride = {
        provider,
        meta: meta || {},
        evolution_go: {
          api_url: api_url || 'http://localhost:8080',
          api_key: api_key || '',
          instance_name: instance_name || 'danapro_main'
        }
      };
    }

    const dispatchResult = await dispatchWhatsAppMessage({
      organizationId: organization_id,
      recipientPhone: phone,
      messageText: testText,
      configOverride
    });

    if (dispatchResult.success) {
      return res.json({
        success: true,
        provider: dispatchResult.provider,
        messageId: dispatchResult.messageId,
        message: `Test WhatsApp message sent successfully via ${dispatchResult.provider.toUpperCase()}!`
      });
    } else {
      return res.status(400).json({
        success: false,
        provider: dispatchResult.provider,
        error: dispatchResult.error || 'Failed to dispatch test message',
        message: dispatchResult.error || 'Failed to dispatch test message',
        rawResponse: dispatchResult.rawResponse
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/whatsapp/evolution/status — Check Evolution Go instance status
router.post('/whatsapp/evolution/status', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    let { api_url, api_key, instance_name } = req.body;

    // If not provided in body, load from DB
    if (!api_url && organization_id) {
      const orgRes = await pool.query('SELECT whatsapp_config, name FROM organizations WHERE id = $1', [organization_id]);
      if (orgRes.rows.length > 0) {
        const evo = orgRes.rows[0].whatsapp_config?.evolution_go || {};
        api_url = evo.api_url;
        api_key = evo.api_key;
        instance_name = evo.instance_name || orgRes.rows[0].name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      }
    }

    if (!api_url) {
      return res.status(400).json({ success: false, message: 'Evolution Go API URL is required' });
    }

    const statusRes = await checkEvolutionInstanceStatus(api_url, api_key || '', instance_name || 'default');
    res.json({
      success: statusRes.ok,
      instance_name: instance_name || 'default',
      state: statusRes.status,
      data: statusRes.data,
      error: statusRes.error
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/whatsapp/evolution/qrcode — Fetch pairing QR code from Evolution Go
router.post('/whatsapp/evolution/qrcode', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    let { api_url, api_key, instance_name } = req.body;

    if (!api_url && organization_id) {
      const orgRes = await pool.query('SELECT whatsapp_config, name FROM organizations WHERE id = $1', [organization_id]);
      if (orgRes.rows.length > 0) {
        const evo = orgRes.rows[0].whatsapp_config?.evolution_go || {};
        api_url = evo.api_url;
        api_key = evo.api_key;
        instance_name = evo.instance_name || orgRes.rows[0].name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      }
    }

    if (!api_url) {
      return res.status(400).json({ success: false, message: 'Evolution Go API URL is required' });
    }

    const qrRes = await getEvolutionInstanceQrCode(api_url, api_key || '', instance_name || 'default');
    res.json({
      success: qrRes.ok,
      qrcode: qrRes.qrcode,
      instance_name: instance_name || 'default',
      isConnected: qrRes.isConnected || false,
      isOffline: qrRes.isOffline || false,
      message: qrRes.message || null,
      error: qrRes.error,
      data: qrRes.data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/whatsapp/evolution/create — Initialize / Create instance in Evolution Go
router.post('/whatsapp/evolution/create', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    let { api_url, api_key, instance_name } = req.body;

    if (!api_url && organization_id) {
      const orgRes = await pool.query('SELECT whatsapp_config, name FROM organizations WHERE id = $1', [organization_id]);
      if (orgRes.rows.length > 0) {
        const evo = orgRes.rows[0].whatsapp_config?.evolution_go || {};
        api_url = evo.api_url;
        api_key = evo.api_key;
        instance_name = evo.instance_name || orgRes.rows[0].name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      }
    }

    if (!api_url) {
      return res.status(400).json({ success: false, message: 'Evolution Go API URL is required' });
    }

    const createRes = await createEvolutionInstance(api_url, api_key || '', instance_name || 'danapro_main');
    res.json({
      success: createRes.ok,
      instance_name: instance_name || 'danapro_main',
      data: createRes.data,
      error: createRes.error,
      message: createRes.ok ? `Instance [${instance_name}] initialized successfully on Evolution Go!` : createRes.error
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/whatsapp/evolution/logout — Logout instance & clear session
router.post('/whatsapp/evolution/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    let { api_url, api_key, instance_name } = req.body;

    if (!api_url && organization_id) {
      const orgRes = await pool.query('SELECT whatsapp_config, name FROM organizations WHERE id = $1', [organization_id]);
      if (orgRes.rows.length > 0) {
        const evo = orgRes.rows[0].whatsapp_config?.evolution_go || {};
        api_url = evo.api_url;
        api_key = evo.api_key;
        instance_name = evo.instance_name || orgRes.rows[0].name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      }
    }

    if (!api_url) {
      return res.status(400).json({ success: false, message: 'Evolution Go API URL is required' });
    }

    const logoutRes = await logoutEvolutionInstance(api_url, api_key || '', instance_name || 'danapro_main');
    res.json({
      success: logoutRes.ok,
      message: logoutRes.ok ? `Instance [${instance_name}] logged out successfully. You can scan a new QR code.` : (logoutRes as any).message || (logoutRes as any).error || 'Logged out'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/email/test — Send test email
router.post('/email/test', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.body.organization_id || req.query.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    const { email, subject, message } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid recipient email is required.' });
    }

    const testSubject = subject || 'DanaPro Email Gateway Test';
    const testBody = message || '<div style="font-family: sans-serif; padding: 20px; border: 1px solid #10B981; border-radius: 8px;"><h2 style="color: #059669;">✅ Email Gateway Connected</h2><p>Your custom email provider configuration is working properly!</p></div>';

    const dispatchResult = await dispatchEmailMessage({
      organizationId: organization_id,
      recipientEmail: email,
      subject: testSubject,
      htmlBody: testBody
    });

    if (dispatchResult.success) {
      return res.json({
        success: true,
        provider: dispatchResult.provider,
        messageId: dispatchResult.messageId,
        message: `Test email sent successfully via ${dispatchResult.provider.toUpperCase()}!`
      });
    } else {
      return res.status(400).json({
        success: false,
        provider: dispatchResult.provider,
        error: dispatchResult.error || 'Failed to dispatch test email',
        rawResponse: dispatchResult.rawResponse
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/integrations/gateways/overview — Overview of connected WhatsApp & Email gateways (for NGO & Superadmin)
router.get('/gateways/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userOrgId = user?.role === 'superadmin'
      ? (req.query.organizationId as string | undefined)
      : (user?.organizationId || user?.organization_id);

    let query = `SELECT id, name, slug, whatsapp_config, email_config, whatsapp_meta_config, created_at FROM organizations`;
    const params: any[] = [];
    if (userOrgId) {
      params.push(userOrgId);
      query += ` WHERE id = $1`;
    } else if (user?.role !== 'superadmin') {
      return res.status(200).json({ success: true, totalConnected: 0, totalGateways: 0, gateways: [] });
    }
    query += ` ORDER BY name ASC`;

    const orgsRes = await pool.query(query, params);

    // Check Evolution Go instances status
    let liveEvoInstances: any[] = [];
    try {
      const evoHealthRes = await fetch('http://localhost:8080/health', { method: 'GET' });
      if (evoHealthRes.ok) {
        const healthData: any = await evoHealthRes.json();
        liveEvoInstances = Array.isArray(healthData.instances) ? healthData.instances : [];
      }
    } catch (e) {
      // Evolution Go might be offline
    }

    const gateways: any[] = [];

    for (const org of orgsRes.rows) {
      const wa = org.whatsapp_config || {};
      const legacyMeta = org.whatsapp_meta_config || {};
      const em = org.email_config || {};

      // 1. WhatsApp Entry
      let waProvider = wa.provider || (legacyMeta.phone_id ? 'meta' : (wa.evolution_go?.api_url ? 'evolution_go' : null));
      const instName = wa.evolution_go?.instance_name || org.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      let liveInst = liveEvoInstances.find((li: any) => li.name === instName || li.instanceName === instName || li.name === org.slug);
      let status = 'offline';
      let connectedPhone = null;

      // If provider is evolution_go or unconfigured, check live Evolution Go service
      if (waProvider === 'evolution_go' || !waProvider || waProvider === 'none') {
        const evoUrl = wa.evolution_go?.api_url || 'http://localhost:8080';
        const evoKey = wa.evolution_go?.api_key || '';
        try {
          const liveCheck = await checkEvolutionInstanceStatus(evoUrl, evoKey, instName);
          if (liveCheck.ok && (liveCheck.status === 'open' || liveCheck.status === 'connected')) {
            status = 'connected';
            waProvider = 'evolution_go';
            connectedPhone = liveCheck.data?.instance?.phone || liveCheck.data?.phone ? `+${liveCheck.data?.instance?.phone || liveCheck.data?.phone}` : 'Paired & Active';
          } else if (liveCheck.ok) {
            status = liveCheck.status || 'connecting';
            if (waProvider !== 'none') waProvider = 'evolution_go';
          }
        } catch (e) {
          // Ignore
        }
      }

      if (waProvider && waProvider !== 'none') {
        let identifier = '';

        if (waProvider === 'evolution_go') {
          identifier = instName;
          if (status !== 'connected' && liveInst && (liveInst.state === 'open' || liveInst.status === 'connected')) {
            status = 'connected';
            connectedPhone = liveInst.phone ? `+${liveInst.phone}` : 'Paired & Active';
          }
        } else if (waProvider === 'meta') {
          const meta = wa.meta || legacyMeta;
          identifier = `Phone ID: ${meta.phone_id || 'Not set'}`;
          connectedPhone = meta.waba_id ? `WABA: ${meta.waba_id}` : null;
          status = meta.phone_id && meta.token ? 'connected' : 'incomplete';
        }

        gateways.push({
          id: `wa_${org.id}`,
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          type: 'whatsapp',
          provider: waProvider,
          providerLabel: waProvider === 'evolution_go' ? 'Evolution Go (whatsmeow)' : 'Meta Cloud API',
          identifier: identifier,
          connectedPhone: connectedPhone || (status === 'connected' ? 'WhatsApp Device Connected' : 'Not Connected'),
          status: status,
          details: wa,
          updatedAt: org.created_at
        });
      }

      // 2. Email Entry
      const emProvider = em.provider;
      if (emProvider && emProvider !== 'none' && (em.from_email || em.ses?.access_key_id || em.smtp?.host)) {
        let identifier = em.from_email || 'donations@danapro.org';
        let status = 'connected';

        if (emProvider === 'ses') {
          identifier = `${em.from_email || 'AWS SES'} (${em.ses?.region || 'AWS SES'})`;
        } else if (emProvider === 'smtp') {
          identifier = `${em.from_email || 'SMTP'} (${em.smtp?.host || 'SMTP'}:${em.smtp?.port || 587})`;
        }

        gateways.push({
          id: `em_${org.id}`,
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          type: 'email',
          provider: emProvider,
          providerLabel: emProvider === 'ses' ? 'AWS SES' : 'Custom SMTP',
          identifier: identifier,
          connectedPhone: em.sender_name || org.name,
          status: status,
          details: em,
          updatedAt: org.created_at
        });
      }
    }

    return res.status(200).json({
      success: true,
      totalConnected: gateways.filter(g => g.status === 'connected').length,
      totalGateways: gateways.length,
      gateways
    });
  } catch (error: any) {
    console.error('Integrations gateways overview error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/integrations/gateways/disconnect — Disconnect and delete gateway connection
router.post('/gateways/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const targetOrgId = user?.role === 'superadmin' 
      ? (req.body.organizationId || user?.organizationId || user?.organization_id)
      : (user?.organizationId || user?.organization_id);

    const { type } = req.body;
    if (!targetOrgId || !type) {
      return res.status(400).json({ success: false, message: 'Organization ID and gateway type are required.' });
    }

    const orgRes = await pool.query('SELECT name, whatsapp_config, email_config FROM organizations WHERE id = $1', [targetOrgId]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    const org = orgRes.rows[0];

    if (type === 'whatsapp') {
      const waConfig = org.whatsapp_config || {};
      const evoUrl = waConfig.evolution_go?.api_url || 'http://localhost:8080';
      const evoKey = waConfig.evolution_go?.api_key || '';
      const instName = waConfig.evolution_go?.instance_name || org.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      try {
        await logoutEvolutionInstance(evoUrl, evoKey, instName);
      } catch (e) {
        // Ignore
      }

      await pool.query(
        `UPDATE organizations 
         SET whatsapp_config = '{"provider": "none"}'::jsonb,
             whatsapp_meta_config = '{}'::jsonb
         WHERE id = $1`,
        [targetOrgId]
      );
      return res.status(200).json({ success: true, message: `WhatsApp gateway disconnected and disabled for ${org.name}.` });
    }

    if (type === 'email') {
      await pool.query(
        `UPDATE organizations 
         SET email_config = '{"provider": "none"}'::jsonb 
         WHERE id = $1`,
        [targetOrgId]
      );
      return res.status(200).json({ success: true, message: `Email gateway disconnected and disabled for ${org.name}.` });
    }

    return res.status(400).json({ success: false, message: 'Invalid gateway type specified.' });
  } catch (error: any) {
    console.error('Integrations gateway disconnect error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

