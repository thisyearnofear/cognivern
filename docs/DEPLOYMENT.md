# Deployment

This repo uses a **backend artifact + releases** deployment model.

## Why
- Keeps production servers as **runtime environments** (no TypeScript builds required).
- Enables fast, safe rollbacks.
- Avoids installing frontend dependencies on the backend server.

---

## Architecture

### Data Plane / Control Plane
- Data plane ingestion: `POST /ingest/runs`
- Control plane APIs: `/api/*`

### Server Layout (Hetzner)

#### Secrets handling
- Secrets live in: `/opt/cognivern/shared/.env` (server-local)
- PM2 runs via: `/opt/cognivern/shared/run.sh` which sources `shared/.env`
- **Do not** put secrets into `config/ecosystem.config.cjs` (commit-safe config only)

```
/opt/cognivern/
  releases/
    <release-id>/
      dist/
      node_modules/        # prod deps only
      .env -> ../shared/.env
      data -> ../shared/data
      logs -> ../shared/logs
  current -> releases/<release-id>
  shared/
    .env
    data/
    logs/
  config/
    ecosystem.config.cjs   # PM2 config (NO SECRETS ideally)
```

**Rule:** application must run from `/opt/cognivern/current`.

---

## Local developer workflow

### Build backend artifact

```bash
bash scripts/deploy/build-backend-artifact.sh
```

This creates a tarball under `.artifacts/` containing the minimal runtime payload:
- `dist/`
- `package.json`, `pnpm-lock.yaml`
- `config/` (runtime config)

### Deploy to Hetzner

```bash
bash scripts/deploy/deploy-backend-artifact-hetzner.sh
```

The deploy script:
- uploads the tarball to `/opt/cognivern/releases/`
- installs **prod dependencies only** inside the release
- links shared state (`shared/.env`, `shared/data`, `shared/logs`)
- updates `/opt/cognivern/current`
- restarts PM2
- runs a health check

### List releases

```bash
bash scripts/deploy/list-releases-hetzner.sh
```

### Rollback

```bash
bash scripts/deploy/rollback-hetzner.sh <release-dir-name>
```

---

## Secrets policy (IMPORTANT)

### Do NOT commit
- `.env`, `.env.production`, any private keys, API keys, ingest keys
- PM2 ecosystem files containing secrets

### Safe to commit
- deployment scripts that do not embed secrets
- deployment docs
- `.env.example` with placeholders

### Where secrets live
- `/opt/cognivern/shared/.env` on the server (not in git)

---

## Notes

- If you need to run background agents/trading loops, set `AGENTS_ENABLED=true`.
  - Default should remain `false` for an ingestion-first product.
