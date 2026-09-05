import http from 'http';
import net from 'net';
import app from './app';
import { initWebSocketServer } from './websocket';

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Bind WebSocket Server
initWebSocketServer(server);

// Auto-start WhatsApp Evolution Go Microservice on internal port 8080 if not already running (Primary instance only)
const isPrimaryClusterInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';
if (isPrimaryClusterInstance) {
  try {
    const whatsappScript = path.resolve(__dirname, '../../evolution-go-whatsapp/server.js');
    if (fs.existsSync(whatsappScript)) {
      const tester = net.createConnection({ port: 8080, host: '127.0.0.1' });
      tester.once('connect', () => {
        tester.destroy();
        console.log('[System] WhatsApp Evolution Go Gateway is already active on port 8080.');
      });
      tester.once('error', () => {
        console.log('[System] Initializing WhatsApp Evolution Go Gateway on internal port 8080...');
        const childEnv: Record<string, any> = { ...process.env, WA_INTERNAL_PORT: '8080' };
        delete childEnv.PORT;
        delete childEnv.SERVER_PORT;
        const waProcess = spawn(process.execPath, [whatsappScript], {
          env: childEnv,
          stdio: 'inherit'
        });
        waProcess.on('error', (err) => console.error('[WhatsApp Engine Auto-Start Error]:', err));
      });
    }
  } catch (e) {
    console.error('[WhatsApp Engine Auto-Start Error]:', e);
  }
}

// Handle server startup errors (such as port conflicts)
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Fatal Error] Port ${PORT} is already in use by another process.`);
    console.error(`👉 Run 'npm run kill:ports' or close the conflicting process and restart.\n`);
    process.exit(1);
  } else {
    console.error('[Fatal Server Error]:', err);
    process.exit(1);
  }
});

import pool from './config/db';
import runMigrations from './config/migrations';

// Run database migrations on server boot
runMigrations(pool).catch(err => {
  console.error('[Migrations Error on Startup]:', err);
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`==========================================`);
  console.log(` EKhum Platform Unified Production Service Started`);
  console.log(` Running on: http://0.0.0.0:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==========================================`);
});

// Graceful shutdown handling for production readiness
const gracefulShutdown = (signal: string) => {
  console.log(`[System] Received ${signal}. Shutting down HTTP & WebSocket server gracefully...`);
  server.close(() => {
    console.log('[System] HTTP and WebSocket server closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[System] Shutdown forced after timeout.');
    process.exit(1);
  }, 2000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Automated Background Sweep: Mark initiated transactions older than 25 minutes without update as 'failed'
setInterval(async () => {
  try {
    const sweepRes = await pool.query(`
      UPDATE donations 
      SET status = 'failed', updated_at = NOW() 
      WHERE status IN ('initiated', 'pending') 
        AND (created_at < NOW() - INTERVAL '25 minutes')
      RETURNING id, organization_id, amount
    `);
    if (sweepRes.rows.length > 0) {
      console.log(`[Stale Payment Reconciliation Engine] Auto-marked ${sweepRes.rows.length} initiated transaction(s) older than 25min as failed.`);
    }
  } catch (err) {
    console.error('[Stale Payment Reconciliation Engine Error]:', err);
  }
}, 60000); // Sweep every 60 seconds
import { processJourneyQueue } from './services/journeyExecutor';
setInterval(async () => {
  try {
    await processJourneyQueue();
  } catch (err) {
    console.error('[Journey Step Processor Error]:', err);
  }
}, 60000); // Process journey steps every 60 seconds

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});
