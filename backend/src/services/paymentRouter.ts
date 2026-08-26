import crypto from 'crypto';
import Razorpay from 'razorpay';
import pool from '../config/db';

export interface GatewayCredentials {
  // Razorpay
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  razorpay_webhook_secret?: string;

  // PayU India
  payu_merchant_key?: string;
  payu_merchant_salt?: string;
  payu_webhook_secret?: string;
  payu_mode?: 'test' | 'live';

  // CCAvenue
  ccavenue_merchant_id?: string;
  ccavenue_access_code?: string;
  ccavenue_working_key?: string;

  // AU Small Finance Bank / Worldline
  worldline_merchant_id?: string;
  worldline_secret_key?: string;
  worldline_terminal_id?: string;

  // Cashfree
  cashfree_app_id?: string;
  cashfree_secret_key?: string;
}

export interface GatewayRailItem {
  id: string;
  type: 'razorpay' | 'payu' | 'ccavenue' | 'worldline' | 'cashfree';
  name: string;
  is_active: boolean;
  credentials: Record<string, string>;
}

export interface ResolvedGatewayRouting {
  activeGateway: string;
  activeRail: GatewayRailItem | null;
  credentials: Record<string, string>;
  isFallback: boolean;
  failoverReason?: string;
  availableRails: GatewayRailItem[];
}

/**
 * Fetch global system settings from DB
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
  const { rows } = await pool.query('SELECT key, value FROM system_settings');
  const map: Record<string, string> = {};
  rows.forEach((r: any) => {
    map[r.key] = r.value;
  });
  return map;
}

/**
 * Extract all configured gateway rails from an NGO's payment_gateways_config
 */
export function extractNgoGatewayRails(orgPaymentConfig: any, sysSettings: Record<string, string> = {}): GatewayRailItem[] {
  const rails: GatewayRailItem[] = [];
  const cfg = orgPaymentConfig || {};

  // Check if modern multi-rail array exists
  if (Array.isArray(cfg.gateways)) {
    cfg.gateways.forEach((g: any) => {
      if (g && g.type && g.is_active !== false) {
        rails.push({
          id: g.id || `gw_${g.type}_${rails.length + 1}`,
          type: g.type,
          name: g.name || `${g.type.toUpperCase()} Rail`,
          is_active: true,
          credentials: g.credentials || {}
        });
      }
    });
    if (rails.length > 0) {
      return rails;
    }
  }

  // Also support flat legacy / individual fields on NGO
  if (cfg.razorpay_key_id && !rails.some(r => r.type === 'razorpay' && r.credentials.key_id === cfg.razorpay_key_id)) {
    rails.push({
      id: 'gw_rzp_ngo_default',
      type: 'razorpay',
      name: 'Razorpay Gateway',
      is_active: true,
      credentials: {
        key_id: cfg.razorpay_key_id,
        key_secret: cfg.razorpay_key_secret || '',
        webhook_secret: cfg.razorpay_webhook_secret || ''
      }
    });
  }

  if (cfg.payu_merchant_key && !rails.some(r => r.type === 'payu' && r.credentials.merchant_key === cfg.payu_merchant_key)) {
    rails.push({
      id: 'gw_payu_ngo_default',
      type: 'payu',
      name: 'PayU India Gateway',
      is_active: true,
      credentials: {
        merchant_key: cfg.payu_merchant_key,
        merchant_salt: cfg.payu_merchant_salt || '',
        webhook_secret: cfg.payu_webhook_secret || '',
        mode: cfg.payu_mode || 'test'
      }
    });
  }

  if (cfg.ccavenue_merchant_id && !rails.some(r => r.type === 'ccavenue' && r.credentials.merchant_id === cfg.ccavenue_merchant_id)) {
    rails.push({
      id: 'gw_ccav_ngo_default',
      type: 'ccavenue',
      name: 'CCAvenue Gateway',
      is_active: true,
      credentials: {
        merchant_id: cfg.ccavenue_merchant_id,
        access_code: cfg.ccavenue_access_code || '',
        working_key: cfg.ccavenue_working_key || ''
      }
    });
  }

  if (cfg.worldline_merchant_id && !rails.some(r => r.type === 'worldline' && r.credentials.merchant_id === cfg.worldline_merchant_id)) {
    rails.push({
      id: 'gw_wl_ngo_default',
      type: 'worldline',
      name: 'AU Bank / Worldline Gateway',
      is_active: true,
      credentials: {
        merchant_id: cfg.worldline_merchant_id,
        terminal_id: cfg.worldline_terminal_id || '',
        secret_key: cfg.worldline_secret_key || ''
      }
    });
  }

  if (cfg.cashfree_app_id && !rails.some(r => r.type === 'cashfree' && r.credentials.app_id === cfg.cashfree_app_id)) {
    rails.push({
      id: 'gw_cf_ngo_default',
      type: 'cashfree',
      name: 'Cashfree Gateway',
      is_active: true,
      credentials: {
        app_id: cfg.cashfree_app_id,
        secret_key: cfg.cashfree_secret_key || ''
      }
    });
  }

  // If no rails found on NGO, inject platform system default rails
  if (rails.length === 0) {
    if (sysSettings.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID) {
      rails.push({
        id: 'gw_rzp_sys',
        type: 'razorpay',
        name: 'Razorpay Platform Master',
        is_active: true,
        credentials: {
          key_id: sysSettings.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TIAIr4GaDu23Uq',
          key_secret: sysSettings.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'mock_secret',
          webhook_secret: sysSettings.RAZORPAY_WEBHOOK_SECRET || ''
        }
      });
    }
    if (sysSettings.PAYU_MERCHANT_KEY || process.env.PAYU_MERCHANT_KEY) {
      rails.push({
        id: 'gw_payu_sys',
        type: 'payu',
        name: 'PayU India Platform Master',
        is_active: true,
        credentials: {
          merchant_key: sysSettings.PAYU_MERCHANT_KEY || 'gtKFFx',
          merchant_salt: sysSettings.PAYU_MERCHANT_SALT || 'eCwWELxi',
          webhook_secret: sysSettings.PAYU_WEBHOOK_SECRET || '',
          mode: (sysSettings.PAYU_MODE as any) || 'test'
        }
      });
    }
    if (sysSettings.CCAVENUE_MERCHANT_ID) {
      rails.push({
        id: 'gw_ccav_sys',
        type: 'ccavenue',
        name: 'CCAvenue Platform Master',
        is_active: true,
        credentials: {
          merchant_id: sysSettings.CCAVENUE_MERCHANT_ID || '2849102',
          access_code: sysSettings.CCAVENUE_ACCESS_CODE || 'AVIN02KJ91BC02',
          working_key: sysSettings.CCAVENUE_WORKING_KEY || '8B9F04D92841CA902E41829B0482910F'
        }
      });
    }
    if (sysSettings.WORLDLINE_MERCHANT_ID) {
      rails.push({
        id: 'gw_wl_sys',
        type: 'worldline',
        name: 'AU Bank / Worldline Master',
        is_active: true,
        credentials: {
          merchant_id: sysSettings.WORLDLINE_MERCHANT_ID || 'WL_AUBANK_89210',
          terminal_id: sysSettings.WORLDLINE_TERMINAL_ID || 'AUB_TID_00192',
          secret_key: sysSettings.WORLDLINE_SECRET_KEY || 'sec_aubank_worldline_891023'
        }
      });
    }
    if (sysSettings.CASHFREE_APP_ID) {
      rails.push({
        id: 'gw_cf_sys',
        type: 'cashfree',
        name: 'Cashfree Platform Master',
        is_active: true,
        credentials: {
          app_id: sysSettings.CASHFREE_APP_ID || 'CF_APP_91029384',
          secret_key: sysSettings.CASHFREE_SECRET_KEY || 'cf_sec_91823901823901283'
        }
      });
    }
  }

  return rails;
}

/**
 * Resolve active gateway for a campaign, with fallback and NGO checkbox alignment
 */
export async function resolveCampaignPaymentRouting(
  campaignPaymentConfig: any,
  orgPaymentConfig: any,
  requestedGateway?: string
): Promise<ResolvedGatewayRouting> {
  const sysSettings = await getSystemSettings();
  const ngoRails = extractNgoGatewayRails(orgPaymentConfig, sysSettings);

  const campCfg = campaignPaymentConfig || {};
  const assignedGatewayIds: string[] = Array.isArray(campCfg.assigned_gateway_ids) 
    ? campCfg.assigned_gateway_ids 
    : [];

  // Filter rails assigned to this campaign via checkbox
  let allowedRails: GatewayRailItem[] = [];
  if (assignedGatewayIds.length > 0) {
    allowedRails = ngoRails.filter(r => assignedGatewayIds.includes(r.id) || assignedGatewayIds.includes(r.type));
  }
  
  // If no explicit checkboxes were saved, all NGO's active rails are available
  if (allowedRails.length === 0) {
    allowedRails = ngoRails.filter(r => r.is_active);
  }

  // Fallback to all rails if still empty
  if (allowedRails.length === 0) {
    allowedRails = ngoRails;
  }

  // Determine primary & fallback gateway preference
  const primaryPref = campCfg.primary_gateway || orgPaymentConfig?.primary_gateway || sysSettings.PRIMARY_PAYMENT_GATEWAY || 'razorpay';
  const fallbackPref = campCfg.fallback_gateway || orgPaymentConfig?.fallback_gateway || sysSettings.FALLBACK_PAYMENT_GATEWAY || 'payu';

  // 1. If a specific gateway was requested by donor (e.g., PayU, Razorpay, CCAvenue, Worldline, Cashfree)
  if (requestedGateway) {
    const matched = allowedRails.find(r => r.type === requestedGateway.toLowerCase() || r.id === requestedGateway);
    if (matched) {
      return {
        activeGateway: matched.type,
        activeRail: matched,
        credentials: matched.credentials,
        isFallback: false,
        availableRails: allowedRails
      };
    }
  }

  // 2. Select primary rail from allowed rails
  let selectedRail = allowedRails.find(r => r.type === primaryPref || r.id === primaryPref);
  if (!selectedRail && allowedRails.length > 0) {
    selectedRail = allowedRails[0];
  }

  return {
    activeGateway: selectedRail ? selectedRail.type : 'razorpay',
    activeRail: selectedRail || null,
    credentials: selectedRail ? selectedRail.credentials : {},
    isFallback: false,
    availableRails: allowedRails
  };
}

/**
 * PayU India SHA-512 Hash Generation
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function generatePayUHash(params: {
  key: string;
  txnid: string;
  amount: number | string;
  productinfo: string;
  firstname: string;
  email: string;
  salt: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): string {
  const hashString = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|${params.udf1 || ''}|${params.udf2 || ''}|${params.udf3 || ''}|${params.udf4 || ''}|${params.udf5 || ''}||||||${params.salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * PayU India Reverse Hash Verification for Webhook / Response
 * Formula: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function verifyPayUReverseHash(params: {
  salt: string;
  status: string;
  email: string;
  firstname: string;
  productinfo: string;
  amount: number | string;
  txnid: string;
  key: string;
  receivedHash: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): boolean {
  const reverseString = `${params.salt}|${params.status}||||||${params.udf5 || ''}|${params.udf4 || ''}|${params.udf3 || ''}|${params.udf2 || ''}|${params.udf1 || ''}|${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`;
  const calculatedHash = crypto.createHash('sha512').update(reverseString).digest('hex');
  return calculatedHash.toLowerCase() === params.receivedHash.toLowerCase();
}

/**
 * CCAvenue AES-128-CBC Encrypt / Decrypt helpers
 */
export function encryptCCAvenue(plainText: string, workingKey: string): string {
  try {
    const keyHash = crypto.createHash('md5').update(workingKey).digest();
    const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const cipher = crypto.createCipheriv('aes-128-cbc', keyHash, iv);
    let encoded = cipher.update(plainText, 'utf8', 'hex');
    encoded += cipher.final('hex');
    return encoded;
  } catch (err) {
    return Buffer.from(plainText).toString('base64');
  }
}

export function decryptCCAvenue(encText: string, workingKey: string): string {
  try {
    const keyHash = crypto.createHash('md5').update(workingKey).digest();
    const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const decipher = crypto.createDecipheriv('aes-128-cbc', keyHash, iv);
    let decoded = decipher.update(encText, 'hex', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
  } catch (err) {
    try {
      return Buffer.from(encText, 'base64').toString('utf8');
    } catch {
      return encText;
    }
  }
}

/**
 * AU Small Finance Bank / Worldline Checksum Generation
 */
export function generateWorldlineChecksum(params: {
  merchantId: string;
  terminalId: string;
  orderId: string;
  amount: number | string;
  currency: string;
  secretKey: string;
}): string {
  const payload = `${params.merchantId}|${params.terminalId}|${params.orderId}|${params.amount}|${params.currency}|${params.secretKey}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Main Checkout Session Dispatcher across all 5 Gateways with Smart Failover
 */
export async function initiateMultiGatewayPayment(params: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  organizationId: string;
  orgName: string;
  amount: number;
  currency: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorTaxId?: string;
  customFormData?: any;
  paymentConfig: any;
  orgPaymentConfig: any;
  requestedGateway?: string;
  forceSandbox?: boolean;
}): Promise<{
  success: boolean;
  mode: 'razorpay' | 'payu' | 'ccavenue' | 'worldline' | 'cashfree' | 'sandbox';
  gateway: string;
  orderId: string;
  amount: number;
  currency: string;
  isFallback: boolean;
  failoverReason?: string;
  checkoutPayload: Record<string, any>;
  availableRails: Array<{ id: string; type: string; name: string }>;
}> {
  const routing = await resolveCampaignPaymentRouting(params.paymentConfig, params.orgPaymentConfig, params.requestedGateway);
  const sysSettings = await getSystemSettings();
  const enableAutoFailover = (params.paymentConfig?.enable_auto_failover ?? params.orgPaymentConfig?.enable_auto_failover ?? sysSettings.ENABLE_AUTO_FAILOVER) !== 'false';

  let activeGw = routing.activeGateway;
  let activeCreds = routing.credentials;
  let isFallback = false;
  let failoverReason: string | undefined;

  const txnId = `txn_${activeGw}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Sandbox bypass
  if (params.forceSandbox) {
    return {
      success: true,
      mode: 'sandbox',
      gateway: activeGw,
      orderId: `order_sandbox_${Date.now()}`,
      amount: params.amount,
      currency: params.currency,
      isFallback: false,
      checkoutPayload: {
        sandboxMessage: 'Sandbox Mode Active. Instant simulated verification available.',
        transactionId: txnId
      },
      availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
    };
  }

  // 1. RAZORPAY RAIL
  if (activeGw === 'razorpay') {
    const keyId = activeCreds.key_id || activeCreds.razorpay_key_id || sysSettings.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TIAIr4GaDu23Uq';
    const keySecret = activeCreds.key_secret || activeCreds.razorpay_key_secret || sysSettings.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'mock_secret';

    let rzpOrderId = `order_rzp_${Date.now()}`;
    let rzpError: string | null = null;

    if (keyId && !keyId.includes('mock') && !keyId.includes('sandbox')) {
      try {
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const orderPromise = rzp.orders.create({
          amount: Math.round(params.amount * 100),
          currency: params.currency,
          receipt: `rcpt_${Date.now().toString().slice(-8)}`,
          notes: {
            campaignId: params.campaignId,
            campaignTitle: params.campaignTitle,
            organizationId: params.organizationId
          }
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Razorpay API timeout')), 3000));
        const createdOrder: any = await Promise.race([orderPromise, timeoutPromise]);
        if (createdOrder && createdOrder.id) {
          rzpOrderId = createdOrder.id;
        }
      } catch (err: any) {
        rzpError = err.message || 'Razorpay order creation failure';
        console.warn(`[Razorpay Rail Warning]: ${rzpError}`);
      }
    }

    // If Razorpay threw an error and failover is enabled, switch to Fallback Gateway rail
    if (rzpError && enableAutoFailover && routing.availableRails.length > 1) {
      const fallbackRail = routing.availableRails.find(r => r.type !== 'razorpay') || routing.availableRails[1];
      if (fallbackRail) {
        console.log(`[Smart Failover Engine]: Primary Razorpay encountered issue (${rzpError}). Auto-switching to Fallback Rail: ${fallbackRail.name} (${fallbackRail.type})`);
        activeGw = fallbackRail.type;
        activeCreds = fallbackRail.credentials;
        isFallback = true;
        failoverReason = `Primary Razorpay rail timed out or returned: ${rzpError}. Seamlessly auto-routed to ${fallbackRail.name}.`;
      }
    }

    if (!isFallback) {
      return {
        success: true,
        mode: 'razorpay',
        gateway: 'razorpay',
        orderId: rzpOrderId,
        amount: params.amount,
        currency: params.currency,
        isFallback: false,
        checkoutPayload: {
          keyId: keyId,
          orderId: rzpOrderId,
          amountPaise: Math.round(params.amount * 100),
          currency: params.currency,
          name: params.orgName,
          description: params.campaignTitle,
          prefill: {
            name: params.donorName,
            email: params.donorEmail,
            contact: params.donorPhone || ''
          }
        },
        availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
      };
    }
  }

  // 2. PAYU INDIA RAIL
  if (activeGw === 'payu') {
    const merchantKey = activeCreds.merchant_key || activeCreds.payu_merchant_key || sysSettings.PAYU_MERCHANT_KEY || 'gtKFFx';
    const merchantSalt = activeCreds.merchant_salt || activeCreds.payu_merchant_salt || sysSettings.PAYU_MERCHANT_SALT || 'eCwWELxi';
    const mode = activeCreds.mode || (sysSettings.PAYU_MODE as any) || 'test';
    const payuActionUrl = mode === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';

    const payuHash = generatePayUHash({
      key: merchantKey,
      txnid: txnId,
      amount: params.amount.toFixed(2),
      productinfo: params.campaignTitle.slice(0, 50),
      firstname: params.donorName.split(' ')[0] || 'Donor',
      email: params.donorEmail,
      salt: merchantSalt,
      udf1: params.campaignId,
      udf2: params.organizationId
    });

    return {
      success: true,
      mode: 'payu',
      gateway: 'payu',
      orderId: txnId,
      amount: params.amount,
      currency: params.currency,
      isFallback,
      failoverReason,
      checkoutPayload: {
        actionUrl: payuActionUrl,
        key: merchantKey,
        txnid: txnId,
        amount: params.amount.toFixed(2),
        productinfo: params.campaignTitle.slice(0, 50),
        firstname: params.donorName,
        email: params.donorEmail,
        phone: params.donorPhone || '9876543210',
        hash: payuHash,
        surl: `http://localhost:5000/api/v1/external/webhooks/payu`,
        furl: `http://localhost:5000/api/v1/external/webhooks/payu`,
        mode: mode
      },
      availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
    };
  }

  // 3. CCAVENUE RAIL
  if (activeGw === 'ccavenue') {
    const merchantId = activeCreds.merchant_id || activeCreds.ccavenue_merchant_id || sysSettings.CCAVENUE_MERCHANT_ID || '2849102';
    const accessCode = activeCreds.access_code || activeCreds.ccavenue_access_code || sysSettings.CCAVENUE_ACCESS_CODE || 'AVIN02KJ91BC02';
    const workingKey = activeCreds.working_key || activeCreds.ccavenue_working_key || sysSettings.CCAVENUE_WORKING_KEY || '8B9F04D92841CA902E41829B0482910F';

    const plainParams = `merchant_id=${merchantId}&order_id=${txnId}&currency=${params.currency}&amount=${params.amount.toFixed(2)}&redirect_url=http://localhost:5000/api/v1/external/webhooks/ccavenue&cancel_url=http://localhost:5000/api/v1/external/webhooks/ccavenue&language=EN&billing_name=${encodeURIComponent(params.donorName)}&billing_email=${encodeURIComponent(params.donorEmail)}&billing_tel=${encodeURIComponent(params.donorPhone || '')}`;
    const encRequest = encryptCCAvenue(plainParams, workingKey);

    return {
      success: true,
      mode: 'ccavenue',
      gateway: 'ccavenue',
      orderId: txnId,
      amount: params.amount,
      currency: params.currency,
      isFallback,
      failoverReason,
      checkoutPayload: {
        actionUrl: 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction',
        merchantId,
        accessCode,
        encRequest,
        orderId: txnId
      },
      availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
    };
  }

  // 4. AU SMALL FINANCE BANK / WORLDLINE RAIL
  if (activeGw === 'worldline') {
    const merchantId = activeCreds.merchant_id || activeCreds.worldline_merchant_id || sysSettings.WORLDLINE_MERCHANT_ID || 'WL_AUBANK_89210';
    const terminalId = activeCreds.terminal_id || activeCreds.worldline_terminal_id || sysSettings.WORLDLINE_TERMINAL_ID || 'AUB_TID_00192';
    const secretKey = activeCreds.secret_key || activeCreds.worldline_secret_key || sysSettings.WORLDLINE_SECRET_KEY || 'sec_aubank_worldline_891023';

    const checksum = generateWorldlineChecksum({
      merchantId,
      terminalId,
      orderId: txnId,
      amount: params.amount.toFixed(2),
      currency: params.currency,
      secretKey
    });

    return {
      success: true,
      mode: 'worldline',
      gateway: 'worldline',
      orderId: txnId,
      amount: params.amount,
      currency: params.currency,
      isFallback,
      failoverReason,
      checkoutPayload: {
        merchantId,
        terminalId,
        orderId: txnId,
        amount: params.amount.toFixed(2),
        currency: params.currency,
        checksum,
        bankCode: 'AUB',
        returnUrl: 'http://localhost:5000/api/v1/external/webhooks/worldline'
      },
      availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
    };
  }

  // 5. CASHFREE RAIL
  if (activeGw === 'cashfree') {
    const appId = activeCreds.app_id || activeCreds.cashfree_app_id || sysSettings.CASHFREE_APP_ID;
    const secretKey = activeCreds.secret_key || activeCreds.cashfree_secret_key || sysSettings.CASHFREE_SECRET_KEY;
    const isLive = (activeCreds.mode || sysSettings.CASHFREE_MODE) === 'production' || (appId && !appId.startsWith('TEST') && !appId.includes('sandbox'));
    const cfBaseUrl = isLive ? 'https://api.cashfree.com/pg/orders' : 'https://sandbox.cashfree.com/pg/orders';

    let paymentSessionId: string | null = null;
    let cfError: string | null = null;
    const cfOrderId = `order_cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const donorPhone = (params.donorPhone && params.donorPhone.replace(/\D/g, '').slice(-10)) || '9876543210';

    if (appId && secretKey && !appId.includes('mock') && !appId.includes('sandbox_key') && !appId.includes('CF_APP_91029384')) {
      try {
        const cfRes = await fetch(cfBaseUrl, {
          method: 'POST',
          headers: {
            'x-client-id': appId,
            'x-client-secret': secretKey,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: cfOrderId,
            order_amount: Number(params.amount.toFixed(2)),
            order_currency: params.currency || 'INR',
            customer_details: {
              customer_id: `cust_${Date.now()}`,
              customer_name: params.donorName || 'Donor',
              customer_email: params.donorEmail || 'donor@example.com',
              customer_phone: donorPhone.length === 10 ? donorPhone : '9876543210'
            },
            order_meta: {
              return_url: `http://localhost:5000/api/v1/external/webhooks/cashfree?order_id=${cfOrderId}`
            },
            order_note: `Donation for ${params.campaignTitle.slice(0, 40)}`
          })
        });

        const cfData: any = await cfRes.json();
        if (cfRes.ok && cfData && cfData.payment_session_id) {
          paymentSessionId = cfData.payment_session_id;
          console.log(`[Cashfree Rail Success]: Created Cashfree payment session: ${paymentSessionId} for order ${cfOrderId}`);
        } else {
          cfError = cfData?.message || cfData?.error || `Cashfree API returned HTTP ${cfRes.status}`;
          console.warn(`[Cashfree Rail API Notice]: ${cfError}`, cfData);
        }
      } catch (err: any) {
        cfError = err.message || 'Cashfree API network failure';
        console.warn(`[Cashfree Rail Network Notice]: ${cfError}`);
      }
    }

    return {
      success: true,
      mode: paymentSessionId ? 'cashfree' : 'sandbox',
      gateway: 'cashfree',
      orderId: cfOrderId,
      amount: params.amount,
      currency: params.currency,
      isFallback,
      failoverReason: cfError ? `Cashfree Rail Notice: ${cfError}` : undefined,
      checkoutPayload: {
        appId: appId || 'CF_SANDBOX_KEY',
        orderId: cfOrderId,
        paymentSessionId: paymentSessionId,
        mode: isLive ? 'production' : 'sandbox',
        amount: params.amount,
        currency: params.currency,
        customerDetails: {
          customerId: `cust_${Date.now()}`,
          customerName: params.donorName,
          customerEmail: params.donorEmail,
          customerPhone: donorPhone
        },
        returnUrl: 'http://localhost:5000/api/v1/external/webhooks/cashfree'
      },
      availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
    };
  }

  // Generic Sandbox / Demo Fallback
  return {
    success: true,
    mode: 'sandbox',
    gateway: activeGw,
    orderId: txnId,
    amount: params.amount,
    currency: params.currency,
    isFallback,
    failoverReason,
    checkoutPayload: {
      transactionId: txnId,
      notice: 'Sandbox multi-gateway simulation'
    },
    availableRails: routing.availableRails.map(r => ({ id: r.id, type: r.type, name: r.name }))
  };
}
