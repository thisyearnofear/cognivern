# Deployment

## Overview

Cognivern runs as a Node.js backend served from a VPS (e.g. Hetzner), with the frontend hosted on Vercel. The backend is managed by PM2 for process management and auto-restart.

## Architecture

```
Internet → VPS (Hetzner) → Express API (PM2) → Filecoin / Recall / LLMs
                          ↕
                    Vercel (Frontend)
```

## Required Environment Variables

See `.env.example` for the full list. Minimum required for production:

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Set to `production` |
| `PORT` | API port (default: 3000) |
| `API_KEY` | API authentication key |
| `FILECOIN_PRIVATE_KEY` | Filecoin wallet for contract interaction |
| `FILECOIN_RPC_URL` | Filecoin RPC endpoint |
| `GOVERNANCE_CONTRACT_ADDRESS` | Deployed governance contract address |
| `STORAGE_CONTRACT_ADDRESS` | Deployed storage contract address |
| `RECALL_API_KEY` | Recall network API key |
| `OPENAI_API_KEY` | Primary LLM provider key |

## Contract Deployment

Before running the backend, deploy the smart contracts to your target network:

```bash
# Set FILECOIN_PRIVATE_KEY and FILECOIN_RPC_URL in .env first
pnpm install
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
```

This deploys `GovernanceContract` and `AIGovernanceStorage`, creates a sample policy, and outputs the addresses to add to your `.env`.

## Deployment Steps

1. **Build locally**: `pnpm run build`
2. **Upload source + dist** to server (exclude `node_modules`, `.git`, `logs`)
3. **Install dependencies**: `pnpm install --prod` on server
4. **Configure `.env`** with production values
5. **Start with PM2**: `pm2 start config/ecosystem.config.cjs`
6. **Verify**: `curl http://localhost:<PORT>/health`

The `deploy/deploy.sh` script automates this flow (requires `SERVER_HOST` configuration).

## PM2 Configuration

The PM2 config is at `config/ecosystem.config.cjs`. Key settings:

- **Log rotation**: 10 MB max per file, 7 compressed backups retained
- **Memory restart**: Auto-restart if memory exceeds 512 MB
- **Log files**: Written to `logs/` directory

### Useful Commands

```bash
pm2 list                    # View all processes
pm2 logs cognivern          # View logs
pm2 restart cognivern       # Restart
pm2 monit                   # Resource monitoring
pm2 save                    # Persist process list
```

## Frontend

The frontend is built separately and deployed to Vercel. It communicates with the backend API via the `CORS_ORIGIN` setting.

## Log Rotation

PM2 log rotation is configured via the `pm2-logrotate` module:
- Max size: 10 MB per log file
- Retention: 7 compressed backups
- Rotation: Daily at midnight

## Data Persistence

The following directories contain persistent data:
- `logs/` — Application and PM2 logs
- `data/` — Application data files (optional)

## Rollback

Since the server runs from the deployed `dist/` directory, rollback means:
1. Re-deploy the previous working build
2. Restart PM2

## Health Checks

```bash
curl http://localhost:<PORT>/health
# Expected: {"status":"ok","message":"Server is running","timestamp":"...","uptime":...}
```

## Security Notes

- Never commit `.env` files or private keys
- The `FILECOIN_PRIVATE_KEY` controls the wallet that interacts with deployed contracts
- Use strong, unique values for `API_KEY`
- Restrict `CORS_ORIGIN` to your actual frontend domain in production
- The Hardhat default test key (`0xac0974...`) should never be used in production
