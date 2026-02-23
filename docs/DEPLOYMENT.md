# Deployment & Operations

## Overview

Cognivern uses a **backend artifact + releases** deployment model for fast, safe rollbacks and minimal runtime dependencies.

## Why This Model

- Keeps production servers as **runtime environments** (no TypeScript builds required)
- Enables fast, safe rollbacks via symlink switching
- Avoids installing frontend dependencies on backend server
- Separates secrets from code (commit-safe config)

## Architecture

### Server Layout (Hetzner)

```
/opt/cognivern/
  releases/
    <release-id>/
      dist/
      node_modules/        # prod deps only
      .env -> ../shared/.env
      data -> ../shared/data
      logs -> ../shared/logs
  current -> releases/<release-id>
  shared/
    .env
    data/
    logs/
  config/
    ecosystem.config.cjs   # PM2 config (commit-safe)
```

**Rule:** Application must run from `/opt/cognivern/current`.

### Secrets Handling

- Secrets live in: `/opt/cognivern/shared/.env` (server-local, NOT in git)
- PM2 runs via: `/opt/cognivern/shared/run.sh` which sources `shared/.env`
- **Do not** put secrets in `config/ecosystem.config.cjs`

### Ports

- Backend listens on `PORT` defined in `/opt/cognivern/shared/.env`
- Nginx proxies to `http://127.0.0.1:$PORT`

## Local Developer Workflow

### Build Backend Artifact

```bash
bash scripts/deploy/build-backend-artifact.sh
```

Creates tarball under `.artifacts/` containing:
- `dist/`
- `package.json`, `pnpm-lock.yaml`
- `config/` (runtime config)

### Deploy to Hetzner

```bash
bash scripts/deploy/deploy-backend-artifact-hetzner.sh
```

Deploy script:
1. Uploads tarball to `/opt/cognivern/releases/`
2. Installs **prod dependencies only** inside release
3. Links shared state (`shared/.env`, `shared/data`, `shared/logs`)
4. Updates `/opt/cognivern/current` symlink
5. Restarts PM2
6. Runs health check

### List Releases

```bash
bash scripts/deploy/list-releases-hetzner.sh
```

### Rollback

```bash
bash scripts/deploy/rollback-hetzner.sh <release-dir-name>
```

## Secrets Policy

### Do NOT Commit
- `.env`, `.env.production`, private keys, API keys, ingest keys
- PM2 ecosystem files containing secrets

### Safe to Commit
- Deployment scripts (without embedded secrets)
- Deployment documentation
- `.env.example` with placeholders

### Where Secrets Live
- `/opt/cognivern/shared/.env` on server (not in git)

### Example `.env`
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Sapience / Arbitrum
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SAPIENCE_PRIVATE_KEY=0x...

# LLM Layer
ROUTEWAY_API_KEY=...
GROQ_API_KEY=...

# Memory
RECALL_API_KEY=...
RECALL_BUCKET=agent-memory

# Feature Flags
AGENTS_ENABLED=false
```

## PM2 Configuration

### ecosystem.config.cjs (Commit-Safe)

```javascript
module.exports = {
  apps: [{
    name: 'cognivern-agent',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '1G',
  }],
};
```

### Run Script (Server-Local)

```bash
#!/bin/bash
# /opt/cognivern/shared/run.sh
source /opt/cognivern/shared/.env
cd /opt/cognivern/current
pm2 startOrRestart config/ecosystem.config.cjs
```

## Health Checks

### Manual Health Check

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Automated Health Check (Deploy Script)

```bash
HEALTH_URL="http://localhost:$PORT/health"
MAX_RETRIES=5
RETRY_INTERVAL=5

for i in $(seq 1 $MAX_RETRIES); do
  if curl -f -s $HEALTH_URL > /dev/null; then
    echo "Health check passed"
    exit 0
  fi
  sleep $RETRY_INTERVAL
done

echo "Health check failed after $MAX_RETRIES attempts"
exit 1
```

## Monitoring & Logging

```bash
# View logs
pm2 logs cognivern-agent --lines 100 --follow

# Error logs only
pm2 logs cognivern-agent --err
```

**Key Metrics:** API response time, error rate, memory/CPU usage, disk usage, ingest rate, quota usage.

## Background Agents

```env
# In /opt/cognivern/shared/.env
AGENTS_ENABLED=true  # Default: false
```

```bash
# Start agents via PM2
pm2 start dist/services/AutomatedForecastingService.js --name forecasting-agent
```

## Data Persistence

**Storage:** `data/cre-runs.jsonl`, `data/usage.json`, `data/token-telemetry.json`

### Backup
```bash
#!/bin/bash
BACKUP_DIR="/backups/cognivern/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR
cp /opt/cognivern/shared/data/*.jsonl $BACKUP_DIR/
cp /opt/cognivern/shared/data/*.json $BACKUP_DIR/
```

### Restore
```bash
#!/bin/bash
BACKUP_DIR="/backups/cognivern/20260223"
cp $BACKUP_DIR/*.jsonl /opt/cognivern/shared/data/
cp $BACKUP_DIR/*.json /opt/cognivern/shared/data/
pm2 restart cognivern-agent
```

## Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **App won't start** | `pm2 status`, `pm2 logs --err`, verify `.env`, check Node version |
| **High memory** | `pm2 monit`, restart, check for leaks |
| **Data corruption** | Stop app, backup data, restore from backup or start fresh |
| **Rollback** | `bash scripts/deploy/rollback-hetzner.sh <release>`, verify health |

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing locally
- [ ] Build completes without errors
- [ ] `.env.example` updated with new variables
- [ ] CHANGELOG updated
- [ ] Version bumped in `package.json`

### Deployment
- [ ] Artifact built successfully
- [ ] Uploaded to server
- [ ] Dependencies installed (prod only)
- [ ] Shared state linked
- [ ] Symlink updated
- [ ] PM2 restarted
- [ ] Health check passed

### Post-Deployment
- [ ] Monitor logs for errors (first 5 minutes)
- [ ] Verify API endpoints respond
- [ ] Check metrics dashboard
- [ ] Notify team of deployment
- [ ] Update deployment log

## Related Docs

- **[Architecture](./ARCHITECTURE.md)** — System overview and design
- **[Developer Guide](./DEVELOPER.md)** — API reference and testing
- **[CRE Integration](./CRE.md)** — Chainlink workflow implementation
