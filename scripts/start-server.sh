#!/bin/bash

# Cognivern AI Agent Governance Platform - Production Server Startup
# Use PM2 for long-running production processes; this script is for foreground runs.

set -e

echo "🚀 Starting Cognivern AI Agent Governance Platform..."

# Load production environment variables
if [ -f .env.production ]; then
    echo "📋 Loading production environment variables..."
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "⚠️  No .env.production file found, using defaults..."
    export NODE_ENV=production
    export PORT=3000
    export WALLET_ADDRESS="${WALLET_ADDRESS:-0x0000000000000000000000000000000000000000}"
    export GOVERNANCE_CONTRACT_ADDRESS="${GOVERNANCE_CONTRACT_ADDRESS:-0x0000000000000000000000000000000000000000}"
    export STORAGE_CONTRACT_ADDRESS="${STORAGE_CONTRACT_ADDRESS:-0x0000000000000000000000000000000000000000}"
    export HEALTH_CHECK_INTERVAL=30000
    # Require these secrets to be set - do not hardcode
    if [ -z "$API_KEY" ] || [ -z "$OPENAI_API_KEY" ]; then
        echo "⚠️  WARNING: API_KEY and/or OPENAI_API_KEY not set. API auth will be disabled."
    fi
fi

echo "✅ Environment variables configured"

# Build the application
echo "🔨 Building application..."
pnpm run build:backend

echo "✅ Build complete"

# Start the server
echo "🌐 Starting server on port $PORT..."
node dist/index.js
