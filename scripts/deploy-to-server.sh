#!/bin/bash

# Cognivern Production Deployment Script
echo "🚀 Deploying Cognivern to Production Server"
echo "============================================"

SERVER_IP=
SERVER_USER="root"
SERVER_PATH="/opt/cognivern"

# Function to check if server is reachable
check_server() {
    echo "🔍 Checking server connection..."
    if ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'Server reachable'" > /dev/null 2>&1; then
        echo "✅ Server is reachable"
        return 0
    else
        echo "❌ Cannot connect to server"
        return 1
    fi
}

# Function to create deployment package
create_package() {
    echo "📦 Creating deployment package..."
    
    # Clean up any existing package
    rm -f cognivern-production.tar.gz
    
    # Create package excluding development files
    tar -czf cognivern-production.tar.gz \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=trading-agent \
        --exclude=mcp-server \
        --exclude=LOCAL_SETUP.md \
        --exclude=deploy-to-server.sh \
        --exclude=external/**/node_modules \
        --exclude=external/**/.next \
        --exclude=external/**/.cache \
        .
    
    echo "✅ Package created: cognivern-production.tar.gz"
    echo "📊 Package size: $(du -h cognivern-production.tar.gz | cut -f1)"
}

# Function to deploy to server
deploy_to_server() {
    echo "🚀 Deploying to server..."
    
    # Stop existing services
    echo "⏹️  Stopping existing services..."
    ssh $SERVER_USER@$SERVER_IP "cd $SERVER_PATH && docker-compose down" || true
    
    # Backup existing deployment
    echo "💾 Creating backup..."
    ssh $SERVER_USER@$SERVER_IP "cd /opt && tar -czf cognivern-backup-$(date +%Y%m%d-%H%M%S).tar.gz cognivern" || true
    
    # Upload new package
    echo "📤 Uploading package..."
    scp cognivern-production.tar.gz $SERVER_USER@$SERVER_IP:/tmp/
    
    # Extract and deploy
    echo "📂 Extracting on server..."
    ssh $SERVER_USER@$SERVER_IP "
        cd /opt &&
        rm -rf cognivern-old &&
        if [ -d cognivern ]; then
            mv cognivern cognivern-old
        fi &&
        mkdir -p cognivern &&
        cd cognivern &&
        tar -xzf /tmp/cognivern-production.tar.gz &&
        rm /tmp/cognivern-production.tar.gz &&
        ls -la
    "
    
    echo "✅ Deployment complete"
}

# Function to setup Node.js environment
setup_nodejs() {
    echo "🔧 Setting up Node.js environment on server..."

    ssh $SERVER_USER@$SERVER_IP "
        # Install Node.js 18 if not present
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            apt-get install -y nodejs
        fi

        # Install pnpm if not present
        if ! command -v pnpm &> /dev/null; then
            npm install -g pnpm
        fi

        echo '✅ Node.js environment ready'
        node --version
        pnpm --version
    "
}

# Function to start services
start_services() {
    echo "🚀 Starting backend services on server..."

    ssh $SERVER_USER@$SERVER_IP "
        cd $SERVER_PATH &&
        chmod +x start-local.sh &&
        ./start-local.sh
    "
}

# Function to start trading agent
start_trading_agent() {
    echo "🤖 Starting trading agent on server..."

    ssh $SERVER_USER@$SERVER_IP "
        cd $SERVER_PATH &&
        chmod +x start-trading-agent.sh &&
        nohup ./start-trading-agent.sh > trading-agent.log 2>&1 &
        echo 'Trading agent started in background'
        echo 'View logs with: tail -f $SERVER_PATH/trading-agent.log'
    "
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."
    
    # Wait a moment for services to start
    sleep 10
    
    # Test health endpoint
    if curl -s http://$SERVER_IP/health > /dev/null; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
        return 1
    fi
    
    # Test API endpoint
    if curl -s http://$SERVER_IP/api/policies > /dev/null; then
        echo "✅ API endpoints working"
    else
        echo "❌ API endpoints not responding"
        return 1
    fi
    
    echo "🎉 Deployment verified successfully!"
    echo "🌐 Platform available at: http://$SERVER_IP"
}

# Main deployment flow
main() {
    echo "Starting deployment process..."

    if ! check_server; then
        exit 1
    fi

    create_package
    deploy_to_server
    setup_nodejs
    start_services
    start_trading_agent
    verify_deployment
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "======================"
    echo "✅ Backend API: http://$SERVER_IP:10000"
    echo "✅ Web Interface: http://$SERVER_IP"
    echo "✅ Health Check: http://$SERVER_IP/health"
    echo "✅ API Endpoints: http://$SERVER_IP/api/"
    echo "✅ Trading Agent: Running natively"
    echo ""
    echo "📋 Monitor with:"
    echo "Backend: ssh $SERVER_USER@$SERVER_IP 'cd $SERVER_PATH && docker-compose logs -f'"
    echo "Trading Agent: ssh $SERVER_USER@$SERVER_IP 'tail -f $SERVER_PATH/trading-agent.log'"
    
    # Clean up local package
    rm -f cognivern-production.tar.gz
}

# Run deployment
main
