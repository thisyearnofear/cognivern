# Cognivern Deployment Scripts

## Overview

This directory contains deployment scripts for the Cognivern backend API. The frontend is deployed separately to Vercel.

## Quick Deploy

```bash
# 1. Configure environment
cp .env.example .env
nano .env  # Fill in your actual values

# 2. Set server host in deploy.sh
# Edit deploy/deploy.sh and set SERVER_HOST="your-server-ip"

# 3. Deploy
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

## What the Deploy Script Does

1. Builds the backend locally (`pnpm run build`)
2. Creates a tarball (excludes `node_modules`, `.git`, frontend builds, logs)
3. Uploads to the server via SCP
4. On server: installs production-only dependencies (`pnpm install --prod`)
5. Restarts the PM2 process
6. Cleans up old logs and pnpm cache

## Server Setup (One-Time)

The server needs:
- Node.js 20+
- pnpm
- PM2 with pm2-logrotate module
- SSH access for the deploy user

```bash
# Install PM2 and log rotation
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Contract Deployment

Before first deployment, deploy the smart contracts:

```bash
# On the server (needs dev dependencies temporarily)
cd /opt/cognivern
pnpm install  # Full install for hardhat
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
# Add the output contract addresses to .env
pnpm install --prod --force  # Back to production-only deps
pm2 restart cognivern --update-env
```

## Manual Deployment

If the automated script doesn't work for your setup:

```bash
# From local machine
scp -r src/ config/ dist/ package.json pnpm-lock.yaml deploy/ user@server:/opt/cognivern/
scp .env user@server:/opt/cognivern/.env

# On server
ssh user@server
cd /opt/cognivern
pnpm install --prod --force
pm2 restart cognivern --update-env
```

## Monitoring

```bash
# On server
pm2 list                    # View all processes
pm2 logs cognivern          # View live logs
pm2 monit                   # Resource monitoring
curl http://localhost:10000/health  # Health check
```

## Rollback

To rollback to a previous version:
1. Re-deploy the previous working commit/version
2. `pm2 restart cognivern --update-env`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check `pm2 logs cognivern --err`, verify `.env` has all required vars |
| Missing contract addresses | Deploy contracts first, add addresses to `.env` |
| Out of disk space | Run `pnpm store prune`, truncate logs in `logs/` |
| Port already in use | Check `lsof -i :10000`, kill old process |

## Related Docs

- [Deployment Guide](../docs/DEPLOYMENT.md) — Full deployment documentation
- [Developer Guide](../docs/DEVELOPER.md) — Local development setup
