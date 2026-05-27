# Deployment

## Overview

Cognivern runs as a Node.js backend served from a VPS (e.g. Hetzner), with the frontend hosted on Vercel. The backend is managed by PM2 for process management and auto-restart.

| Layer       | URL                                         |
| ----------- | ------------------------------------------- |
| Frontend    | https://cognivern.vercel.app                |
| Backend API | https://api.thisyearnofear.com              |
| Repository  | https://github.com/thisyearnofear/cognivern |

## Architecture

```text
Internet → VPS (Hetzner) → Express API (PM2) → optional Filecoin / Recall / LLMs
                          ↕
                    Vercel (Frontend)
```

## Production model

The frontend is deployed separately to Vercel. Hetzner should only run a **single backend runtime install**.

Recommended server layout:

```text
/opt/cognivern/
  app/
  shared/
    .env
    data/
    logs/
```

The backend app directory contains only the runtime payload:

- `dist/`
- runtime `package.json`
- `config/`
- bundled policy assets under `src/policies/`

Mutable state must stay under `shared/`, not inside `app/`.

## Required Environment Variables

See `.env.example` for the full list. Minimum required for production:

| Variable           | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `NODE_ENV`         | Set to `production`                        |
| `PORT`             | API port                                   |
| `API_KEY`          | API authentication key                     |
| `OPENAI_API_KEY`   | Primary LLM provider key                   |
| `OWS_VAULT_SECRET` | Secret used to encrypt the local OWS vault |

Optional integrations:

| Variable                      | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `FILECOIN_ENABLED`            | Enables Filecoin-backed signing / contract interactions when `true`                  |
| `FILECOIN_PRIVATE_KEY`        | Filecoin wallet for contract interaction; required only when `FILECOIN_ENABLED=true` |
| `FILECOIN_RPC_URL`            | Filecoin RPC endpoint                                                                |
| `GOVERNANCE_CONTRACT_ADDRESS` | Deployed governance contract address (Filecoin)                                      |
| `STORAGE_CONTRACT_ADDRESS`    | Deployed storage contract address (Filecoin)                                         |
| `XLAYER_GOVERNANCE_CONTRACT`  | Deployed governance contract address (X Layer)                                       |
| `XLAYER_STORAGE_CONTRACT`     | Deployed storage contract address (X Layer)                                          |
| `XLAYER_PRIVATE_KEY`          | Wallet private key for X Layer deployment                                            |
| `RECALL_API_KEY`              | Recall network API key                                                               |

## Shared runtime paths

PM2 should provide explicit paths for all file-backed runtime state:

- `CRE_RUNS_FILE=/opt/cognivern/shared/data/cre-runs.jsonl`
- `UX_EVENTS_FILE=/opt/cognivern/shared/data/ux-events.jsonl`
- `IDEMPOTENCY_STORE_FILE=/opt/cognivern/shared/data/idempotency-store.json`
- `OWS_VAULT_PATH=/opt/cognivern/shared/data/ows-vault.json`
- `COGNIVERN_TOKEN_TELEMETRY_FILE=/opt/cognivern/shared/data/token-telemetry.json`
- `COGNIVERN_USAGE_FILE=/opt/cognivern/shared/data/usage.json`

## Lightweight deployment flow

Build and deploy the backend artifact:

```bash
bash scripts/deploy/build-backend-artifact.sh
bash scripts/deploy/deploy-backend-artifact-hetzner.sh
```

What this flow does:

1. builds the backend locally
2. creates a backend-only tarball
3. uploads it to `/opt/cognivern/app`
4. installs runtime dependencies in place on the server
5. restarts PM2 app `cognivern-backend`
6. verifies `/health`

## PM2 Configuration

The PM2 config is at `config/ecosystem.config.cjs`.

Key settings:

- app name: `cognivern-backend`
- cwd: `/opt/cognivern/app`
- env file: `/opt/cognivern/shared/.env`
- logs: `/opt/cognivern/shared/logs`
- memory restart: `512M`

### Useful Commands

```bash
pm2 list
pm2 logs cognivern-backend
pm2 restart cognivern-backend
pm2 monit
pm2 save
```

## Rollback

Rollback is handled by redeploying a previous git commit rather than switching server-side release directories.

## Log Rotation

PM2 log rotation is handled by the `pm2-logrotate` module.

Recommended settings:

- max size: 10–20 MB per file
- retention: 5–7 files
- compression enabled

## Health Checks

```bash
curl http://127.0.0.1:10000/health
```

Expected response shape:

```json
{"status":"ok","message":"Server is running","timestamp":"...","uptime":...}
```

## Security Notes

- Never commit `.env` files or private keys
- The `FILECOIN_PRIVATE_KEY` controls the wallet that interacts with deployed contracts
- Use strong, unique values for `API_KEY`
- Restrict `CORS_ORIGIN` to your actual frontend domain in production
- Keep mutable secrets and runtime data in `/opt/cognivern/shared/`
