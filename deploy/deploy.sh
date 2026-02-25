#!/bin/bash

# Cognivern Hetzner Deployment Script
# This script deploys the full Cognivern platform to your Hetzner server

set -e

echo "🚀 Starting Cognivern deployment to Hetzner..."

# Configuration
SERVER_USER="root"
SERVER_HOST= # Your Hetzner server IP
DEPLOY_PATH="/opt/cognivern"
DOMAIN= # Using IP for now, change to domain later

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found! Please create it with your environment variables."
    exit 1
fi

print_status "Building application locally..."
pnpm run build

print_status "Creating deployment archive..."
tar -czf cognivern-deploy.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=src/frontend/node_modules \
    --exclude=src/frontend/dist \
    --exclude=logs \
    --exclude=data \
    .

print_status "Uploading to server..."
scp cognivern-deploy.tar.gz ${SERVER_USER}@${SERVER_HOST}:/tmp/
scp .env ${SERVER_USER}@${SERVER_HOST}:/tmp/cognivern.env

print_status "Deploying on server..."
ssh ${SERVER_USER}@${SERVER_HOST} << EOF
    set -e

    # Install Docker and Docker Compose if not present
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    # Create deployment directory
    mkdir -p ${DEPLOY_PATH}
    cd ${DEPLOY_PATH}

    # Stop existing services
    if [ -f docker-compose.yml ]; then
        docker-compose down || true
    fi

    # Extract new version
    tar -xzf /tmp/cognivern-deploy.tar.gz
    cp /tmp/cognivern.env .env

    # Create necessary directories
    mkdir -p data logs nginx/ssl

    # Set permissions
    chown -R 1001:1001 data logs

    # Start services
    docker-compose up -d --build

    # Clean up
    rm /tmp/cognivern-deploy.tar.gz /tmp/cognivern.env

    echo "✅ Deployment completed!"
    echo "🔍 Check status with: docker-compose ps"
    echo "📋 View logs with: docker-compose logs -f"
EOF

# Clean up local files
rm cognivern-deploy.tar.gz

print_status "Deployment completed!"
print_warning "Don't forget to:"
print_warning "1. Update nginx.conf with your actual domain name"
print_warning "2. Add SSL certificates to deploy/nginx/ssl/"
print_warning "3. Configure your domain DNS to point to ${SERVER_HOST}"
print_warning "4. Update firewall rules to allow ports 80 and 443"

echo ""
echo "🎯 Your trading agent will be running 24/7 on: https://${DOMAIN}"
echo "📊 Dashboard will be available at: https://${DOMAIN}"
echo "🔍 API health check: https://${DOMAIN}/health"
