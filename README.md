# Cognivern

**SpendOS for agent teams.**

Cognivern is a control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows.

> Move fast without blank checks: every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

[![Powered by ChainGPT AI](https://img.shields.io/badge/Powered%20by-ChainGPT%20AI-7B61FF?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iIzdiNjFGZiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNIQUlOR1BUPC90ZXh0Pjwvc3ZnPg==)](https://chaingpt.org)

**Live:** [Frontend](https://cognivern.vercel.app) · [API](https://cognivern.thisyearnofear.com) · [PromptOS Terminal](https://cognivern.vercel.app/os)

## Submission: Google Cloud "Building Agents for Real-World Challenges"

**Track:** MongoDB &nbsp;·&nbsp; **Model:** Gemini 3.1 Pro (`gemini-3.1-pro-preview`) &nbsp;·&nbsp; **MCP:** `@mongodb-js/mongodb-mcp-server`

The submission is the **Cognivern Copilot** agent under [`agent/`](./agent). It is a Gemini 3.1 agent hosted in Google Cloud Agent Builder that turns a natural-language spend goal into a strictly-governed multi-step mission (PLAN → EVIDENCE → PREVIEW → CONFIRM → EXECUTE → AUDIT), with the MongoDB MCP server powering memory recall, audit history, vendor reputation, and the run ledger.

- Agent runtime &amp; multi-step protocol: [`agent/agent.ts`](./agent/agent.ts)
- System prompt / mission: [`agent/instructions.md`](./agent/instructions.md)
- Agent Builder import spec: [`agent/agent-builder.yaml`](./agent/agent-builder.yaml)
- Judge-facing deployment guide: [`agent/README.md`](./agent/README.md)
- MongoDB seed (judges can poke the data): `pnpm db:seed:reset`
- Smoke test: `pnpm agent:smoke`

See [`docs/HACKATHON.md`](./docs/HACKATHON.md) for the full submission checklist and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the system design.

The Copilot console on the live demo is a closed loop, not a single shot: every confirmed or denied mission is persisted to SQLite and surfaces in a recent-decisions rail, where the operator can replay the full event timeline (with play/pause/scrub), re-run with the same goal, or jump straight to the policy that drove the confirmation. See [`src/frontend/src/components/copilot/copilot-page.tsx`](./src/frontend/src/components/copilot/copilot-page.tsx) for the page and [`src/backend/modules/api/controllers/CopilotController.ts`](./src/backend/modules/api/controllers/CopilotController.ts) for the controller.

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

| Capability                   | Endpoint                        |
| ---------------------------- | ------------------------------- |
| Policy evaluation            | `POST /api/governance/evaluate` |
| Governed spend               | `POST /api/spend`               |
| Governed encrypted spend     | `POST /api/spend/encrypted`     |
| Spend preview (dry-run)      | `POST /api/spend/preview`       |
| OWS wallet bootstrap         | `POST /api/ows/bootstrap`       |
| API-key issuance             | `POST /api/ows/api-keys`        |
| Audit trail                  | `GET /api/audit/logs`           |
| Audit permits (confidential) | `POST /api/audit/permits`       |
| Run ledger                   | `GET /api/cre/runs`             |
| Run ingestion                | `POST /ingest/runs`             |
| Natural language intent      | `POST /api/intent`              |
| Intent metrics               | `GET /api/intent/metrics`       |
| Agent memory store           | `MongoDbMemoryService`          |
| Agent memory query           | `MongoDbMemoryService.query()`  |
| Native Sapience agent        | `SapienceTradingAgent.runCycleWithGovernance()` |
| Native user agent            | `UserTradingAgent.executeTrade()` (routed through governance) |
| **In-process governance client** | `GovernanceClient` (`src/backend/services/GovernanceClient.ts`) |

### Product Primitives

- **Policy:** enforce who/what/when rules before spend executes.
- **Privacy:** evaluate sensitive policy context via confidential policy paths (`Fhenix` adapter).
- **Efficiency:** establish one governance layer for AI operations spend (model/runtime usage visibility and optimization workflows) alongside financial spend controls.
- **Audit:** persist decision evidence (`decisionId`, attestation, run context) for continuous accountability.

## Demo

```bash
# Terminal 1 — start the server
pnpm start

# Terminal 2 — standard spend flow
pnpm demo:live

# Terminal 2 — Fhenix encrypted spend flow (requires Fhenix testnet credentials)
pnpm demo:fhenix
```

## Documentation

| Doc                                                    | Covers                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [Hackathon Brief](./docs/HACKATHON.md)                 | Demo story, submission, talk track                                                 |
| [Architecture](./docs/ARCHITECTURE.md)                 | System design, data flows, endpoints                                               |
| [Developer Guide](./docs/DEVELOPER.md)                 | Local setup, APIs, testing, production readiness                                   |
| [Deployment](./docs/DEPLOYMENT.md)                     | Production deployment, PM2, rollbacks                                              |
| [Fhenix Integration](./docs/FHENIX_INTEGRATION.md)     | Privacy-by-Design plan: encrypted budgets, sealed approvals, FHE policy evaluation |
| [ChainGPT Integration](./docs/CHAINGPT_INTEGRATION.md) | Web3-native AI governance: ChainGPT LLM + Smart Contract Auditor integration       |

## Network Roles

Each partner network plays a specific role in the product. This is the canonical reference — all docs and UI descriptions use this framing.

| Partner | Role in product | User-visible? | Status |
|---|---|---|---|
| **Fhenix** | Confidential policy evaluation via FHE. Budgets, limits, and spend counters remain encrypted throughout evaluation. | Yes — FHE shield badge on audit decisions | **Live** (Fhenix testnet: Arbitrum Sepolia / Base Sepolia) |
| **X Layer** | Governed execution dispatch path. After policy evaluation, approved spends are dispatched here for execution and public anchoring. | Yes — in decision audit trail via Hyperlane | Testnet (chainId 1952) |
| **Filecoin** | Durable evidence anchoring for audit logs. Long-term immutable storage of governance decisions and evidence hashes. | Yes — evidence link per decision in audit entry | Calibration testnet |
| **0G** | Real-time governance decision anchoring alongside Filecoin. Stores `zeroGRootHash` in `CreRun.evidence` for dual-anchor integrity. | Transparently layered with Filecoin | **Live** — via `ZeroGStorageService` (0G Newton testnet) |
| **ChainGPT** | Web3-specialized LLM for smart contract auditing at runtime (pre-spend vulnerability scan) and governance-copilot queries. | Yes — Contract Audit badge on policy checks with ChainGPT metadata | **Live** — via `ChainGPTAuditService` |
| **Ledger DMK** | Hardware signing provider for high-value transactions. User confirms on physical Ledger before any signature is produced. | Yes — "Hardware Signed" badge on audit decisions | **Live** |
| **MongoDB** | Persistent agent memory & run ledger. Replaces JSONL files with queryable, durable storage via MongoDB Atlas. | Yes — powers agent recall and run history APIs | **Live** (optional, gated by `MONGODB_URI`) |
| **Sapience** | Native prediction-market agent. Forecasts on Sapience GraphQL, publishes EAS attestations on Arbitrum, trades USDe on the Ethereal prediction market. **All actions routed through Cognivern's own governance pipeline** (see [`docs/NATIVE_AGENTS.md`](./NATIVE_AGENTS.md)). | Yes — agent status and decision history in the dashboard | **Live** (gated by `SAPIENCE_ENABLED=true`; trades governed by `sapience-trading-policy`) |

## AI Provider Stack

Cognivern uses multi-provider AI routing for governance analysis:

| Provider     | Use Case                                                  | Status     |
| ------------ | --------------------------------------------------------- | ---------- |
| **ChainGPT** | Web3-specific governance queries, smart contract analysis | ✅ Primary |
| Fireworks    | Cost-efficient general analysis                           | ✅ Active  |
| Kilocode     | Free fallback                                             | ✅ Active  |
| Workers AI   | Cloudflare native                                         | ✅ Active  |
| OpenAI       | High quality                                              | ✅ Active  |
| Gemini       | Advanced reasoning                                        | ✅ Active  |
| Anthropic    | Alternative model                                         | ✅ Active  |

## Status

The spend control plane is live: policy evaluation, signed approvals, held actions, denials, and persisted run evidence. Contracts deployed on Arbitrum Sepolia (`GovernanceContract`, `GovernedVault`, and `ConfidentialSpendPolicy` with the new coFHE FHE plugin), X Layer testnet, Mantle Sepolia, and Filecoin Calibration. Live FHE: coFHE services (`testnet-cofhe.fhenix.zone`) and the live TaskManager proxy on Arbitrum Sepolia are responsive; encryption and policy registration are verified end-to-end on the public testnet via `scripts/test-fhe-onchain.ts` — see `docs/FHENIX_INTEGRATION.md` for the full status.

### Recent Updates (2026-06)

- **Production Hardening** — Per-workspace and per-API-key rate limiters with sliding windows, deep health checks, circuit-breaker patterns, 181 backend tests + Playwright E2E (unit + integration + E2E), TypeScript strict mode, unified CI pipeline
- **Multi-Workspace & Policy Versioning** — Workspace-scoped policy management with independent API keys, rate limits, and policy history per team
- **Fhenix Wave 5-7** — Full institutional demo with encrypted policies, MEV-protected execution, selective auditor disclosure; testnet migration from Helium to Arbitrum Sepolia; two-phase FHE resolution with `resolveDecision`; sealed-bid vendor selection; Privara confidential payroll
- **Operator UX** — PromptOS terminal integrated into sidebar, voice input via MediaRecorder (browser-native STT), self-service onboarding, animated workspace mode toggles, full mobile responsiveness
- **ChainGPT Integration** — Web3-native AI governance: ChainGPT Web3 LLM as primary provider with governance context injection, Smart Contract Auditor as runtime pre-spend defense
- **Ledger Hardware Signing** — Full DMK-based hardware signing with Speculos sandbox. All 5 phases complete: provider dispatch, LedgerSigningProvider (USB + emulated fallback), Docker sandbox, frontend badge, AGENTS.md
- **MongoDB Persistence** — Optional MongoDB-backed run ledger, agent memory, and policies via `MongoDbCreRunPersistence` + `MongoDbMemoryService` + `MongoDbPolicyPersistence`. All gated by `MONGODB_URI`
- **Recall Network Cleanup** — Removed broken `RecallService` that called nonexistent API endpoints. 550 lines of dead code deleted, 14 files modified, circuit breaker stripped
- **UI Polish** — aria-labels on all color-only status indicators, keyboard-navigable agent cards, loading skeletons for `/audit` and `/policies` routes
- **Circuit Breaker Consolidation** — Removed dead `withCircuitBreaker` (104 lines) from BaseService, refactored `IntentController` inline breaker to use canonical `CircuitBreaker` class. All circuit protection now flows through `src/backend/shared/utils/circuitBreaker.ts`
- **Logging Consolidation** — `src/backend/utils/logger.ts` now re-exports from `src/backend/shared/logging/Logger.ts`. Single winston logger under the hood, zero import changes across 32 consuming files
- **Policy Persistence** — Extracted `PolicyPersistence` interface with `InMemoryPolicyPersistence` and `MongoDbPolicyPersistence` backends. PolicyService delegates to injected backend (8 unit tests)

### Production Readiness

See [Developer Guide](./docs/DEVELOPER.md) for the full production readiness checklist.

## License

MIT
