#!/bin/bash
set -e

echo "======================================================"
echo "🚀 STARTING EKHUM / DANAPRO PRODUCTION DEPLOYMENT"
echo "======================================================"

# 1. Ensure we are in project root
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"
echo "📁 Working Directory: $REPO_DIR"

# 2. Pull latest code from GitHub
echo "📥 Pulling latest code from main branch..."
git fetch origin main
git reset --hard origin/main

# 3. Backend Build & Migrations
echo "⚙️ Building Backend..."
cd "$REPO_DIR/backend"
npm install --no-audit
npm run build

echo "🗄️ Running PostgreSQL Database Migrations..."
npx ts-node src/scripts/migrate.ts

# 4. Frontend Build
echo "🎨 Building Frontend Bundle..."
cd "$REPO_DIR/frontend"
npm install --no-audit
npm run build

# 5. Reload PM2 Services
echo "🔄 Reloading PM2 Processes..."
cd "$REPO_DIR"
pm2 reload all || pm2 restart all

echo "======================================================"
echo "🎉 DEPLOYMENT COMPLETE! ALL SERVICES ONLINE"
echo "======================================================"
pm2 status