# Self-host Cognivern (one command)

Template for running Cognivern locally in Docker: API + dashboard +
OTLP→Jaeger telemetry + a seeded demo mandate. This is **M2** from
[`docs/LANGFUSE_LESSONS.md`](../../docs/LANGFUSE_LESSONS.md) — OSS
distribution, not a replacement for the Hetzner/Vercel production path.

## Quick start

Requirements: Docker Desktop / Engine with Compose v2, ~4 GB free RAM for
the first image build.

```bash
cd deploy/self-host
cp .env.example .env
# edit JWT_SECRET and OWS_VAULT_SECRET before any shared use
docker compose --env-file .env up --build
```

Then open:

| Surface | URL |
|---------|-----|
| Dashboard | http://localhost:8080 |
| API health | http://localhost:3001/health |
| Public SLO snapshot (p50/p95/p99) | http://localhost:3001/health/slo |
| Jaeger (traces) | http://localhost:16686 |

Stop with `docker compose down`. Data persists in the `cognivern-data`
volume (`DB_PATH=/app/data/cognivern.db`).

## What is included

- **backend** — lean esbuild bundle (`ops/deploy/build-bundle.mjs`) + native
  deps (`better-sqlite3`, …). Seeds a demo workspace/mandate when
  `SEED_DEMO=true`.
- **frontend** — Next.js with `COGNIVERN_SELFHOST=1` → `output: "standalone"`.
  Browser calls stay same-origin (`/api/...`); rewrites target
  `http://backend:3001` inside the compose network.
- **otel-collector + jaeger** — queryable local traces without a full
  SignOz/ClickHouse stack. Point `OTEL_EXPORTER_OTLP_ENDPOINT` is already set
  on the backend.

Rails (Canton, Fhenix, Filecoin, HydraDB, …) stay off by default. Add keys
to `.env` and the backend service when you want them.

## Notes

- First build compiles the monorepo and can take several minutes; rebuilds
  are cached.
- Do **not** use the demo secrets from `.env.example` on a public host.
- Legacy `ops/deploy/docker-compose.yml` is Recall-era and is not this
  template — see `ops/deploy/DEPRECATED.md`.
License remains MIT; no planned licensing change for self-host.

## Production note

When Vercel Functions / Deployment storage quotas bind, prefer serving this
same Next standalone + API pattern on the VPS (nginx) instead of Vercel.
See `docs/DEPLOYMENT.md` and `docs/CAPITAL_AGENT_SURFACES.md`.
