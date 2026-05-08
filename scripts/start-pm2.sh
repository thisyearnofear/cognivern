#!/bin/bash

# Cognivern AI Agent Governance Platform - PM2 Startup
# Ensures 24/7 operation with automatic restarts

set -e

echo "🚀 Starting Cognivern with PM2 for 24/7 operation..."

# Create logs directory
mkdir -p logs

# Stop any existing processes
echo "🛑 Stopping existing processes..."
pm2 stop cognivern-backend || true
pm2 delete cognivern-backend || true

# Ensure no orphaned direct node process still owns the API port
if lsof -ti:10000 >/dev/null 2>&1; then
  echo "🧹 Killing orphaned process on port 10000..."
  kill $(lsof -ti:10000) || true
  sleep 2
fi

# Start with PM2
echo "🌐 Starting with PM2..."
pm2 start config/ecosystem.config.cjs

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system boot
echo "🔄 Setting up PM2 startup..."
pm2 startup || true

# Show status
echo "📊 PM2 Status:"
pm2 status

echo "✅ Cognivern is now running 24/7 with PM2!"
echo "🌐 Server: http://api.thisyearnofear.com"
echo "🔍 Health: http://api.thisyearnofear.com/health"
echo "🤖 Agents: http://api.thisyearnofear.com/api/agents"
echo ""
echo "📋 PM2 Commands:"
echo "  pm2 status          - Show status"
echo "  pm2 logs            - Show logs"
echo "  pm2 restart all     - Restart all"
echo "  pm2 stop all        - Stop all"
