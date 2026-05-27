# Deprecated: Hetzner Deployment

This directory contains legacy Hetzner deployment configuration. The primary deployment is now via **Vercel** (see root `vercel.json`).

## Still Useful

| File/Dir             | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `build-bundle.mjs`   | Bundle builder (`pnpm deploy:bundle`)     |
| `deploy-lean.sh`     | Lean Hetzner deploy (`pnpm deploy:lean`)  |
| `docker-compose.yml` | Local dev environment                     |
| `nginx/`             | Nginx reverse proxy config                |
| `kestra/`            | Governance workflow automation            |

## Removed (use `scripts/deploy/` instead)

- `deploy.sh` → use `scripts/deploy.sh` (`pnpm deploy`)
- `monitor.sh` → use `scripts/monitoring/` (`pnpm monitor`)

## Active Hetzner Scripts

Refined Hetzner deploy scripts live in `scripts/deploy/`:

- `build-backend-artifact.sh` — Build for Hetzner
- `deploy-backend-artifact-hetzner.sh` — Deploy to Hetzner
- `rollback-hetzner.sh` — Rollback deployment
- `list-releases-hetzner.sh` — List releases
