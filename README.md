# Cognivern

**SpendOS for agent teams.**

Cognivern is a control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows. Every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

**Live:** [Frontend](https://cognivern.vercel.app) · [API](https://cognivern.thisyearnofear.com) · [PromptOS Terminal](https://cognivern.vercel.app/os)

## TestSprite Verification Loop

This project uses [TestSprite CLI](https://github.com/TestSprite/testsprite-cli) as the checker in a write → verify → fix loop. The agent ships code, the CLI runs real tests against the live API, and failures drive fixes.

- **Test suite:** 20 backend tests, 550 assertions, all passing — covering auth, health, metrics, FHE, intent, projects, sealed-bid auctions, MCP governance, agents, OWS, copilot, speech, spend (deep SpendOS), governance CRUD, market data, dashboard, workspace management, API keys, audit, webhooks, payroll, and ingest
- **Loop log:** [LOOP.md](./LOOP.md) — agent-written, one line per iteration
- **CI/CD:** Wired into GitHub Actions (`.github/workflows/testsprite.yml`) — every PR runs the full suite, fails the build on regressions
- **Dashboard:** [TestSprite project](https://www.testsprite.com/dashboard/tests/ad5aa683-dbc5-4484-8236-e4a3aef914ee)
- **Submission:** [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md) — comprehensive hackathon summary

### Bugs caught by the loop (12 total)

1. `/api/governance/policies` returned 401 despite being a public endpoint — controller required `workspaceId` with no fallback
2. `better-sqlite3` native bindings missing after deploy — `pnpm install --prod` didn't rebuild native modules
3. `/api/spendos/status` in `PUBLIC_API_PATHS` but no route handler exists — 404
4. Auth endpoints (`/auth/register`, `/auth/login`, `/auth/nonce`) blocked by `apiKeyMiddleware` — not in `PUBLIC_API_PATHS`
5. Users table missing `email` column — inline migration had old schema with only `wallet_address`
6. `wallet_address NOT NULL` constraint prevented email-based registration
7. `/fhenix/encrypt`, `/metrics/ux-events`, `/mcp/governance-check`, `/speech/transcribe` missing from `PUBLIC_API_PATHS`
8. Sealed-bid sub-paths (`/rounds/:roundId/bid`, `/close`, `/reveal`) not in `PUBLIC_API_PATHS` — added parameterized path matching
9. Projects sub-paths (`/:projectId/usage`, `/:projectId/tokens`) not in `PUBLIC_API_PATHS`
10. `/api/agents/sapience/status` returned 500 — "sapience" missing from `demoAgentNames` map
11. `/api/cre/projects` returned 404 — route defined as `/projects` not `/cre/projects`
12. `OwsWalletController.createAgent` and `OwsApiKeyController.createApiKey` threw errors without try/catch, crashing the server

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
| [Hackathon Submission](./HACKATHON_SUBMISSION.md) | Comprehensive submission: test suite, 16 bugs found/fixed, architecture, integrations |

## License

MIT
