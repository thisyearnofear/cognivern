# Cognivern

**SpendOS for agent teams.**

Control plane for agent operations: governed wallet spend + AI spend governance across IDE, CLI, and agent workflows. Every spend is policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

**Live:** [Frontend](https://cognivern.vercel.app) · [API](https://cognivern.thisyearnofear.com) · [PromptOS Terminal](https://cognivern.vercel.app/os)

## Key Features

- **Policy enforcement** — Deny / hold / approve before spend based on budget, vendor, chain, risk.
- **Confidential policy evaluation** — FHE on Fhenix so budgets and limits stay encrypted end-to-end.
- **Confidential vendor selection** — Sealed-bid RFP auctions on Canton / Daml with structural sub-transaction privacy and atomic multi-party reveal — see [Canton docs](./docs/CANTON.md).
- **Hardware signing** — Ledger DMK for high-value transactions with physical confirmation.
- **Audit trail** — Every decision persisted with evidence, Filecoin + 0G dual-anchor.
- **AI safety monitoring** — Multi-dimensional suspicion scoring — see [report](./scripts/hackathon/HACKATHON_REPORT.md).

## Quick Start

```bash
pnpm install
pnpm build
pnpm start
```

Minimum `.env`:

```env
API_KEY=your-api-key-here
OWS_VAULT_SECRET=your-vault-secret
CHAINGPT_API_KEY=your-chain-gpt-key   # Optional: Web3 LLM + audit
```

For local setup, API reference, and production deployment, see the [Developer Guide](./docs/DEVELOPER.md).

## Verification

31+ Vitest unit/integration tests plus 21 TestSprite CLI backend tests run against the live API (`testsprite test run --all --project 8be1ec9e-a2c5-484a-8a2e-422b87832028`). Privacy invariants on Canton sealed-bid are asserted by direct ledger queries per party role. CI runs the TestSprite suite on every PR and push via `.github/workflows/testsprite.yml`. The [LOOP](./LOOP.md) documents the write-verify-fix iteration history.

## Documentation

| Doc | What's in it |
|-----|--------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, data flows, Fhenix / Canton / ChainGPT / Ledger integrations |
| [Canton](./docs/CANTON.md) | Daml sealed-bid model, hydration, sandbox + DevNet runbooks |
| [Developer Guide](./docs/DEVELOPER.md) | Local setup, API reference, testing, production readiness |
| [Deployment](./docs/DEPLOYMENT.md) | Hetzner / PM2 / nginx, env vars, health checks |
| [AI Safety](./scripts/hackathon/HACKATHON_REPORT.md) | Suspicion-scoring design, frontier evaluation |
| [Hackathon Submission](./HACKATHON_SUBMISSION.md) | Track 1: Canton private RFP — enterprise framing, DevNet proof pack |

## License

MIT
