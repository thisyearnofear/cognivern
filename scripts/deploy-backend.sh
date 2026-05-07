#!/bin/bash
# Deploy Cognivern backend updates
# Run this on the server after SSH

set -e

echo "📦 Pulling latest changes..."
cd /opt/cognivern
git pull origin main

echo "📥 Installing dependencies..."
pnpm install

echo "🔨 Building backend..."
pnpm run build:backend

echo "🔄 Restarting service..."
if command -v pm2 &> /dev/null; then
    pm2 restart cognivern
    pm2 status
elif command -v systemctl &> /dev/null; then
    sudo systemctl restart cognivern
    sudo systemctl status cognivern --no-pager
else
    echo "⚠️  No process manager found. Restart manually."
fi

echo "✅ Deployment complete!"
echo ""
echo "Test the new endpoint:"
echo "curl 'http://localhost:3000/api/spend/scan?address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'"
