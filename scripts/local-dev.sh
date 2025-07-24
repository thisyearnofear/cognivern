#!/bin/bash

# Cognivern AI Agent Governance Platform - Local Development
# Run the platform locally for development and testing

set -e

echo "🚀 Starting Cognivern AI Agent Governance Platform (Development Mode)..."

# Set development environment variables
export NODE_ENV=development
export PORT=3000
export API_KEY=development-api-key

# Database configuration (adjust for local setup)
export POSTGRES_PASSWORD=cognivern
export DATABASE_URL=postgresql://postgres:cognivern@localhost:5432/cognivern
export REDIS_URL=redis://localhost:6379

# Trading agent configuration - Load from .env file
# export RECALL_API_KEY_DIRECT=your_recall_direct_api_key
# export RECALL_API_KEY_VINCENT=your_recall_vincent_api_key
export WALLET_ADDRESS=0x8502d079f93AEcdaC7B0Fe71Fa877721995f1901

# Blockchain configuration - Load from .env file
# export ALCHEMY_API_KEY=your_alchemy_api_key
export GOVERNANCE_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
export STORAGE_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# AI configuration
export OPENAI_API_KEY=placeholder

# Monitoring configuration
export HEALTH_CHECK_INTERVAL=30000

echo "✅ Environment variables configured for development"

# Build the application
echo "🔨 Building application..."
pnpm run build:backend

echo "✅ Build complete"

# Start the server
echo "🌐 Starting development server on port $PORT..."
echo "🔍 Health check: http://localhost:$PORT/health"
echo "🤖 Showcase agents: http://localhost:$PORT/api/agents"
echo "🔑 API Key: $API_KEY"
echo ""
node dist/index.js
