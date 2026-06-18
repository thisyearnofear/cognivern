# Deployment Scripts

> **Note**: This directory contains legacy Hetzner configs and the bundle builder.
> Active deploy scripts live in [`scripts/deploy/`](../scripts/deploy/).

## Quick Deploy

```bash
# Primary deploy (build locally, scp tarball to Hetzner)
pnpm deploy:hetzner
```

## What's Here

| File/Dir             | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `docker-compose.yml` | Local dev environment                     |
| `nginx/`             | Nginx reverse proxy config                |
| `kestra/`            | Governance workflow automation            |

## Active Hetzner Scripts (`scripts/deploy/`)

- `build-backend-artifact.sh` — Build for Hetzner
- `deploy-backend-artifact-hetzner.sh` — Deploy to Hetzner
- `rollback-hetzner.sh` — Rollback deployment
- `list-releases-hetzner.sh` — List releases

## Server Setup (One-Time)

- Node.js 20+
- pnpm
- PM2 with pm2-logrotate module
- SSH access for the deploy user

```bash
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Related Docs

- [Operations Guide](../docs/OPS.md)
- [Developer Guide](../docs/DEVELOPER.md)
