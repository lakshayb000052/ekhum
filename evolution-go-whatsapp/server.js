/**
 * Live WhatsApp Multi-Device Gateway Server (Evolution API Spec)
 * Powered by @whiskeysockets/baileys & Node.js
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');

const PORT = process.env.WA_INTERNAL_PORT || 8080;
const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'evolution-global-key-here';

// Active in-memory WhatsApp sockets per instance
const instances = {};

// Helper: Ensure instance session is initialized
async function initInstance(instanceName) {
  if (instances[instanceName] && instances[instanceName].sock) {
    return instances[instanceName];
  }

  const sessionDir = path.join(__dirname, 'sessions', instanceName);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  console.log(`[WhatsApp Engine] Initializing instance [${instanceName}] with Baileys v${version.join('.')}...`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['DanaPro Gateway', 'Chrome', '120.0.0']
  });

  const instanceData = {
    name: instanceName,
    sock,
    state: 'connecting', // 'connecting' | 'open' | 'close'
    qrcode: null,
    qrBase64: null,
    user: null
  };

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      instanceData.qrcode = qr;
      instanceData.state = 'connecting';
      try {
        instanceData.qrBase64 = await QRCode.toDataURL(qr);
        console.log(`[WhatsApp Engine] 📲 New Real Multi-Device QR Code generated for [${instanceName}]. Ready for camera scanning!`);
      } catch (err) {
        console.error('Failed to generate base64 QR:', err);
      }
    }

    if (connection === 'open') {
      instanceData.state = 'open';
      instanceData.qrcode = null;
      instanceData.qrBase64 = null;
      instanceData.user = sock.user;
      console.log(`\n================================================================`);
      console.log(`🎉 [WHATSAPP LINKED SUCCESSFULLY!]`);
      console.log(`📱 Connected as: ${sock.user?.id || sock.user?.name || instanceName}`);
      console.log(`🏢 Instance: ${instanceName}`);
      console.log(`🚀 Ready to dispatch live Journey & Receipt messages!`);
      console.log(`================================================================\n`);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      instanceData.state = 'close';
      console.log(`[WhatsApp Engine] Connection closed for [${instanceName}]. Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        delete instances[instanceName];
        setTimeout(() => initInstance(instanceName), 3000);
      } else {
        console.log(`[WhatsApp Engine] Logged out from WhatsApp. Clear session directory to re-pair.`);
        delete instances[instanceName];
      }
    }
  });

  instances[instanceName] = instanceData;
  return instanceData;
}

// Auto-initialize default instance on startup
initInstance('danapro_main').catch(console.error);

// HTTP Server
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:8080'}`);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Instance');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let bodyStr = '';
  req.on('data', chunk => { bodyStr += chunk; });
  req.on('end', async () => {
    let body = {};
    if (bodyStr) {
      try { body = JSON.parse(bodyStr); } catch (e) {}
    }

    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      // 1. Health / Instances Overview
      if (pathname === '/' || pathname === '/health' || pathname === '/instance/fetchInstances' || pathname === '/instance/all') {
        const list = Object.keys(instances).map(k => {
          const inst = instances[k];
          let userPhone = inst?.user?.id ? String(inst.user.id).split(':')[0].split('@')[0] : null;
          return {
            name: inst?.name || k,
            instanceName: inst?.name || k,
            state: inst?.state || 'connecting',
            status: inst?.state === 'open' ? 'connected' : inst?.state || 'connecting',
            phone: userPhone,
            userName: inst?.user?.name || null
          };
        });

        return sendJson(200, {
          status: 'online',
          message: 'Live WhatsApp Multi-Device Gateway is running 🚀',
          activeInstances: Object.keys(instances),
          instances: list
        });
      }

      // 2. Create / Initialize Instance: POST /instance/create
      if (method === 'POST' && pathname === '/instance/create') {
        const instanceName = body.instanceName || req.headers['instance'] || 'danapro_main';
        const inst = await initInstance(instanceName);
        return sendJson(201, {
          success: true,
          instance: {
            instanceName: instanceName,
            state: inst.state,
            qrcode: inst.qrBase64 || inst.qrcode
          },
          message: `Instance [${instanceName}] active.`
        });
      }

      // 2B. Logout / Re-pair Instance: POST /instance/logout or DELETE /instance/delete
      if ((method === 'POST' || method === 'DELETE') && (pathname.includes('/logout') || pathname.includes('/delete'))) {
        const parts = pathname.split('/').filter(Boolean);
        const instanceName = parts[2] || parts[1] || req.headers['instance'] || body.instanceName || 'danapro_main';
        console.log(`[WhatsApp Engine] Logging out & clearing session for [${instanceName}]...`);
        
        if (instances[instanceName]) {
          try { await instances[instanceName].sock?.logout?.(); } catch (e) {}
          delete instances[instanceName];
        }

        const sessionDir = path.join(__dirname, 'sessions', instanceName);
        if (fs.existsSync(sessionDir)) {
          try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
        }

        // Reinitialize immediately for new QR
        const newInst = await initInstance(instanceName);
        await new Promise(r => setTimeout(r, 1500));

        return sendJson(200, {
          success: true,
          message: `Session cleared for [${instanceName}]. Ready for new pairing QR scan.`,
          qrcode: newInst.qrBase64 || newInst.qrcode
        });
      }

      // 3. Status: GET /instance/:name/status or /instance/connectionState/:name
      if (method === 'GET' && (pathname.includes('/status') || pathname.includes('/connectionState'))) {
        const parts = pathname.split('/').filter(Boolean);
        const instanceName = parts[1] === 'connectionState' || parts[1] === 'status' ? parts[2] : parts[1] || 'danapro_main';
        const inst = instances[instanceName] || await initInstance(instanceName);
        return sendJson(200, {
          status: 200,
          instance: {
            instanceName: instanceName,
            state: inst.state
          },
          state: inst.state
        });
      }

      // 4. QR Code: GET /instance/:name/qrcode or /instance/connect/:name or /instance/qrcode/:name
      if (method === 'GET' && (pathname.includes('/qrcode') || pathname.includes('/connect') || pathname.includes('/qr'))) {
        const parts = pathname.split('/').filter(Boolean);
        let instanceName = req.headers['instance'] || 'danapro_main';
        if (parts.length >= 3 && (parts[0] === 'instance' && (parts[1] === 'connect' || parts[1] === 'qrcode' || parts[1] === 'qr'))) {
          instanceName = parts[2];
        } else if (parts.length >= 2 && parts[0] === 'instance') {
          instanceName = parts[1];
        }

        let inst = instances[instanceName];
        if (!inst) {
          inst = await initInstance(instanceName);
          // Wait brief moment for QR event to fire
          await new Promise(r => setTimeout(r, 1200));
        }

        const qrData = inst.qrBase64 || inst.qrcode;
        return sendJson(200, {
          status: 200,
          qrcode: qrData,
          base64: qrData,
          code: inst.qrcode,
          instance: {
            instanceName: instanceName,
            state: inst.state,
            qrcode: qrData
          }
        });
      }

      // 5. Send Text Message: POST /message/sendText
      if (method === 'POST' && (pathname === '/message/sendText' || pathname.endsWith('/sendText'))) {
        const { number, text } = body;
        let instanceName = req.headers['instance'] || body.instance || 'danapro_main';
        let inst = instances[instanceName];

        // Smart Fallback: if specified instance is not open, use the connected open instance
        if (!inst || inst.state !== 'open') {
          const openKey = Object.keys(instances).find(k => instances[k] && instances[k].state === 'open');
          if (openKey) {
            inst = instances[openKey];
            instanceName = openKey;
            console.log(`[WhatsApp Engine] Routed message to connected active instance [${openKey}]`);
          }
        }

        if (!inst || !inst.sock || inst.state !== 'open') {
          return sendJson(400, {
            success: false,
            message: `WhatsApp instance [${instanceName}] is not linked with WhatsApp yet. Please scan the QR code.`,
            error: `WhatsApp instance [${instanceName}] is not linked with WhatsApp yet. Please scan the QR code.`
          });
        }

        // Clean phone number format (Auto prefix 91 if 10 digits)
        let cleanPhone = String(number || '').replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) {
          cleanPhone = '91' + cleanPhone;
        }
        if (!cleanPhone.includes('@s.whatsapp.net')) {
          cleanPhone = `${cleanPhone}@s.whatsapp.net`;
        }

        console.log(`\n======================================================`);
        console.log(`💬 [WHATSAPP DISPATCH] To: ${cleanPhone}`);
        console.log(`📝 Message: ${text}`);
        console.log(`🏢 Instance: ${instanceName}`);
        console.log(`======================================================\n`);

        const sendResult = await inst.sock.sendMessage(cleanPhone, { text });

        return sendJson(200, {
          success: true,
          key: sendResult.key,
          messageId: sendResult.key?.id,
          status: 'SERVER_ACK',
          message: 'WhatsApp message sent successfully!'
        });
      }

      // 6. Send Media: POST /message/sendMedia
      if (method === 'POST' && (pathname === '/message/sendMedia' || pathname.endsWith('/sendMedia'))) {
        const { number, media, caption, mediatype } = body;
        let instanceName = req.headers['instance'] || body.instance || 'danapro_main';
        let inst = instances[instanceName];

        if (!inst || inst.state !== 'open') {
          const openKey = Object.keys(instances).find(k => instances[k] && instances[k].state === 'open');
          if (openKey) {
            inst = instances[openKey];
            instanceName = openKey;
          }
        }

        if (!inst || !inst.sock || inst.state !== 'open') {
          return sendJson(400, {
            success: false,
            message: `WhatsApp instance [${instanceName}] is not paired yet.`,
            error: `WhatsApp instance [${instanceName}] is not paired yet.`
          });
        }

        let cleanPhone = String(number || '').replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) {
          cleanPhone = '91' + cleanPhone;
        }
        if (!cleanPhone.includes('@s.whatsapp.net')) {
          cleanPhone = `${cleanPhone}@s.whatsapp.net`;
        }

        let mediaPayload;
        if (mediatype === 'image') {
          mediaPayload = { image: { url: media }, caption };
        } else {
          mediaPayload = { document: { url: media }, mimetype: 'application/pdf', fileName: '80G_Tax_Receipt.pdf', caption };
        }

        const sendResult = await inst.sock.sendMessage(cleanPhone, mediaPayload);
        return sendJson(200, {
          success: true,
          key: sendResult.key,
          messageId: sendResult.key?.id,
          status: 'SERVER_ACK'
        });
      }

      sendJson(404, { error: 'Endpoint not found', path: pathname });
    } catch (err) {
      console.error('[Server Error]', err);
      sendJson(500, { success: false, error: err.message });
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[WhatsApp Engine] Port ${PORT} already active and serving WhatsApp instances.`);
  } else {
    console.error('[WhatsApp Engine Server Error]:', err);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n================================================================`);
  console.log(`🚀 Live WhatsApp Multi-Device Engine is ONLINE on Port ${PORT} (Internal)`);
  console.log(`🔗 REST API: http://127.0.0.1:${PORT}`);
  console.log(`🔑 Global API Key: ${GLOBAL_API_KEY}`);
  console.log(`📲 Authentic WhatsApp Multi-Device Pairing Ready!`);
  console.log(`================================================================\n`);
});
