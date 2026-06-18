# Operations & Runbook

Production deployment, PM2 management, and incident response for Cognivern on Hetzner.

**Server**: `snel-bot` (user: `deploy`)
**API**: `https://cognivern.thisyearnofear.com`
**PM2 process**: `cognivern-backend`

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
    dist/               # compiled backend
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

Mutable state must stay under `shared/`, not inside `app/`.

## Deployed Contracts

| Network | Contract | Address | Status |
|---------|----------|---------|--------|
| Arbitrum Sepolia (421614) | `ConfidentialSpendPolicy` (FHE) | `0x710005F7454B8756F7E1118B26d1361b001fc818` | FHE path offline until Fhenix re-exposes testnet |
| Arbitrum Sepolia (421614) | `GovernanceContract` | `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` | Live |
| Arbitrum Sepolia (421614) | `GovernedVault` | `0x468F1CfBB5bec9352b279192a952916610f58BB4` | Live |
| X Layer Testnet (1952) | `GovernanceContract` | `0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6` | Live |
| X Layer Testnet (1952) | `AIGovernanceStorage` | `0x1E0317beFf188e314BbC3483e06773EEfa28bB2D` | Live |
| Filecoin Calibration (314159) | `GovernanceContract` | `0xe7fA8a2D1DD0Bd3F766e04ccFC50061891A4641e` | Live |
| Filecoin Calibration (314159) | `AIGovernanceStorage` | `0x492f33E4701D9bd42a133c1b5AB1e4ac8333c590` | Live |
| Mantle Sepolia (5003) | `GovernedVault` | `0x723e444ee6D7da19fADe372f85DA06dD849bF1E0` | Live |

**Deployer wallet**: `0x5912d140b58c62ff007D803D25ea7CcC818548D3` (same key across all networks, private key in server `.env`)

## Required Environment Variables

See `.env.example` for the full list. Minimum for production:

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | `production` |
| `PORT` | API port (must match nginx proxy_pass — currently `3087`) |
| `API_KEY` | API authentication key |
| `JWT_SECRET` | Required in production — authMiddleware throws on missing |
| `OWS_VAULT_SECRET` | Secret used to encrypt the local OWS vault |

### Critical Values

| Var | Required value | Why |
| --- | --- | --- |
| `PORT` | `3087` | nginx must `proxy_pass http://127.0.0.1:3087`. Drift = 502. |
| `XLAYER_CHAIN_ID` | `1952` | Mainnet is `196`. `195` doesn't exist — breaks native transfers. |
| `OWS_VAULT_PATH` | `/opt/cognivern/shared/data/ows-vault.json` | Outside `app/` so deploy doesn't wipe wallets. |
| `MONGODB_URI` | (set) | Run store falls back to JSONL-only without it. |

### Shared Runtime Paths

```
CRE_RUNS_FILE=/opt/cognivern/shared/data/cre-runs.jsonl
UX_EVENTS_FILE=/opt/cognivern/shared/data/ux-events.jsonl
IDEMPOTENCY_STORE_FILE=/opt/cognivern/shared/data/idempotency-store.json
RATE_LIMIT_STORE_FILE=/opt/cognivern/shared/data/rate-limit-store.jsonl
TOKEN_BLACKLIST_FILE=/opt/cognivern/shared/data/token-blacklist.jsonl
OWS_VAULT_PATH=/opt/cognivern/shared/data/ows-vault.json
```

SQLite tables auto-created on first boot: `users`, `workspaces`, `nonces`, `api_keys`, `workspace_agents`, `workspace_policies`, `policy_versions`, `workspace_members`, `copilot_runs`, `copilot_events`.

## Deployment

### Artifact Deploy (Recommended)

```bash
pnpm deploy:hetzner
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
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
# Update .env with new contract addresses
pm2 restart cognivern-backend --update-env
```

## Reverse Proxy (nginx)

Backend listens on `$PORT` (default `3087`). Committed config at `deploy/nginx/cognivern.conf`:

```bash
sudo cp deploy/nginx/cognivern.conf /etc/nginx/sites-enabled/cognivern
sudo nginx -t && sudo systemctl reload nginx
```

## PM2 Management

- app name: `cognivern-backend`
- exec mode: `fork` (not cluster — SQLite requires single-process)
- memory restart: `512M`
- env file: `/opt/cognivern/shared/.env`
- logs: `/opt/cognivern/shared/logs`

```bash
pm2 list
pm2 describe cognivern-backend
pm2 logs cognivern-backend --lines 50
pm2 logs cognivern-backend --err
pm2 restart cognivern-backend --update-env
pm2 save
```

## Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Health Checks

```bash
curl http://127.0.0.1:3087/health                          # from server
curl https://cognivern.thisyearnofear.com/health?deep=true  # from outside
curl -s https://cognivern.thisyearnofear.com/api/health/slo # SLO metrics
```

## Rollback

### Application

```bash
ssh snel-bot "ls -lt /opt/cognivern/backups/ | head -10"          # check backups
ssh snel-bot "pm2 stop cognivern-backend"
ssh snel-bot "cp /opt/cognivern/backups/server.mjs.PREVIOUS /opt/cognivern/app/dist/src/index.js"
ssh snel-bot "pm2 restart cognivern-backend"
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq
```

### Database

```bash
ssh snel-bot "pm2 stop cognivern-backend"
ssh snel-bot "cp /opt/cognivern/shared/data/governance.db /opt/cognivern/backups/governance.db.pre-rollback.$(date +%Y%m%d)"
ssh snel-bot "cp /opt/cognivern/backups/governance.db.BACKUP_DATE /opt/cognivern/shared/data/governance.db"
ssh snel-bot "pm2 restart cognivern-backend"
```

---

## Incident Response

### Quick Diagnostics

```bash
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq     # health
curl -s https://cognivern.thisyearnofear.com/api/health/slo | jq       # SLO metrics
ssh snel-bot "pm2 logs cognivern-backend --lines 200 --nostream"       # recent logs
ssh snel-bot "pm2 logs cognivern-backend --err --lines 100 --nostream" # errors only
ssh snel-bot "pm2 describe cognivern-backend"                          # process status
```

### Playbook 1: Governance Evaluations Timing Out

**Symptom**: `/api/governance/evaluate` returns 504 or takes >5s.

**Diagnose**: Check Fhenix health and SQLite locks:
```bash
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq '.dependencies.fhenix'
ssh snel-bot "pm2 logs cognivern-backend --err --lines 50 --nostream | grep -i 'SQLITE_BUSY\|database is locked'"
```

**Fix**: If Fhenix down, set `CONTROL_EVAL_MODE=false` and restart. If SQLite locks, check for runaway processes and restart.

### Playbook 2: FHE Decisions Stuck Pending

**Symptom**: `ConfidentialSpendPolicy` evaluations never emit `SpendEvaluated` events.

**Fix**: Check Fhenix RPC. If testnet migrated, update `FHENIX_RPC_URL` and `TASK_MANAGER_ADDRESS` in `.env`. Temporarily disable on-chain FHE to restore governance.

### Playbook 3: SQLite Lock Errors

**Symptom**: `SQLITE_BUSY: database is locked`, 500 errors on governance/audit endpoints.

**Fix**: Ensure PM2 is in `fork` mode (not cluster). If `.db-journal` orphaned, restart PM2. Last resort: backup DB, delete journal, restart.

### Playbook 4: MongoDB Connection Flapping

**Symptom**: Intermittent 500s, `MongoServerSelectionError` in logs.

**Fix**: Atlas free tier may have paused — resume from dashboard. Check `MONGODB_URI` in `.env`. Add server IP to Atlas whitelist.

### Playbook 5: Rate Limit False Positives

**Symptom**: Legitimate requests returning 429.

**Fix**: Increase `RATE_LIMIT_MAX_REQUESTS` in `.env`. Clear store: `echo '{}' > /opt/cognivern/shared/data/rate-limit-store.json`. Whitelist IPs via `RATE_LIMIT_WHITELIST`.

### Playbook 6: Disk Full

**Symptom**: `No space left on device`, write failures.

**Fix**:
```bash
ssh snel-bot 'cd /opt/cognivern/shared/logs && for f in *.log; do tail -1000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done'
ssh snel-bot "pnpm store prune"
ssh snel-bot "sqlite3 /opt/cognivern/shared/data/cre-runs.db 'VACUUM;' 2>/dev/null"
```

### Playbook 7: All Public Endpoints Return 502

**Symptom**: Every API call returns 502. Backend may be healthy.

**Fix**: nginx port mismatch. Confirm backend responds on 3087, then fix nginx:
```bash
ssh snel-bot "sudo sed -i 's|http://127.0.0.1:[0-9]\\+|http://127.0.0.1:3087|' /etc/nginx/sites-enabled/cognivern"
ssh snel-bot "sudo nginx -t && sudo systemctl reload nginx"
```

## On-Call Escalation

1. **First responder** — Check PM2 logs and SLO. Most issues resolve with a restart.
2. **Infrastructure** — Server admin (see SSH config for `snel-bot`)
3. **Blockchain/FHE** — Fhenix Discord `#testnet-support`, Filecoin Slack `#fil-calibration`, Arbitrum Discord `#dev-support`
4. **Data loss or security incidents** — Project owner immediately

**When to wake someone up**: API down >5 min and restart doesn't fix it, on-chain state inconsistent (funds at risk), unauthorized access, data corruption affecting multiple workspaces, disk full and unable to free space.

## Security Notes

- Never commit `.env` files or private keys
- API keys hashed with scrypt before storage
- JWT tokens revocable via server-side blacklist
- Rate limiting persistent across restarts (file-backed)
- SIWE authentication uses nonce replay protection
- Helmet CSP, CORS, body size limits, trust-proxy configured for production

## Service URLs

- **API**: `https://cognivern.thisyearnofear.com` (nginx → port 3087)
- **Frontend**: `https://cognivern.vercel.app`
- **PromptOS**: `https://cognivern.vercel.app/os`

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design, integrations, data flows
- [Developer Guide](./DEVELOPER.md) — Local setup, APIs, testing
