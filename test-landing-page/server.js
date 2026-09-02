const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 2000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  let filePath = path.join(__dirname, 'index.html');
  if (req.url !== '/' && req.url !== '/index.html') {
    const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
    const possibleFile = path.join(__dirname, safePath);
    if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
      filePath = possibleFile;
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading ' + req.url);
      return;
    }

    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log('🌐 Standalone NGO Landing Page Test Server is running on:');
  console.log('👈 http://localhost:' + PORT);
  console.log('🔌 Connected to EKhum Embed Engine: http://localhost:5000');
  console.log('=================================================================');
});
