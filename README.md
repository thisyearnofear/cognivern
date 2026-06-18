# Cognivern

**SpendOS for agent teams.**

Cognivern is a control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows. Every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

**Live:** [Frontend](https://cognivern.vercel.app) · [API](https://cognivern.thisyearnofear.com) · [PromptOS Terminal](https://cognivern.vercel.app/os)

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

For full setup, testing, and production deployment details see the [Developer Guide](./docs/DEVELOPER.md).

## Key Features

- **Policy enforcement** — Define who/what/when rules before spend executes. Deny, hold, or approve based on budget, vendor, chain, and risk.
- **Confidential policy evaluation** — Budgets and limits evaluated via FHE so agents can't see their own caps. Powered by Fhenix.
- **Hardware signing** — Ledger DMK support for high-value transactions with physical confirmation.
- **Audit trail** — Every decision persisted with evidence hashes, on-chain anchoring, and replayable event timelines.
- **AI safety monitoring** — Multi-dimensional suspicion scoring across rule violations, behavioral deviation, temporal anomaly, scope creep, and sabotage patterns. See the [AI Safety Report](./scripts/hackathon/HACKATHON_REPORT.md).

## Documentation

| Doc | What's in it |
|-----|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, data flows, network roles, Fhenix/ChainGPT/Ledger integrations, native agents |
| [Developer Guide](./docs/DEVELOPER.md) | Getting started (no-code), local setup, API reference, testing, production readiness |
| [Operations](./docs/OPS.md) | Deployment, PM2, nginx, incident response playbooks, rollback procedures |
| [AI Safety Report](./scripts/hackathon/HACKATHON_REPORT.md) | Multi-dimensional suspicion scorer design, failure mode analysis, and cost-performance frontier evaluation |

## License

MIT
