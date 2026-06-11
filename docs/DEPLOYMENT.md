# Deployment

## Overview

Cognivern runs as a Node.js backend served from a VPS (e.g. Hetzner), with the frontend hosted on Vercel. The backend is managed by PM2 for process management and auto-restart.

| Layer       | URL                                         |
| ----------- | ------------------------------------------- |
| Frontend    | https://cognivern.vercel.app                |
| Backend API | https://cognivern.thisyearnofear.com        |
| Repository  | https://github.com/thisyearnofear/cognivern |

## Architecture

```text
Internet → VPS (Hetzner) → Express API (PM2) → optional Filecoin / LLMs
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
| `FHENIX_PRIVATE_KEY`          | Wallet for Fhenix confidential policy ops (Arbitrum Sepolia)                         |
| `FHENIX_POLICY_CONTRACT`      | `ConfidentialSpendPolicy` contract address on Fhenix                                 |
| `FHENIX_CHAIN_ID`             | Fhenix chain ID (default: 421614 for Arbitrum Sepolia)                               |
| `PRIVARA_PRIVATE_KEY`         | Wallet for Privara confidential payroll (falls back to `FHENIX_PRIVATE_KEY`)          |

## Shared runtime paths

PM2 should provide explicit paths for all file-backed runtime state:

- `CRE_RUNS_FILE=/opt/cognivern/shared/data/cre-runs.jsonl`
- `UX_EVENTS_FILE=/opt/cognivern/shared/data/ux-events.jsonl`
- `IDEMPOTENCY_STORE_FILE=/opt/cognivern/shared/data/idempotency-store.json`
- `RATE_LIMIT_STORE_FILE=/opt/cognivern/shared/data/rate-limit-store.jsonl`
- `TOKEN_BLACKLIST_FILE=/opt/cognivern/shared/data/token-blacklist.jsonl`
- `OWS_VAULT_PATH=/opt/cognivern/shared/data/ows-vault.json`
- `COGNIVERN_TOKEN_TELEMETRY_FILE=/opt/cognivern/shared/data/token-telemetry.json`
- `COGNIVERN_USAGE_FILE=/opt/cognivern/shared/data/usage.json`

## Lightweight deployment flow

Build and deploy the backend as a single bundled file:

```bash
# 1. Build the bundle locally (esbuild → deploy-bundle/server.mjs)
node deploy/build-bundle.mjs

# 2. Upload to server
scp deploy-bundle/server.mjs snel-bot:/opt/cognivern/app/bundle/server.mjs

# 3. Restart PM2
ssh snel-bot "pm2 restart cognivern-backend"
```

What this flow does:

1. Bundles the entire backend into a single `server.mjs` via esbuild
2. Native modules (`better-sqlite3`, `@cofhe/sdk`, etc.) are marked external and installed separately on the server
3. Uploads the bundle to `/opt/cognivern/app/bundle/server.mjs`
4. Restarts PM2 — the process runs from `/opt/cognivern/app/bundle/`

### Production server layout

```text
/opt/cognivern/
  app/
    bundle/
      server.mjs        # esbuild bundle (main entry)
      package.json       # native deps only
      node_modules/      # installed on server
    config/
    .env -> /opt/cognivern/shared/.env
    data -> /opt/cognivern/shared/data
    logs -> /opt/cognivern/shared/logs
  shared/
    .env                 # production secrets
    data/                # SQLite, vault, telemetry
    logs/                # PM2 log output
```

## PM2 Configuration

The PM2 process runs from `/opt/cognivern/app/bundle/` with env loaded from `/opt/cognivern/shared/.env`.

Key settings:

- app name: `cognivern-backend`
- script: `/opt/cognivern/app/bundle/server.mjs`
- cwd: `/opt/cognivern/app/bundle`
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
# From server
curl http://127.0.0.1:3087/health

# From outside
curl https://cognivern.thisyearnofear.com/health
```

Expected response shape:

```json
{"status":"ok","message":"Server is running","timestamp":"...","uptime":...}
```

Deep health check (SQLite + notifications table):

```bash
curl https://cognivern.thisyearnofear.com/health?deep=true
```

## Security Notes

- Never commit `.env` files or private keys
- The `FILECOIN_PRIVATE_KEY` controls the wallet that interacts with deployed contracts
- Use strong, unique values for `API_KEY`
- Restrict `CORS_ORIGIN` to your actual frontend domain in production
- Keep mutable secrets and runtime data in `/opt/cognivern/shared/`
- API keys are hashed with scrypt before storage (migrated from SHA-256)
- JWT tokens are revocable via server-side blacklist (logout invalidates tokens)
- Rate limiting is persistent across restarts (file-backed stores under `shared/data/`)
- SIWE authentication uses nonce replay protection with expiration
- Contract addresses are automatically audited via ChainGPT before spend execution
- Helmet CSP, CORS, body size limits, and trust-proxy are configured for production

### Artifact deploy flow (alternative)

Build a self-contained `.tgz` artifact and deploy to Hetzner:

```bash
# Build artifact + deploy in one command
bash scripts/deploy/deploy-latest-hetzner.sh
```

This runs two steps:
1. `build-backend-artifact.sh` — builds locally, creates `.artifacts/cognivern-backend-{timestamp}-{hash}.tgz`
2. `deploy-backend-artifact-hetzner.sh` — scp to server, extract, `npm install --omit=dev`, PM2 restart, health check
