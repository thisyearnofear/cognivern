# Cognivern Server Operations

Operator-facing notes for the snel-bot deployment. Everything here is safe
to commit — public contract addresses, SSH alias only, no secrets. Secrets
live in `/opt/cognivern/shared/.env` on the server and `.env` locally.

See also: [DEPLOYMENT.md](./DEPLOYMENT.md) for the canonical env-var
contract and [RUNBOOK.md](./RUNBOOK.md) for incident playbooks.

## Server Access

```bash
ssh snel-bot
# User: deploy
# Server: configured via SSH config — see ~/.ssh/config
```

## Deployment Path

```
/opt/cognivern/
├── app/
│   ├── bundle/
│   │   ├── server.mjs         # esbuild bundle (main entry)
│   │   ├── package.json       # native deps only
│   │   └── node_modules/      # installed on server
│   ├── config/
│   ├── .env -> /opt/cognivern/shared/.env
│   ├── data -> /opt/cognivern/shared/data
│   └── logs -> /opt/cognivern/shared/logs
├── shared/
│   ├── .env                   # production secrets
│   ├── data/                  # SQLite, vault, telemetry, rate-limit, token-blacklist
│   └── logs/                  # PM2 log output
└── backups/
```

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

## Deployment Commands

### Bundle Deploy (Recommended)

```bash
# From local machine:
cd /path/to/cognivern
node deploy/build-bundle.mjs                                    # build esbuild bundle
scp deploy-bundle/server.mjs snel-bot:/opt/cognivern/app/bundle/server.mjs  # upload
ssh snel-bot "pm2 restart cognivern-backend"                    # restart
```

### Artifact Deploy (Alternative)

```bash
# Build artifact + deploy in one command:
bash scripts/deploy/deploy-latest-hetzner.sh
```

### Quick Restart (no code change)

```bash
ssh snel-bot "pm2 restart cognivern-backend --update-env"
```

### Contract Deployment

```bash
ssh snel-bot
cd /opt/cognivern
pnpm install  # Need dev deps for hardhat
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
# After deploy, update .env with new contract addresses
pnpm install --prod --force  # Switch back to prod only
pm2 restart cognivern --update-env
```

## PM2 Management

```bash
pm2 list                                    # All processes
pm2 describe cognivern-backend              # Detailed status
pm2 logs cognivern-backend --lines 50       # Recent logs
pm2 logs cognivern-backend --err            # Errors only
pm2 restart cognivern-backend --update-env  # Restart with env changes
pm2 save                                    # Persist process list
```

## Log Rotation Config

```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:workerInterval 3600
```

## Common Issues

### App crash-looping on missing env vars
Check which vars are missing: `pm2 logs cognivern --err`
Add them to `/opt/cognivern/.env` (requires sudo: `sudo tee -a /opt/cognivern/.env`)
Restart: `pm2 restart cognivern --update-env`

### Out of disk space
```bash
du -sh /opt/cognivern/* | sort -rh | head -10
pnpm store prune
# Truncate logs
cd /opt/cognivern/logs && for f in *.log; do tail -1000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done
```

### Rebuild fails after pnpm install --prod
`--prod` removes `@types/node` needed by TypeScript. Either:
- Run `pnpm install` (full) to rebuild, then `pnpm install --prod --force` after
- Or build locally and only upload `dist/`

## Service URLs

- **API**: `https://cognivern.thisyearnofear.com` (nginx → port 3087)
- **Health**: `https://cognivern.thisyearnofear.com/health`
- **Frontend**: `https://cognivern.vercel.app`
- **PromptOS**: `https://cognivern.vercel.app/os`

## Critical Env Vars

The backend listens on `$PORT` (set in `/opt/cognivern/shared/.env`). nginx
must match. A drift here returns 502 for every public endpoint — see
RUNBOOK playbook #8.

| Var | Required value on prod | Why |
| --- | --- | --- |
| `PORT` | `3087` | Backend HTTP listener. nginx at `/etc/nginx/sites-enabled/cognivern` must `proxy_pass http://127.0.0.1:3087`. |
| `XLAYER_CHAIN_ID` | `1952` | testrpc.xlayer.tech reports chainId 1952 (mainnet is 196). The historical default `195` doesn't exist and breaks every native transfer with `NETWORK_ERROR`. |
| `OWS_VAULT_PATH` | `/opt/cognivern/shared/data/ows-vault.json` | Lives outside `app/bundle/` so `pnpm deploy:lean` (which rsyncs `--delete` into `app/bundle/`) does not wipe wallets + scoped API keys on every deploy. |
| `JWT_SECRET` | (set) | Required in production. authMiddleware throws on missing. |
| `MONGODB_URI` | (set) | Run store falls back to JSONL-only without it. |
| `OWS_BOOTSTRAP_PRIVATE_KEY` | (set) | Auto-imports the Treasury wallet on first vault read (only if vault is empty). |

The nginx config used by the live deployment is tracked at
`deploy/nginx/cognivern.conf` in the repo. To re-apply manually:

```bash
sudo cp deploy/nginx/cognivern.conf /etc/nginx/sites-enabled/cognivern
sudo nginx -t && sudo systemctl reload nginx
```

## Other Services on Server

```bash
pm2 list
# cognivern-backend (port 3087)
# diversifi-api
# sportwarren-api
# voice-hotline-celo
# onpoint-api
```
