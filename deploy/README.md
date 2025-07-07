# Cognivern Hetzner Deployment Guide

This guide will help you deploy the full Cognivern platform to your Hetzner server for 24/7 trading agent operation.

## 🎯 Architecture Overview

```
Internet → Nginx (SSL/Reverse Proxy) → Backend API + Trading Agent
                                    ↓
                              Recall Network + Filecoin
```

## 📋 Prerequisites

1. **Hetzner Server** with Ubuntu 20.04+ or similar
2. **Domain name** pointing to your server
3. **SSL certificates** (Let's Encrypt recommended)
4. **Environment variables** configured

## 🚀 Quick Deployment

### 1. Configure Environment

```bash
# Copy and edit environment file
cp deploy/.env.hetzner.example .env
nano .env  # Fill in your actual values
```

### 2. Update Deployment Script

Edit `deploy/deploy.sh`:
```bash
SERVER_HOST="your-hetzner-server-ip"
DOMAIN="your-domain.com"
```

### 3. Deploy

```bash
# Make script executable
chmod +x deploy/deploy.sh

# Deploy to Hetzner
./deploy/deploy.sh
```

## 🔧 Manual Setup (Alternative)

### 1. Server Preparation

```bash
# SSH into your Hetzner server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 2. Upload Code

```bash
# From your local machine
scp -r . root@your-server-ip:/opt/cognivern/
scp .env root@your-server-ip:/opt/cognivern/
```

### 3. Start Services

```bash
# On server
cd /opt/cognivern
docker-compose up -d --build
```

## 🔒 SSL Setup with Let's Encrypt

```bash
# Install certbot
apt install certbot

# Get SSL certificate
certbot certonly --standalone -d your-domain.com

# Copy certificates
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/cognivern/deploy/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/cognivern/deploy/nginx/ssl/key.pem

# Restart nginx
docker-compose restart nginx
```

## 📊 Monitoring & Management

### Check Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f cognivern-agent
docker-compose logs -f cognivern-backend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart cognivern-agent
```

### Update Deployment
```bash
# Pull latest code and rebuild
git pull
docker-compose down
docker-compose up -d --build
```

## 🎯 Service Architecture

### Backend Service (`cognivern-backend`)
- **Port**: 10000
- **Purpose**: API server, dashboard, governance
- **Health Check**: `/health`
- **Auto-restart**: Yes

### Trading Agent Service (`cognivern-agent`)
- **Purpose**: 24/7 automated trading
- **Command**: `pnpm auto-competition`
- **Depends on**: Backend service
- **Auto-restart**: Yes

### Nginx Service
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Purpose**: SSL termination, reverse proxy, rate limiting
- **Features**: Gzip, security headers, WebSocket support

## 🔍 Troubleshooting

### Agent Not Trading
```bash
# Check agent logs
docker-compose logs cognivern-agent

# Check environment variables
docker-compose exec cognivern-agent env | grep RECALL
```

### API Not Responding
```bash
# Check backend logs
docker-compose logs cognivern-backend

# Check nginx logs
docker-compose logs nginx
```

### SSL Issues
```bash
# Check certificate files
ls -la deploy/nginx/ssl/

# Test SSL configuration
openssl s_client -connect your-domain.com:443
```

## 🎯 Benefits of Hetzner Deployment

✅ **24/7 Uptime** - No sleeping like free Render instances
✅ **Better Performance** - Dedicated resources
✅ **Cost Effective** - Hetzner pricing is excellent
✅ **Full Control** - Root access, custom configurations
✅ **Scalability** - Easy to upgrade server specs
✅ **Reliability** - Enterprise-grade infrastructure

## 🔗 Access Points

After deployment:
- **Dashboard**: https://your-domain.com
- **API**: https://your-domain.com/api
- **Health Check**: https://your-domain.com/health
- **Trading Agent**: Running 24/7 in background

## 📈 Next Steps

1. Monitor trading agent performance
2. Set up log rotation and backups
3. Configure monitoring/alerting
4. Scale horizontally if needed
5. Add CI/CD pipeline for automated deployments
