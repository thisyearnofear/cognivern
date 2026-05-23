# ⚠️ Hetzner Deployment (Deprecated)

This directory contains legacy Hetzner deployment configuration. The primary deployment is now via **Vercel** (see root `vercel.json`).

## What's Here

| File/Dir | Purpose |
|----------|---------|
| `docker-compose.yml` | Local dev environment (still useful) |
| `nginx/` | Nginx reverse proxy config (still useful) |
| `kestra/` | Governance workflow automation |
| `deploy.sh` | Legacy Hetzner deploy script |
| `monitor.sh` | Legacy Hetzner monitoring |

## Active Deployment

- **Frontend**: Vercel (configured in root `vercel.json`)
- **Backend API**: Vercel Serverless Functions or Hetzner (see `scripts/deploy/`)

## If Using Hetzner

The refined Hetzner deploy scripts are in `scripts/deploy/`:
- `build-backend-artifact.sh` - Build for Hetzner
- `deploy-backend-artifact-hetzner.sh` - Deploy to Hetzner
- `rollback-hetzner.sh` - Rollback deployment

## Docker Compose

Still useful for local development:
```bash
docker-compose -f deploy/docker-compose.yml up -d
```