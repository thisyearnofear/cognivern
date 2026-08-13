# Deprecated: Hetzner Deployment

This directory contains legacy Hetzner configuration. The frontend deploys via **Vercel** (see root `vercel.json`); the backend uses the active artifact/release workflow in `tooling/scripts/deploy/`.

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

- `build-backend-artifact.sh` — Build a versioned backend artifact locally
- `deploy-backend-artifact-hetzner.sh` — Validate and atomically activate an immutable release
- `rollback-hetzner.sh` — Health-gated application rollback
- `list-releases-hetzner.sh` — Show the active and retained releases

Use the active scripts and read `docs/DEPLOYMENT.md` before any production
operation; do not restore the removed in-place deploy scripts.
