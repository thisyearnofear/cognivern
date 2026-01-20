#!/bin/bash

# Cognivern Trading Agent Startup Script
echo "🤖 Starting Cognivern Trading Agent..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found"
    exit 1
fi

# Check if backend is running
echo "🔍 Checking backend connection..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend API is running"
else
    echo "❌ Backend API is not running. Please start it first:"
    echo "   cd .. && docker-compose up -d"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Set up File polyfill and start the agent
echo "🚀 Starting trading agent with File polyfill..."
NODE_OPTIONS="--require ./polyfills.cjs" pnpm start
