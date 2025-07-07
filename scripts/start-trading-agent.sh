#!/bin/bash

# Cognivern Native Trading Agent Startup Script
echo "🤖 Starting Cognivern Trading Agent (Native)"
echo "============================================="

# Function to check if backend is running
check_backend() {
    echo "🔍 Checking backend connection..."
    if curl -s http://localhost:10000/health > /dev/null; then
        echo "✅ Backend API is running"
        return 0
    else
        echo "❌ Backend API is not running. Please start it first:"
        echo "   docker-compose up -d"
        return 1
    fi
}

# Function to setup File polyfill
setup_polyfill() {
    echo "🔧 Setting up File polyfill..."
    export NODE_OPTIONS="--require ./polyfills.cjs"
    echo "✅ File polyfill configured"
}

# Function to install dependencies
install_deps() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        pnpm install
    else
        echo "✅ Dependencies already installed"
    fi
}

# Function to start trading agent
start_agent() {
    echo "🚀 Starting trading agent..."
    echo "📊 Backend API: http://localhost:10000"
    echo "🔗 Trading API: $RECALL_TRADING_BASE_URL"
    echo ""
    
    # Set up File polyfill and start
    node -e "global.File = class File extends require('buffer').Blob { constructor(fileBits, fileName, options = {}) { super(fileBits, options); this.name = fileName; this.lastModified = Date.now(); } };" && pnpm auto-competition
}

# Main execution
main() {
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        echo "✅ Environment variables loaded"
    else
        echo "❌ .env file not found"
        exit 1
    fi
    
    # Check backend
    if ! check_backend; then
        exit 1
    fi
    
    # Install dependencies
    install_deps
    
    # Start agent
    start_agent
}

# Run the script
main
