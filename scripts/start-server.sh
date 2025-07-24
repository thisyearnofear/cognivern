#!/bin/bash

# Cognivern AI Agent Governance Platform - Production Server Startup
# Direct execution approach for reliable deployment

set -e

echo "🚀 Starting Cognivern AI Agent Governance Platform..."

# Load production environment variables
if [ -f .env.production ]; then
    echo "📋 Loading production environment variables..."
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "⚠️  No .env.production file found, using defaults..."
    # Fallback environment variables
    export NODE_ENV=production
    export PORT=3000
    export API_KEY=showcase-api-key
    export POSTGRES_PASSWORD=cognivern
    export DATABASE_URL=postgresql://postgres:cognivern@localhost:5432/cognivern
    export REDIS_URL=redis://localhost:6379
    export RECALL_API_KEY_DIRECT=52afa13c30857147_78db8aed694cc70a
    export RECALL_API_KEY_VINCENT=4fddb4bf32752f24_9a39cd26a7cda63e
    export WALLET_ADDRESS=0x8502d079f93AEcdaC7B0Fe71Fa877721995f1901
    # export ALCHEMY_API_KEY=your_alchemy_api_key
    export GOVERNANCE_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
    export STORAGE_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
    export OPENAI_API_KEY=placeholder
    export HEALTH_CHECK_INTERVAL=30000
fi

echo "✅ Environment variables configured"

# Build the application
echo "🔨 Building application..."
pnpm run build:backend

echo "✅ Build complete"

# Start the server
echo "🌐 Starting server on port $PORT..."
node dist/index.js
