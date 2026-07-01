# Cognivern

**SpendOS for agent teams.**

Cognivern is a control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows. Every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

**Live:** [Frontend](https://cognivern.vercel.app) · [API](https://cognivern.thisyearnofear.com) · [PromptOS Terminal](https://cognivern.vercel.app/os)

## TestSprite Verification Loop

This project uses [TestSprite CLI](https://github.com/TestSprite/testsprite-cli) as the checker in a write → verify → fix loop. The agent ships code, the CLI runs real tests against the live API, and failures drive fixes.

- **Test suite:** 4 backend tests covering health/public endpoints, governance policy access, spend endpoints, and audit trail integrity
- **Loop log:** [LOOP.md](./LOOP.md) — agent-written, one line per iteration
- **CI/CD:** Wired into GitHub Actions (`.github/workflows/testsprite.yml`) — every PR runs the full suite, fails the build on regressions
- **Dashboard:** [TestSprite project](https://www.testsprite.com/dashboard/tests/ad5aa683-dbc5-4484-8236-e4a3aef914ee)

### Bugs caught by the loop

1. `/api/governance/policies` returned 401 despite being a public endpoint — controller required `workspaceId` with no fallback
2. `better-sqlite3` native bindings missing after deploy — `pnpm install --prod` didn't rebuild native modules
3. `/api/spendos/status` in `PUBLIC_API_PATHS` but no route handler exists — 404

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
| [Deployment](./docs/DEPLOYMENT.md) | Deploy to Hetzner, PM2, nginx, env vars, health checks |
| [AI Safety Report](./scripts/hackathon/HACKATHON_REPORT.md) | Multi-dimensional suspicion scorer design, failure mode analysis, and cost-performance frontier evaluation |

## License

MIT
