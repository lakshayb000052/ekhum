const fs = require('fs');
const path = require('path');

const bundleDir = path.resolve(__dirname, '../ekhum-unified-bundle');

// 1. standalone-server.js
const serverJs = `/**
 * EKhum Unified Platform — Standalone Localhost:5000 Server
 * 
 * Runs with 0 external dependencies (pure Node.js http/fs/path).
 * Can be launched immediately by running: node standalone-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const frontendDist = path.join(__dirname, 'frontend', 'dist');
const websiteDir = path.join(__dirname, 'ekhum-website');
const assetsDir = path.join(__dirname, 'assets-and-demos');

function serveStaticFile(res, filePath, fallbackFile = null) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  if (fallbackFile && fs.existsSync(fallbackFile)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(fallbackFile).pipe(res);
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-danapro-api-key, x-ekhum-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost:' + PORT);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Health Endpoint
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'EKhum Unified Platform Distribution Server',
      message: 'Unified Localhost:5000 service is operational',
      version: '2.0.0',
      port: Number(PORT),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. Mock / Interactive API Endpoints for zero-config demo
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/landing-pages')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: [
          { id: '1', title: 'EKhum Official Landing', slug: 'ekhum-official', status: 'published' },
          { id: '2', title: 'FinMantra Campaign Demo', slug: 'finmantra-campaign', status: 'published' }
        ]
      }));
      return;
    }

    if (pathname.startsWith('/api/campaigns')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: [
          {
            id: 'c1',
            title: 'Child Care & Education Fund 2026',
            slug: 'test_campaigns',
            description: 'Direct impact support providing nutrition and schooling.',
            goal_amount: 500000,
            is_active: true,
            orgName: 'ChildFund India Foundation'
          }
        ]
      }));
      return;
    }

    if (pathname.startsWith('/api/auth/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Authenticated in Demo Mode',
        user: { id: 'demo-admin', email: 'admin@ekhum.org', role: 'superadmin', name: 'EKhum Superadmin' }
      }));
      return;
    }

    // Default fallback API handler
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Endpoint ' + pathname + ' handled by EKhum Standalone Engine',
      data: []
    }));
    return;
  }

  // 3. Serve ekhum.org Marketing Website at /website/ or /marketing/
  if (pathname.startsWith('/website') || pathname.startsWith('/marketing')) {
    let subPath = pathname.replace(/^\\/(website|marketing)/, '');
    if (!subPath || subPath === '/') subPath = '/index.html';
    const siteFilePath = path.join(websiteDir, subPath);
    if (serveStaticFile(res, siteFilePath)) return;
  }

  // 4. Serve Supplementary Assets and Demos at /assets-and-demos/ or /demos/
  if (pathname.startsWith('/assets-and-demos') || pathname.startsWith('/demos')) {
    let subPath = pathname.replace(/^\\/(assets-and-demos|demos)/, '');
    if (!subPath || subPath === '/') subPath = '/EKhum_ChildFund_Pitch_Deck.html';
    const demoFilePath = path.join(assetsDir, subPath);
    if (serveStaticFile(res, demoFilePath)) return;
  }

  // 5. Serve React SPA Frontend (EKhumLandingPage, Dashboards, Checkout)
  if (fs.existsSync(frontendDist)) {
    const staticFilePath = path.join(frontendDist, pathname);
    const indexHtml = path.join(frontendDist, 'index.html');
    if (serveStaticFile(res, staticFilePath, indexHtml)) return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('EKhum Resource Not Found');
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log('================================================================');
  console.log('  🚀 EKhum Unified Platform & Landing Website Server Started');
  console.log('================================================================');
  console.log('  🏠 Main React Landing Page & App:  http://localhost:' + PORT + '/');
  console.log('  🌐 ekhum.org Marketing Website:    http://localhost:' + PORT + '/website/');
  console.log('  💳 Checkout Demo:                  http://localhost:' + PORT + '/checkout?campaign=test_campaigns');
  console.log('  📊 Pitch Deck & Assets:            http://localhost:' + PORT + '/demos/EKhum_ChildFund_Pitch_Deck.html');
  console.log('  ⚡ API Health Status:              http://localhost:' + PORT + '/health');
  console.log('================================================================\\n');
});
`;
fs.writeFileSync(path.join(bundleDir, 'standalone-server.js'), serverJs, 'utf8');

// 2. package.json
const rootPackageJson = {
  name: 'ekhum-unified-bundle',
  version: '2.0.0',
  description: 'EKhum Complete Platform, Landing Pages & Backend Ecosystem',
  private: true,
  scripts: {
    start: 'node standalone-server.js',
    'start:full': 'node backend/dist/index.js',
    'build': 'npm run build --prefix frontend && npm run build --prefix backend'
  }
};
fs.writeFileSync(path.join(bundleDir, 'package.json'), JSON.stringify(rootPackageJson, null, 2), 'utf8');

// 3. start.bat
const startBat = `@echo off
title EKhum Unified Platform Server (Port 5000)
echo ================================================================
echo   Launching EKhum Unified Platform ^& Landing Website
echo ================================================================
node standalone-server.js
pause
`;
fs.writeFileSync(path.join(bundleDir, 'start.bat'), startBat, 'utf8');

// 4. start.sh
const startSh = `#!/usr/bin/env bash
echo "================================================================"
echo "  Launching EKhum Unified Platform & Landing Website"
echo "================================================================"
node standalone-server.js
`;
fs.writeFileSync(path.join(bundleDir, 'start.sh'), startSh, 'utf8');

// 5. .env.example
const envExample = `PORT=5000
NODE_ENV=production
# Optional Database Config
DATABASE_URL=postgresql://postgres:password@localhost:5432/danapro
JWT_SECRET=super_secret_ekhum_jwt_key_2026
`;
fs.writeFileSync(path.join(bundleDir, '.env.example'), envExample, 'utf8');

// 6. README.md
const readme = `# EKhum Unified Platform & Marketing Website Bundle

This standalone distribution folder clubs together the entire **EKhum \`localhost:5000\` Ecosystem**:
- **Main React Platform & Ultra-Modern AI Landing Page** (\`EKhumLandingPage\`, NGO Dashboard, Superadmin, Checkout)
- **Official \`ekhum.org\` Multi-Page Marketing Website** (All HTML pages, CSS, JS, Docs)
- **Node.js + Express + WebSocket Backend API** (TypeScript source + compiled dist)
- **Demos, Pitch Decks & Data Schema**

---

## 🚀 Quick Start (Zero Setup / 1-Click Launch)

### Option A: Windows 1-Click
Double-click \`start.bat\`.

### Option B: Command Line (Windows / Mac / Linux)
\`\`\`bash
node standalone-server.js
\`\`\`
*(Or \`npm start\`)*

The server will start immediately on **\`http://localhost:5000\`**.

---

## 🌐 Live URLs & Routes Available on \`localhost:5000\`

| Section | URL | Description |
| :--- | :--- | :--- |
| **Main Landing Page & App** | [http://localhost:5000/](http://localhost:5000/) | React Ultra-Modern AI Landing Page & Full Platform |
| **ekhum.org Website** | [http://localhost:5000/website/](http://localhost:5000/website/) | Complete multi-page marketing site |
| **About Page** | [http://localhost:5000/website/about.html](http://localhost:5000/website/about.html) | About EKhum mission & leadership |
| **Platform Specs** | [http://localhost:5000/website/platform.html](http://localhost:5000/website/platform.html) | Technical architecture & specs |
| **Campaigns Hub** | [http://localhost:5000/website/campaigns.html](http://localhost:5000/website/campaigns.html) | Omnichannel campaign showcase |
| **80G Compliance** | [http://localhost:5000/website/compliance.html](http://localhost:5000/website/compliance.html) | Automated 80G tax receipt engine |
| **Pricing** | [http://localhost:5000/website/pricing.html](http://localhost:5000/website/pricing.html) | Transparent pricing structure |
| **Checkout Demo** | [http://localhost:5000/checkout?campaign=test_campaigns](http://localhost:5000/checkout?campaign=test_campaigns) | Multi-gateway donation checkout |
| **Pitch Deck** | [http://localhost:5000/demos/EKhum_ChildFund_Pitch_Deck.html](http://localhost:5000/demos/EKhum_ChildFund_Pitch_Deck.html) | Full executive presentation deck |
| **Health API** | [http://localhost:5000/health](http://localhost:5000/health) | Real-time service status check |

---

## 📂 Folder Structure

\`\`\`
ekhum-unified-bundle/
├── standalone-server.js      # Zero-dependency launcher running port 5000
├── start.bat                 # 1-click Windows runner
├── start.sh                  # 1-click Mac/Linux runner
├── package.json              # Scripts & configurations
├── .env.example              # Environment template
├── README.md                 # Complete documentation
│
├── ekhum-website/            # Complete ekhum.org marketing site
│   ├── index.html, about.html, campaigns.html, compliance.html,
│   │   engagement.html, intelligence.html, ledger.html, pricing.html,
│   │   demo.html, styles.css, script.js
│   └── docs/site-architecture.md
│
├── frontend/                 # React SPA source & pre-built dist
│   ├── src/components/landing/EKhumLandingPage.tsx
│   ├── dist/
│   └── public/
│
├── backend/                  # Node.js Express backend & pre-compiled dist
│   ├── src/
│   ├── dist/
│   └── receipts/
│
└── assets-and-demos/         # Pitch decks, schemas, and demo pages
    ├── EKhum_ChildFund_Pitch_Deck.html
    ├── wegive_demo.html
    ├── Schema.xlsx
    └── finmantra-landing/
\`\`\`

---

## 📦 How to Share

Zip the entire \`ekhum-unified-bundle\` folder and share it via Google Drive, Dropbox, email, or GitHub. The recipient only needs Node.js installed to run \`node standalone-server.js\` or double click \`start.bat\`.
`;
fs.writeFileSync(path.join(bundleDir, 'README.md'), readme, 'utf8');

console.log('Bundle generation finished successfully!');
