# Cognivern

**SpendOS for agent teams.**

Cognivern is a control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows.

> Move fast without blank checks: every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

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

Cognivern solves a common agentic scaling problem: teams can ship quickly, but spend control, privacy, and accountability often fragment across tools. The platform unifies those rails so operators can prove disciplined execution without slowing builders down.

| Capability | Endpoint |
|------------|----------|
| Policy evaluation | `POST /api/governance/evaluate` |
| Governed spend | `POST /api/spend` |
| Governed encrypted spend | `POST /api/spend/encrypted` |
| Spend preview (dry-run) | `POST /api/spend/preview` |
| OWS wallet bootstrap | `POST /api/ows/bootstrap` |
| API-key issuance | `POST /api/ows/api-keys` |
| Audit trail | `GET /api/audit/logs` |
| Audit permits (confidential) | `POST /api/audit/permits` |
| Run ledger | `GET /api/cre/runs` |
| Run ingestion | `POST /ingest/runs` |

### Product Primitives

- **Policy:** enforce who/what/when rules before spend executes.
- **Privacy:** evaluate sensitive policy context via confidential policy paths (`Fhenix` adapter).
- **Efficiency:** establish one governance layer for AI operations spend (model/runtime usage visibility and optimization workflows) alongside financial spend controls.
- **Audit:** persist decision evidence (`decisionId`, attestation, run context) for continuous accountability.

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
| [Fhenix Integration](./docs/FHENIX_INTEGRATION.md) | Privacy-by-Design plan: encrypted budgets, sealed approvals, FHE policy evaluation |

## Multi-Chain Deployment

| Layer | Chain | Contracts |
|-------|-------|-----------|
| Execution & Policy | X Layer Testnet (chainId 1952) | GovernanceContract `0x755602bB...`, AIGovernanceStorage `0x1E0317bF...` |
| Audit Storage | Filecoin Calibration | GovernanceContract + AIGovernanceStorage |
| Confidential Policy State (LIVE) | Fhenix (Sepolia / Arbitrum Sepolia / Base Sepolia) | `ConfidentialSpendPolicy` + full-stack FHE policy evaluation & authorized decryption — see [Fhenix Integration](./docs/FHENIX_INTEGRATION.md) |

## Status

The spend control plane is live: policy evaluation, signed approvals, held actions, denials, and persisted run evidence. Contracts deployed on X Layer testnet and Filecoin Calibration. Fhenix integration live for privacy-native operations.

## License

MIT
