#!/bin/bash

# MCP Server Startup Script
echo "🔌 Starting MCP Server for Trading Agent..."

# Check if we're in the right directory
if [ ! -f "../external/js-recall/package.json" ]; then
    echo "❌ MCP server not found. Setting up..."
    cd ../external/js-recall
else
    cd ../external/js-recall
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing MCP server dependencies..."
    pnpm install
fi

# Set environment variables for MCP server
export API_KEY=5ffd36bb15925fe2_dd811d9881d72940
export API_SERVER_URL=https://api.competitions.recall.network

echo "✅ MCP Server environment configured"
echo "🚀 Starting MCP Server..."

# Start the MCP server
pnpm start
