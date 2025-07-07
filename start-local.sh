#!/bin/bash

# Cognivern Production Startup Script
echo "🚀 Starting Cognivern Platform"
echo "==============================="

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo "❌ $name failed to start"
    return 1
}

echo ""
echo "📋 Step 1: Starting Backend API..."
echo "=================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start backend API
docker-compose up -d

# Wait for backend to be ready
if wait_for_service "http://localhost:10000/health" "Backend API"; then
    echo "✅ Backend API is running at http://localhost:10000"
    echo "📊 API endpoints available at http://localhost:10000/api/"
else
    echo "❌ Backend API failed to start"
    exit 1
fi

echo ""
echo "🎉 Backend is ready!"
echo "==================="
echo "✅ Backend API: http://localhost:10000"
echo "✅ Health Check: http://localhost:10000/health"
echo "✅ API Docs: http://localhost:10000/api/"
echo "✅ Nginx Proxy: http://localhost (port 80)"
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. 🤖 Start Trading Agent (in new terminal):"
echo "   ./start-trading-agent.sh"
echo ""
echo "2. 🌐 Start Frontend (in new terminal):"
echo "   cd src/frontend && pnpm dev"
echo ""
echo "3. 📊 Test the setup:"
echo "   curl http://localhost:10000/health"
echo "   curl http://localhost:10000/api/policies"
echo ""
echo "📋 View Backend Logs:"
echo "docker logs cognivern-backend --tail=20"
