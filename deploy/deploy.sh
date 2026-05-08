#!/bin/bash

# Cognivern Production Deployment Script
# Deploys to Hetzner server with PM2 (production dependencies only)

set -e

# Configuration
SERVER_USER="deploy"
SERVER_HOST=""  # Set your server IP
DEPLOY_PATH="/opt/cognivern"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    exit 1
fi

print_status "Building backend..."
pnpm run build

print_status "Creating deployment archive..."
tar -czf /tmp/cognivern-deploy.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=src/frontend/node_modules \
    --exclude=src/frontend/dist \
    --exclude=logs \
    --exclude=data \
    --exclude=.pnpm-store \
    .

print_status "Uploading to server..."
scp /tmp/cognivern-deploy.tar.gz ${SERVER_USER}@${SERVER_HOST}:/tmp/
scp .env ${SERVER_USER}@${SERVER_HOST}:/tmp/cognivern.env

print_status "Deploying on server..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'REMOTE_EOF'
    set -e

    DEPLOY_PATH="/opt/cognivern"

    echo "[1/6] Stopping PM2 process..."
    cd $DEPLOY_PATH
    pm2 stop cognivern-backend || true

    echo "[2/6] Backing up current deployment..."
    if [ -d "$DEPLOY_PATH/dist" ]; then
        cp -r dist dist.backup 2>/dev/null || true
    fi

    echo "[3/6] Extracting new version..."
    tar -xzf /tmp/cognivern-deploy.tar.gz -C $DEPLOY_PATH
    cp /tmp/cognivern.env $DEPLOY_PATH/.env

    echo "[4/6] Installing production dependencies only..."
    cd $DEPLOY_PATH
    pnpm install --prod --force

    echo "[5/6] Cleaning up..."
    # Remove backup if deployment succeeded
    rm -rf dist.backup
    # Clean pnpm store
    pnpm store prune
    # Truncate old logs
    if [ -d "logs" ]; then
        for f in logs/*.log; do
            if [ -f "$f" ] && [ $(wc -l < "$f") -gt 5000 ]; then
                tail -5000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
            fi
        done
    fi
    # Clean temp files
    rm -f /tmp/cognivern-deploy.tar.gz /tmp/cognivern.env

    echo "[6/6] Restarting PM2 process..."
    mkdir -p logs
    if lsof -ti:10000 >/dev/null 2>&1; then
        kill $(lsof -ti:10000) || true
        sleep 2
    fi
    pm2 reload cognivern-backend || pm2 start config/ecosystem.config.cjs
    pm2 save

    echo ""
    echo "Deployment status:"
    pm2 list
    echo ""
    echo "Disk usage:"
    du -sh $DEPLOY_PATH
REMOTE_EOF

print_status "Local cleanup..."
rm -f /tmp/cognivern-deploy.tar.gz

print_status "Deployment completed!"
