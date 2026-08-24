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
  (installs with `pnpm install --prod --frozen-lockfile` when a lockfile ships)
- `regen-backend-lockfile.sh` — Regenerate `ops/deploy/pnpm-lock.backend.yaml`
  after **any** edit to `ops/deploy/package.backend.json` (frozen installs fail
  loudly if the manifest drifts from the lockfile)

## Dependency discipline

- `package.backend.json` is the production dependency manifest. Prune it
  against real usage (`rg --fixed-strings '"<pkg>"' dist`) before adding
  anything; the server installs it directly.
- `pnpm-lock.backend.yaml` is the committed lockfile for that manifest.
  Regenerate with `regen-backend-lockfile.sh` after manifest changes.
- `pnpm audit --prod` against this manifest is the security bar: currently zero
  advisories; the `pnpm.overrides` block documents the protected transitive
  deps (axios via `open-jsonrpc-provider`, ws, uuid).
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
