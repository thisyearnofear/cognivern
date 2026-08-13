# Deployment Scripts

> **Note**: This directory contains legacy Hetzner configs and the bundle builder.
> Active deploy scripts live in [`tooling/scripts/deploy/`](../../tooling/scripts/deploy/).

## Quick Deploy

```bash
# Build locally, upload an immutable release, and activate it atomically
pnpm deploy:hetzner

# Inspect retained releases or roll back without rebuilding
pnpm deploy:releases
pnpm deploy:rollback
```

## What's Here

| File/Dir             | Purpose                        |
| -------------------- | ------------------------------ |
| `docker-compose.yml` | Local dev environment          |
| `nginx/`             | Nginx reverse proxy config     |
| `kestra/`            | Governance workflow automation |

## Active Hetzner Scripts (`tooling/scripts/deploy/`)

- `build-backend-artifact.sh` — Build a versioned backend artifact locally
- `deploy-backend-artifact-hetzner.sh` — Validate and atomically activate an immutable release
- `rollback-hetzner.sh` — Health-gated application rollback
- `list-releases-hetzner.sh` — Show the active and retained releases

The active path `/opt/cognivern/app` is a stable symlink to
`/opt/cognivern/releases/<release-id>`. Environment, SQLite data, and logs stay
under `/opt/cognivern/shared/`; rollback never rewinds ledger or database state.

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

- [Operations Guide](../../docs/OPS.md)
- [Developer Guide](../../docs/DEV.md)
