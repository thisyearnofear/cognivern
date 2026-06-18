# Cognivern Server Operations

Operator-facing notes for the snel-bot deployment. Everything here is safe
to commit — public contract addresses, SSH alias only, no secrets. Secrets
live in `/opt/cognivern/shared/.env` on the server and `.env` locally.

See also: [RUNBOOK.md](./RUNBOOK.md) for incident playbooks.

## Architecture

```text
Internet → VPS (Hetzner) → Express API (PM2) → optional Filecoin / LLMs
                          ↕
                    Vercel (Frontend)
```

## Server Access

```bash
ssh snel-bot
# User: deploy
# Server: configured via SSH config — see ~/.ssh/config
```

## Production Server Layout

```
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
    data/                # SQLite, vault, telemetry, rate-limit, token-blacklist
    logs/                # PM2 log output
  backups/
```

The backend app directory contains only the runtime payload. Mutable state
must stay under `shared/`, not inside `app/`.

## Current Deployed Contracts

| Network | Contract | Address | Status |
|---------|----------|---------|--------|
| Arbitrum Sepolia (chain 421614) | `ConfidentialSpendPolicy` (FHE, live coFHE) | `0x710005F7454B8756F7E1118B26d1361b001fc818` | Deployed 2026-06-13 — end-to-end FHE path verified (encrypt → registerPolicy → evaluateSpend → SpendEvaluated) |
| Arbitrum Sepolia (chain 421614) | `GovernanceContract` | `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` | Deployed 2026-06-13 — verified on-chain |
| Arbitrum Sepolia (chain 421614) | `GovernedVault` | `0x468F1CfBB5bec9352b279192a952916610f58BB4` | Deployed 2026-06-13 — verified on-chain |
| X Layer Testnet (chain 1952) | `GovernanceContract` | `0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6` | Live |
| X Layer Testnet (chain 1952) | `AIGovernanceStorage` | `0x1E0317beFf188e314BbC3483e06773EEfa28bB2D` | Live |
| Filecoin Calibration (chain 314159) | `GovernanceContract` | `0xe7fA8a2D1DD0Bd3F766e04ccFC50061891A4641e` | Live |
| Filecoin Calibration (chain 314159) | `AIGovernanceStorage` | `0x492f33E4701D9bd42a133c1b5AB1e4ac8333c590` | Live |
| Mantle Sepolia (chain 5003) | `GovernedVault` | `0x723e444ee6D7da19fADe372f85DA06dD849bF1E0` | Live |

> **Note on Fhenix FHE path**: The `ConfidentialSpendPolicy` contract is designed for the Fhenix co-processor (`TASK_MANAGER_ADDRESS = 0xeA30c4B...7848D9`) which only exists on the Fhenix testnet. The Fhenix Helium testnet (`api.helium.fhenix.zone`) has been sunset, and the new Fhenix testnet endpoint is not currently reachable from this environment. The FHE path is therefore **offline** until Fhenix re-exposes a usable testnet. The plain `GovernanceContract` on Arbitrum Sepolia is the live on-chain governance endpoint in the meantime.

## Deployer Wallet

- **Address**: `0x5912d140b58c62ff007D803D25ea7CcC818548D3` (same key across Filecoin, X Layer, Mantle, Arbitrum Sepolia)
- **Private Key**: See server `.env` (`FHENIX_PRIVATE_KEY` / `ARBITRUM_PRIVATE_KEY`)
- **Networks**: Filecoin Calibration, X Layer Testnet, Mantle Sepolia, Arbitrum Sepolia

## Required Environment Variables

See `.env.example` for the full list. Minimum required for production:

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | Set to `production` |
| `PORT` | API port (must match nginx proxy_pass) |
| `API_KEY` | API authentication key |
| `OPENAI_API_KEY` | Primary LLM provider key |
| `OWS_VAULT_SECRET` | Secret used to encrypt the local OWS vault |

Optional integrations:

| Variable | Purpose |
| -------- | ------- |
| `FILECOIN_PRIVATE_KEY` | EVM signing key for Filecoin contract interaction and evidence signing; also used as Fhenix fallback |
| `FILECOIN_RPC_URL` | Filecoin Calibration RPC endpoint |
| `GOVERNANCE_CONTRACT_ADDRESS` | Deployed GovernanceContract address (shared across Filecoin + X Layer) |
| `STORAGE_CONTRACT_ADDRESS` | Deployed AIGovernanceStorage address (enables FilecoinStorageService dual-anchor) |
| `XLAYER_GOVERNANCE_CONTRACT` | Deployed governance contract address (X Layer) |
| `XLAYER_STORAGE_CONTRACT` | Deployed storage contract address (X Layer) |
| `XLAYER_PRIVATE_KEY` | Wallet private key for X Layer deployment |
| `XLAYER_CHAIN_ID` | X Layer testnet chainId. Defaults to `1952`. **NOT `195`** (doesn't exist — breaks native transfers). Mainnet is `196`. |
| `FHENIX_PRIVATE_KEY` | Wallet for Fhenix confidential policy ops (Arbitrum Sepolia) |
| `FHENIX_POLICY_CONTRACT` | `ConfidentialSpendPolicy` contract address on Fhenix |
| `FHENIX_CHAIN_ID` | Fhenix chain ID (default: 421614 for Arbitrum Sepolia) |
| `PRIVARA_PRIVATE_KEY` | Wallet for Privara confidential payroll (falls back to `FHENIX_PRIVATE_KEY`) |

### Critical Port/Chain Values

| Var | Required value | Why |
| --- | --- | --- |
| `PORT` | `3087` | Backend HTTP listener. nginx must `proxy_pass http://127.0.0.1:3087`. Drift = 502 for every public endpoint (see RUNBOOK playbook #8). |
| `XLAYER_CHAIN_ID` | `1952` | testrpc.xlayer.tech reports chainId 1952 (mainnet is 196). Historical default `195` doesn't exist and breaks every native transfer. |
| `OWS_VAULT_PATH` | `/opt/cognivern/shared/data/ows-vault.json` | Lives outside `app/` so `pnpm deploy:hetzner` (which replaces `app/`) does not wipe wallets. |
| `JWT_SECRET` | (set) | Required in production. authMiddleware throws on missing. |
| `MONGODB_URI` | (set) | Run store falls back to JSONL-only without it. |
| `OWS_BOOTSTRAP_PRIVATE_KEY` | (set) | Auto-imports the Treasury wallet on first vault read (only if vault is empty). |

## Shared Runtime Paths

PM2 should provide explicit paths for all file-backed runtime state:

```
CRE_RUNS_FILE=/opt/cognivern/shared/data/cre-runs.jsonl
UX_EVENTS_FILE=/opt/cognivern/shared/data/ux-events.jsonl
IDEMPOTENCY_STORE_FILE=/opt/cognivern/shared/data/idempotency-store.json
RATE_LIMIT_STORE_FILE=/opt/cognivern/shared/data/rate-limit-store.jsonl
TOKEN_BLACKLIST_FILE=/opt/cognivern/shared/data/token-blacklist.jsonl
OWS_VAULT_PATH=/opt/cognivern/shared/data/ows-vault.json
COGNIVERN_TOKEN_TELEMETRY_FILE=/opt/cognivern/shared/data/token-telemetry.json
COGNIVERN_USAGE_FILE=/opt/cognivern/shared/data/usage.json
```

## Auto-Created SQLite Tables

`src/backend/db/index.ts` runs an idempotent `CREATE TABLE IF NOT EXISTS` migration on first boot:

- `users`, `workspaces`, `nonces`, `api_keys` — auth and workspace state
- `workspace_agents`, `workspace_policies`, `policy_versions`, `workspace_members` — multi-tenant data
- `copilot_runs`, `copilot_events` — live demo mission persistence

No manual migration step required; a fresh checkout or cold lean deploy creates the schema on first backend start.

## Deployment Commands

### Bundle Deploy (Recommended)

```bash
# From local machine:
node deploy/build-bundle.mjs                                    # build esbuild bundle
scp deploy-bundle/server.mjs snel-bot:/opt/cognivern/app/bundle/server.mjs  # upload
ssh snel-bot "pm2 restart cognivern-backend"                    # restart
```

What this flow does:
1. Bundles the entire backend into a single `server.mjs` via esbuild
2. Native modules (`better-sqlite3`, `@cofhe/sdk`, etc.) are marked external and installed separately on the server
3. Uploads the bundle to `/opt/cognivern/app/bundle/server.mjs`
4. Restarts PM2

### Artifact Deploy (Alternative)

Build a self-contained `.tgz` artifact and deploy to Hetzner:

```bash
bash scripts/deploy/deploy-latest-hetzner.sh
```

This runs:
1. `build-backend-artifact.sh` — builds locally, creates `.artifacts/cognivern-backend-{timestamp}-{hash}.tgz`
2. `deploy-backend-artifact-hetzner.sh` — scp to server, extract, `npm install --omit=dev`, PM2 restart, health check

### Quick Restart (no code change)

```bash
ssh snel-bot "pm2 restart cognivern-backend --update-env"
```

### Contract Deployment

```bash
ssh snel-bot
cd /opt/cognivern
pnpm install
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
# After deploy, update .env with new contract addresses
pnpm install --prod --force
pm2 restart cognivern --update-env
```

## Reverse Proxy (nginx)

The backend listens on `$PORT` (default `3087`). nginx must `proxy_pass` to the same port.
The committed config at `deploy/nginx/cognivern.conf` is the source of truth:

```bash
sudo cp deploy/nginx/cognivern.conf /etc/nginx/sites-enabled/cognivern
sudo nginx -t && sudo systemctl reload nginx
```

A port mismatch makes every public endpoint return 502 — see [RUNBOOK.md playbook #8](./RUNBOOK.md#8-all-public-endpoints-return-502).

## Rollback Procedure

### Application Rollback

```bash
# 1. Check available backups
ssh snel-bot "ls -lt /opt/cognivern/backups/ | head -10"

# 2. Stop the service
ssh snel-bot "pm2 stop cognivern-backend"

# 3. Backup current bundle
ssh snel-bot "cp /opt/cognivern/app/bundle/server.mjs /opt/cognivern/backups/server.mjs.pre-rollback.$(date +%Y%m%d)"

# 4. Restore last-good bundle
ssh snel-bot "cp /opt/cognivern/backups/server.mjs.PREVIOUS /opt/cognivern/app/bundle/server.mjs"

# 5. Restart
ssh snel-bot "pm2 restart cognivern-backend"

# 6. Verify
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq
```

### Contract Rollback

1. Redeploy the previous contract version using Hardhat.
2. Update contract addresses in `/opt/cognivern/shared/.env`.
3. Restart: `pm2 restart cognivern-backend --update-env`
4. Verify on-chain state matches.

### Database Rollback

```bash
ssh snel-bot "pm2 stop cognivern-backend"
ssh snel-bot "cp /opt/cognivern/shared/data/governance.db /opt/cognivern/backups/governance.db.pre-rollback.$(date +%Y%m%d)"
ssh snel-bot "cp /opt/cognivern/backups/governance.db.BACKUP_DATE /opt/cognivern/shared/data/governance.db"
ssh snel-bot "pm2 restart cognivern-backend"
```

## PM2 Management

The PM2 process runs from `/opt/cognivern/app/bundle/` with env loaded from `/opt/cognivern/shared/.env`.

Key settings:
- app name: `cognivern-backend`
- script: `/opt/cognivern/app/bundle/server.mjs`
- cwd: `/opt/cognivern/app/bundle`
- env file: `/opt/cognivern/shared/.env`
- logs: `/opt/cognivern/shared/logs`
- memory restart: `512M`
- exec mode: `fork` (not cluster — SQLite requires single-process)

```bash
pm2 list                                    # All processes
pm2 describe cognivern-backend              # Detailed status
pm2 logs cognivern-backend --lines 50       # Recent logs
pm2 logs cognivern-backend --err            # Errors only
pm2 restart cognivern-backend --update-env  # Restart with env changes
pm2 save                                    # Persist process list
```

## Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:workerInterval 3600
```

## Health Checks

```bash
# From server
curl http://127.0.0.1:3087/health

# From outside
curl https://cognivern.thisyearnofear.com/health?deep=true | jq

# SLO metrics (latency percentiles + error rates)
curl -s https://cognivern.thisyearnofear.com/api/health/slo | jq
```

Deep health check verifies SQLite + notifications table connectivity.
Standard response: `{"status":"ok","message":"Server is running","timestamp":"...","uptime":...}`

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

## Common Issues

### App crash-looping on missing env vars
Check which vars are missing: `pm2 logs cognivern --err`
Add them to `/opt/cognivern/.env` (requires sudo: `sudo tee -a /opt/cognivern/.env`)
Restart: `pm2 restart cognivern --update-env`

### Out of disk space
```bash
du -sh /opt/cognivern/* | sort -rh | head -10
pnpm store prune
cd /opt/cognivern/logs && for f in *.log; do tail -1000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done
```

### Rebuild fails after pnpm install --prod
`--prod` removes `@types/node` needed by TypeScript. Either:
- Run `pnpm install` (full) to rebuild, then `pnpm install --prod --force` after
- Or build locally and only upload `dist/`

### All public endpoints return 502
Likely cause: nginx proxies to wrong port. See [RUNBOOK playbook #8](./RUNBOOK.md#8-all-public-endpoints-return-502).

## Service URLs

- **API**: `https://cognivern.thisyearnofear.com` (nginx → port 3087)
- **Health**: `https://cognivern.thisyearnofear.com/health`
- **Frontend**: `https://cognivern.vercel.app`
- **PromptOS**: `https://cognivern.vercel.app/os`

## Other Services on Server

```bash
pm2 list
# cognivern-backend (port 3087)
# diversifi-api
# sportwarren-api
# voice-hotline-celo
# onpoint-api
```
