# Cognivern

**SpendOS for agent wallets.**

Cognivern is a control plane for OWS wallets: budgets, policy checks, approvals, and audit for autonomous agents.

> Give agents wallets without giving them blank checks.

## Quick Start

```bash
pnpm install
pnpm build
pnpm start
```

Minimum `.env`:

```env
API_KEY=development-api-key
OWS_VAULT_SECRET=development-ows-vault-secret
```

See [Developer Guide](./docs/DEVELOPER.md) for full setup and API reference.

## What It Does

| Capability | Endpoint |
|------------|----------|
| Policy evaluation | `POST /api/governance/evaluate` |
| Governed spend | `POST /api/spend` |
| Spend preview (dry-run) | `POST /api/spend/preview` |
| OWS wallet bootstrap | `POST /api/ows/bootstrap` |
| API-key issuance | `POST /api/ows/api-keys` |
| Audit trail | `GET /api/audit/logs` |
| Run ledger | `GET /api/cre/runs` |
| Run ingestion | `POST /ingest/runs` |

## Demo

```bash
# Terminal 1
pnpm start

# Terminal 2
pnpm demo:live
```

## Documentation

| Doc | Covers |
|-----|--------|
| [Hackathon Brief](./docs/HACKATHON.md) | Demo story, submission, talk track |
| [Architecture](./docs/ARCHITECTURE.md) | System design, data flows, endpoints |
| [Developer Guide](./docs/DEVELOPER.md) | Local setup, APIs, testing, production readiness |
| [Deployment](./docs/DEPLOYMENT.md) | Production deployment, PM2, rollbacks |

## Status

The spend control plane is live: policy evaluation, signed approvals, held actions, denials, and persisted run evidence.

## License

MIT
