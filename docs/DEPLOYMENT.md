# Deployment

## Overview

Cognivern uses a **backend artifact + releases** deployment model for fast, safe rollbacks.

## Why This Model

- Production servers are runtime environments only (no TypeScript builds)
- Fast rollbacks via symlink switching
- Prod dependencies only (no frontend deps on backend server)
- Secrets separated from code (commit-safe config)

## Server Layout

```
/opt/cognivern/
  releases/
    <release-id>/
      dist/
      node_modules/        # prod deps only
      .env -> ../shared/.env
  current -> releases/<release-id>   # active release
  shared/
    .env                             # secrets (server-local, NOT in git)
    data/
    logs/
  config/
    ecosystem.config.cjs             # PM2 config
```

**Rule:** Application runs from `/opt/cognivern/current`.

## Secrets Policy

| Do NOT Commit | Safe to Commit |
|---------------|----------------|
| `.env`, `.env.production` | Deployment scripts |
| Private keys, API keys | Deployment documentation |
| PM2 files with secrets | `.env.example` with placeholders |

Secrets live in `/opt/cognivern/shared/.env` on server.

## Local Developer Workflow

### Build Backend Artifact

```bash
bash scripts/deploy/build-backend-artifact.sh
```

Creates tarball under `.artifacts/` with `dist/`, `package.json`, `pnpm-lock.yaml`, `config/`.

### Deploy

```bash
bash scripts/deploy/deploy-backend-artifact-hetzner.sh
```

Deploy script: uploads tarball, installs prod deps, links shared state, updates symlink, restarts PM2, runs health check.

### List Releases

```bash
bash scripts/deploy/list-releases-hetzner.sh
```

### Rollback

```bash
bash scripts/deploy/rollback-hetzner.sh <release-dir-name>
```

## PM2 Configuration

### ecosystem.config.cjs (Commit-Safe)

```javascript
module.exports = {
  apps: [{
    name: "cognivern-agent",
    script: "./dist/index.js",
    instances: 1,
    exec_mode: "cluster",
    env: { NODE_ENV: "production" },
    max_memory_restart: "1G",
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

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

Deploy script retries health check up to 5 times with 5s intervals.

## Monitoring

```bash
pm2 logs cognivern-agent --lines 100 --follow   # View logs
pm2 logs cognivern-agent --err                   # Errors only
pm2 monit                                        # Resource usage
```

## Data Persistence

Storage: `data/cre-runs.jsonl`, `data/usage.json`, `data/token-telemetry.json`

### Backup

```bash
BACKUP_DIR="/backups/cognivern/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR
cp /opt/cognivern/shared/data/*.jsonl $BACKUP_DIR/
cp /opt/cognivern/shared/data/*.json $BACKUP_DIR/
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | `pm2 status`, `pm2 logs --err`, verify `.env`, check Node version |
| High memory | `pm2 monit`, restart, check for leaks |
| Data corruption | Stop app, backup data, restore or start fresh |
| Rollback | `bash scripts/deploy/rollback-hetzner.sh <release>`, verify health |

## Deployment Checklist

- [ ] Tests passing, build clean
- [ ] `.env.example` updated
- [ ] Artifact built, uploaded, deployed
- [ ] Health check passed
- [ ] Logs monitored (first 5 minutes)
- [ ] Team notified

## Related Docs

- [Hackathon Brief](./HACKATHON.md) — Demo story and submission
- [Architecture](./ARCHITECTURE.md) — System design and data flows
- [Developer Guide](./DEVELOPER.md) — APIs, local setup, testing
