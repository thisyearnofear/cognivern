# Cognivern

**SpendOS for agent teams.**

Cognivern is a control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows.

> Move fast without blank checks: every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

[![Powered by ChainGPT AI](https://img.shields.io/badge/Powered%20by-ChainGPT%20AI-7B61FF?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iIzdiNjFGZiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNIQUlOR1BUPC90ZXh0Pjwvc3ZnPg==)](https://chaingpt.org)

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
CHAINGPT_API_KEY=your-chaingpt-api-key  # Optional: Web3 LLM + Smart Contract Auditor
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
| Natural language intent | `POST /api/intent` |
| Intent metrics | `GET /api/intent/metrics` |

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
| [ChainGPT Integration](./docs/CHAINGPT_INTEGRATION.md) | Web3-native AI governance: ChainGPT LLM + Smart Contract Auditor integration |

## Multi-Chain Deployment

| Layer | Chain | Contracts |
|-------|-------|-----------|
| Execution & Policy | X Layer Testnet (chainId 1952) | GovernanceContract `0x755602bB...`, AIGovernanceStorage `0x1E0317bF...` |
| Audit Storage | Filecoin Calibration | GovernanceContract + AIGovernanceStorage |
| Confidential Policy State (LIVE) | Fhenix (Sepolia / Arbitrum Sepolia / Base Sepolia) | `ConfidentialSpendPolicy` + full-stack FHE policy evaluation & authorized decryption — see [Fhenix Integration](./docs/FHENIX_INTEGRATION.md) |
| **Web3 AI Governance** | **ChainGPT** | **Web3 LLM for governance intent + Smart Contract Auditor for runtime defense — see [ChainGPT Integration](./docs/CHAINGPT_INTEGRATION.md)** |

## AI Provider Stack

Cognivern uses multi-provider AI routing for governance analysis:

| Provider | Use Case | Status |
|----------|----------|--------|
| **ChainGPT** | Web3-specific governance queries, smart contract analysis | ✅ Primary |
| Fireworks | Cost-efficient general analysis | ✅ Active |
| Kilocode | Free fallback | ✅ Active |
| Workers AI | Cloudflare native | ✅ Active |
| OpenAI | High quality | ✅ Active |
| Gemini | Advanced reasoning | ✅ Active |
| Anthropic | Alternative model | ✅ Active |

## Status

The spend control plane is live: policy evaluation, signed approvals, held actions, denials, and persisted run evidence. Contracts deployed on X Layer testnet and Filecoin Calibration. Fhenix integration live for privacy-native operations.

### Recent Updates (2026-05)

- **ChainGPT Integration** — Added Web3-native AI governance: ChainGPT Web3 LLM as primary provider with governance context injection, Smart Contract Auditor as runtime pre-spend defense (contract_audit policy rule)
- **AI Intent System** — Natural language command processing via multi-provider AI routing (7 providers: ChainGPT, Fireworks, Kilocode, Workers AI, OpenAI, Gemini, Anthropic) with circuit breaker protection and graceful fallback
- **Compact UI** — Reduced visual density across dashboard, cards, and navigation with smooth transitions
- **Responsive Improvements** — Better mobile/tablet layouts with minimal agent display variants

### Production Readiness: ~93%

See [Developer Guide](./docs/DEVELOPER.md) for full checklist.

## License

MIT
