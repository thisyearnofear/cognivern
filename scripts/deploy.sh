#!/bin/bash

# Cognivern AI Agent Governance Platform - Deployment Script
# Deploys to production server using direct execution approach

set -e

SERVER_HOST="root@157.180.36.156"
SERVER_PATH="/opt/cognivern"

echo "🚀 Deploying Cognivern AI Agent Governance Platform..."

# Build locally first
echo "🔨 Building application locally..."
pnpm run build:backend

# Sync source code to server
echo "📤 Syncing source code to server..."
rsync -avz --exclude node_modules --exclude .git --exclude dist src/ $SERVER_HOST:$SERVER_PATH/src/
rsync -avz package.json pnpm-lock.yaml tsconfig.json $SERVER_HOST:$SERVER_PATH/
rsync -avz scripts/ $SERVER_HOST:$SERVER_PATH/scripts/

# Build on server and restart
echo "🔄 Building and restarting on server..."
ssh $SERVER_HOST "cd $SERVER_PATH && pnpm install --frozen-lockfile && pnpm run build:backend"

# Stop existing server process
echo "🛑 Stopping existing server..."
ssh $SERVER_HOST "cd $SERVER_PATH && pm2 stop cognivern-api || true"

# Start new server process with PM2
echo "🌐 Starting new server with PM2..."
ssh $SERVER_HOST "cd $SERVER_PATH && pm2 start config/ecosystem.config.cjs && pm2 save"

echo "✅ Deployment complete!"
echo "🌐 Server running at: http://api.thisyearnofear.com"
echo "🔍 Health check: http://api.thisyearnofear.com/health"
echo "🤖 Showcase agents: http://api.thisyearnofear.com/api/agents"
