# Deprecated: Hetzner Deployment

This directory contains legacy Hetzner deployment configuration. The primary deployment is now via **Vercel** (see root `vercel.json`).

## Still Useful

| File/Dir             | Purpose                        |
| -------------------- | ------------------------------ |
| `docker-compose.yml` | Local dev environment          |
| `nginx/`             | Nginx reverse proxy config     |
| `kestra/`            | Governance workflow automation |

## Removed (use `tooling/scripts/deploy/` instead)

- `deploy.sh` → use `tooling/scripts/deploy/deploy-latest-hetzner.sh` (`pnpm deploy:hetzner`)
- `monitor.sh` → use `tooling/scripts/monitoring/` (`pnpm monitor`)

## Active Hetzner Scripts

Refined Hetzner deploy scripts live in `tooling/scripts/deploy/`:

- `build-backend-artifact.sh` — Build for Hetzner
- `deploy-backend-artifact-hetzner.sh` — Deploy to Hetzner
- `rollback-hetzner.sh` — Rollback deployment
- `list-releases-hetzner.sh` — List releases
