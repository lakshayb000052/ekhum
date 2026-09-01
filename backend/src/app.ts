import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

// Existing Router imports
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import donationRoutes from './routes/donations';
import complianceRoutes from './routes/compliance';
import aiRoutes from './routes/ai';
import superadminRoutes from './routes/superadmin';
import externalRoutes from './routes/external';
import templatesRoutes from './routes/templates';

// EKhum Individual Giving Suite — new route imports
import contactRoutes from './routes/contacts';
import mandateRoutes from './routes/mandates';
import landingPageRoutes from './routes/landing-pages';
import sessionRoutes from './routes/sessions';
import eventRoutes from './routes/events';
import communicationRoutes from './routes/communications';
import consentRoutes from './routes/consent';
import segmentRoutes from './routes/segments';
import broadcastRoutes from './routes/broadcasts';
import journeyRoutes from './routes/journeys';
import reportRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboards';
import objectManagerRoutes from './routes/object-manager';
import apiIntegrationRoutes from './routes/api-integrations';

const app = express();

import path from 'path';
import fs from 'fs';

// Standard Middlewares - allow cross-origin requests from external NGO landing pages
app.use(cors({
  origin: true, // Allow external NGO domain origins (e.g. http://localhost:8000)
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-danapro-api-key', 'x-wegive-api-key', 'x-ekhum-api-key']
}));
app.use(cookieParser());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Serve generated compliance receipt PDFs statically
app.use('/receipts', express.static(path.join(__dirname, '../receipts')));

// Base health check
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'EKhum — Individual Giving Fundraising Suite API',
    message: 'API Server is live and operational',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// ──────────────── Mounted Routes ────────────────

// Existing routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/receipts', complianceRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/v1/external', externalRoutes);
app.use('/api/webhooks', externalRoutes);

// EKhum Individual Giving Suite — new routes
app.use('/api/contacts', contactRoutes);
app.use('/api/mandates', mandateRoutes);
app.use('/api/subscriptions', mandateRoutes);
app.use('/api/landing-pages', landingPageRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/journeys', journeyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/object-manager', objectManagerRoutes);
app.use('/api/integrations', apiIntegrationRoutes);
app.use('/api/api-keys', apiIntegrationRoutes);

// 404 Handler for undefined API routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// Serve ekhum.org static marketing website if present
const websitePath = fs.existsSync(path.resolve(__dirname, '../../ekhum-website-code'))
  ? path.resolve(__dirname, '../../ekhum-website-code')
  : path.resolve(__dirname, '../ekhum-website');
if (fs.existsSync(websitePath)) {
  app.use('/website', express.static(websitePath));
  app.use('/marketing', express.static(websitePath));
}

// Serve frontend SPA static production build if present
const frontendDist = fs.existsSync(path.resolve(__dirname, '../../frontend/dist'))
  ? path.resolve(__dirname, '../../frontend/dist')
  : path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/receipts') || req.path.startsWith('/website') || req.path.startsWith('/marketing')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error encountered:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
  });
});

export default app;
