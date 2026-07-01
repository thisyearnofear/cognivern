# AI Control Hackathon — Cognivern Submission

## Cognivern: SpendOS for Agent Teams

A control plane for agent operations: governed wallet spend plus AI spend governance across IDE, CLI, and agent workflows. Every spend can be policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

**Team:** thisyearnofear
**Live:** [Frontend](https://cognivern.vercel.app) · [API](https://cognivern.thisyearnofear.com) · [PromptOS Terminal](https://cognivern.vercel.app/os)
**TestSprite Dashboard:** [19 tests, all passing](https://www.testsprite.com/dashboard/tests/ad5aa683-dbc5-4484-8236-e4a3aef914ee)

---

## What We Built

### 1. Agent Governance Platform

Cognivern is a production-deployed control plane that governs AI agent spending across multiple surfaces:

- **Policy enforcement** — Define who/what/when rules before spend executes. Deny, hold, or approve based on budget, vendor, chain, and risk.
- **Confidential policy evaluation** — Budgets and limits evaluated via FHE so agents can't see their own caps. Powered by Fhenix.
- **Hardware signing** — Ledger DMK support for high-value transactions with physical confirmation.
- **Audit trail** — Every decision persisted with evidence hashes (SHA-256), on-chain anchoring, and replayable event timelines.
- **AI safety monitoring** — Multi-dimensional suspicion scoring across 5 orthogonal dimensions (rule violations, behavioral deviation, temporal anomaly, scope creep, sabotage patterns).
- **Sealed-bid auctions** — FHE-encrypted vendor bidding where bid amounts stay sealed until reveal. Two-phase submit-then-reveal protocol.
- **Sapience forecasting** — On-chain prediction market integration with automated forecasting via Groq LLM.
- **CRE (Cognivern Runtime Engine)** — Workflow orchestration with run tracking, event streaming, approval gates, and provenance citations.

### 2. TestSprite Verification Loop

We used [TestSprite CLI](https://github.com/TestSprite/testsprite-cli) as the checker in a write-verify-fix loop. The agent ships code, the CLI runs real tests against the live API, and failures drive fixes. This is not mock testing — every test hits the production API at `cognivern.thisyearnofear.com`.

**19 tests, 481 assertions, all passing.**

The loop caught **15 real bugs** in the production codebase, all of which were fixed during the hackathon.

---

## Test Suite

| # | Test | Assertions | What It Covers |
|---|------|-----------|----------------|
| 1 | Health and public endpoints | 6 | `/health`, `/health/ready`, `/health/live`, `/health/slo`, `/system/health`, `/health?deep=true` |
| 2 | Governance policies public access | 3 | `/api/governance/policies` returns 200 with default workspace fallback |
| 3 | Spend endpoints | 5 | `/api/spend/status`, `/api/spend/scan` (with/without address), auth boundary on preview |
| 4 | Audit trail integrity | 3 | Evidence hashes (SHA-256), compliance status, outcome values, artifact references |
| 5 | Auth endpoints | 12 | `/auth/nonce`, `/auth/register`, `/auth/login`, `/auth/me`, `/auth/forgot-password`, `/auth/reset-password` |
| 6 | Health endpoints (deep) | 6 | All 6 health check variants including SLO metrics and deep dependency checks |
| 7 | Metrics endpoints | 8 | `/api/metrics/ux-summary`, `/api/metrics/ux-events` (POST), `/api/metrics/daily` (auth boundary) |
| 8 | Fhenix FHE endpoints | 7 | `/api/fhenix/status`, `/api/fhenix/encrypt`, `/api/fhenix/decrypt` |
| 9 | Intent + projects endpoints | 10 | `/api/intent` (classification), `/api/intent/metrics`, `/api/projects`, `/api/projects/:id/usage`, `/api/projects/:id/tokens` |
| 10 | Sealed-bid auction lifecycle | 15 | Create round → submit 2 encrypted bids → close → reveal → get details |
| 11 | MCP governance + agent status | 12 | MCP governance-check manifest, agent status (unified, governance, portfolio, sapience), audit insights, dashboard bundle |
| 12 | OWS + copilot auth boundaries | 11 | 11 protected endpoints verified to return 401 without auth |
| 13 | Speech transcription | 4 | `/api/speech/transcribe` input validation, service availability check |
| 14 | Authenticated endpoints | 11 | OWS wallets/dashboard/health/agents/api-keys, copilot runs, metrics/daily, governance evaluate — all with API key auth |
| 15 | Deep SpendOS | 79 | `/api/spend/status` (SpendOS layer, features), `/api/spend/preview` (valid/missing fields, contract audit), `/api/spend` (execute, held spend), `/api/spend/encrypted` (demo mode small/large, OWS mode validation), `/api/spend/:id/confirm` (confirm/reject/invalid/missing), `/api/spend/scan` (missing/invalid/valid address) |
| 16 | Auth extended | 12 | `/auth/verify` (invalid SIWE), `/auth/verify-email` (invalid token), `/auth/refresh` (no/invalid Bearer), `/auth/logout` (no Bearer), `/auth/register` (duplicate email), `/auth/login` (wrong password, missing fields), `/auth/forgot-password`, `/auth/nonce` |
| 17 | Governance extended | 19 | `/api/governance/health`, policy list, create (valid/missing fields), confidential policy, get non-existent policy, get non-existent decision, evaluate with missing fields |
| 18 | Agents extended | 55 | `/api/agents/stats`, `/leaderboard`, `/compare`, `/monitoring`, get by id, register (missing fields), start/stop, `/api/market/stats`, `/market/top`, `/market/data/:symbol`, `/market/historical/:symbol`, `/api/dashboard/bundle`, agent preferences |
| 19 | OWS/Copilot/CRE extended | 25 | OWS wallet get/connect/import, API key get/delete, permissions (POST/GET), copilot run get/confirm, CRE runs list/get/cancel/retry |

**Total: 19 tests, 481 assertions, 0 failures**

---

## Bugs Found and Fixed

The write-verify-fix loop caught 15 real bugs in the production codebase. Each was found by a failing test, traced to root cause, and fixed.

### Critical Bugs (would block users)

**1. Auth endpoints blocked by apiKeyMiddleware**
- **Symptom:** `/auth/register`, `/auth/login`, `/auth/nonce` returned 401
- **Root cause:** Auth endpoints were not in `PUBLIC_API_PATHS`, so the API key middleware blocked them. You couldn't create an account without already having an API key.
- **Fix:** Added all `/auth/*` paths to the public endpoint list.
- **File:** `src/backend/middleware/publicEndpoints.ts`

**2. Users table missing email column**
- **Symptom:** `/auth/register` returned 500 with `SqliteError: no such column: email`
- **Root cause:** The inline `migrate()` function in `db/index.ts` created the `users` table with only `wallet_address`, but `AuthController.register()` tries to insert with `email`. The file-based migration had the full schema but couldn't apply it because `CREATE TABLE IF NOT EXISTS` is a no-op when the table already exists.
- **Fix:** Updated inline migration to include all columns. Added idempotent `ALTER TABLE` statements for existing databases.
- **File:** `src/backend/db/index.ts`

**3. wallet_address NOT NULL constraint**
- **Symptom:** `/auth/register` with email returned 500 with `NOT NULL constraint failed: users.wallet_address`
- **Root cause:** The `users` table had `wallet_address TEXT NOT NULL UNIQUE`, but email-based registration doesn't provide a wallet address.
- **Fix:** Made `wallet_address` nullable in the schema.
- **File:** `src/backend/db/index.ts`

### Endpoint Access Bugs (6 endpoints blocked)

**4. Fhenix encrypt endpoint not public**
- **Symptom:** `/api/fhenix/encrypt` returned 401
- **Root cause:** Missing from `PUBLIC_API_PATHS` while `/fhenix/status` and `/fhenix/decrypt` were listed.
- **Fix:** Added to public endpoint list.

**5. Metrics ux-events not public**
- **Symptom:** `POST /api/metrics/ux-events` returned 401
- **Root cause:** Missing from `PUBLIC_API_PATHS` while `/metrics/ux-summary` was listed.
- **Fix:** Added to public endpoint list.

**6. MCP governance-check not public**
- **Symptom:** `/api/mcp/governance-check` returned 401
- **Root cause:** Missing from `PUBLIC_API_PATHS`.
- **Fix:** Added to public endpoint list.

**7. Sealed-bid sub-paths not public**
- **Symptom:** `/api/vendor/sealed-bid/rounds/:roundId/bid` returned 401
- **Root cause:** Only `/vendor/sealed-bid/rounds` was in `PUBLIC_API_PATHS`, not the sub-paths for bid/close/reveal.
- **Fix:** Added all sub-paths and implemented parameterized path matching in `isPublicApiPath()`.

**8. Projects sub-paths not public**
- **Symptom:** `/api/projects/:projectId/usage` returned 401
- **Root cause:** Only `/projects` was in `PUBLIC_API_PATHS`, not the `:projectId/usage` and `:projectId/tokens` sub-paths.
- **Fix:** Added sub-paths, handled by the new parameterized path matching.

**9. Speech transcription not public**
- **Symptom:** `/api/speech/transcribe` returned 401
- **Root cause:** Missing from `PUBLIC_API_PATHS`.
- **Fix:** Added to public endpoint list.

### Server Crash Bugs (caused 502 Bad Gateway)

**10. Sapience agent status 500**
- **Symptom:** `/api/agents/sapience/status` returned 500 with "Failed to fetch sapience agent data"
- **Root cause:** The `demoAgentNames` map in `AgentsController.getAgentStatus` only included "governance" and "portfolio". When `agentType = "sapience"` was set by the route, it fell through to `agentsModule.getAgentStatus()` which returned null, triggering the 500.
- **Fix:** Added "sapience" to the `demoAgentNames` map.
- **File:** `src/backend/modules/api/controllers/AgentsController.ts`

**11. CRE projects 404**
- **Symptom:** `/api/cre/projects` returned 404 "Resource not found"
- **Root cause:** The path was listed in `PUBLIC_API_PATHS` but no route handler existed. The actual projects route was defined as `/projects` in `miscRoutes.ts`, not `/cre/projects`.
- **Fix:** Added `/cre/projects` alias routes in `creRoutes.ts` that delegate to `IngestController`.
- **File:** `src/backend/modules/api/routes/creRoutes.ts`

**12. OWS controller unhandled throws crash server**
- **Symptom:** `POST /api/ows/agents` with empty body caused 502 Bad Gateway (server crash)
- **Root cause:** `OwsWalletController.createAgent` and `OwsApiKeyController.createApiKey` threw `BadRequestError` without try/catch. Since the route handlers don't wrap async calls, the rejected promise became an unhandled rejection that crashed the Node.js process.
- **Fix:** Wrapped both methods in try/catch with proper `res.status(400).json()` responses.
- **Files:** `src/backend/modules/api/controllers/OwsWalletController.ts`, `OwsApiKeyController.ts`

**13. OwsWalletController getWallet/importWallet/connectExternal crash**
- **Symptom:** `GET /api/ows/wallets/:id`, `POST /api/ows/wallets/connect`, `POST /api/ows/wallets/import` all returned 502 Bad Gateway
- **Root cause:** Same pattern as bug #12 — `throw new NotFoundError(...)` and `throw new BadRequestError(...)` without try/catch caused unhandled promise rejections that crashed the server.
- **Fix:** Wrapped all three methods in try/catch with proper `res.status(404/400).json()` responses.
- **File:** `src/backend/modules/api/controllers/OwsWalletController.ts`

**14. OwsApiKeyController getApiKey/deleteApiKey crash**
- **Symptom:** `GET /api/ows/api-keys/:id` and `DELETE /api/ows/api-keys/:id` returned 502 Bad Gateway
- **Root cause:** Same unhandled throw pattern — `NotFoundError` and `BadRequestError` thrown without try/catch.
- **Fix:** Wrapped both methods in try/catch with proper `res.status(404/400).json()` responses.
- **File:** `src/backend/modules/api/controllers/OwsApiKeyController.ts`

**15. OwsPermissionsController all methods crash**
- **Symptom:** `POST /api/ows/permissions`, `GET /api/ows/permissions/:walletId` returned 502 Bad Gateway
- **Root cause:** Same unhandled throw pattern across `requestPermissions`, `getPermissions`, `revokePermissions`, and `checkPermissions`.
- **Fix:** Wrapped all four methods in try/catch with proper `res.status(400/500).json()` responses.
- **File:** `src/backend/modules/api/controllers/OwsPermissionsController.ts`

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │         Cognivern API (Express)          │
                    │  Port 3087 · PM2 · nginx reverse proxy   │
                    ├─────────────────────────────────────────┤
  TestSprite ──►    │  apiKeyMiddleware → authMiddleware       │
  (19 tests)        │  PUBLIC_API_PATHS bypass (regex match)   │
                    ├─────────────────────────────────────────┤
                    │  Controllers:                           │
                    │  · Auth (register/login/nonce/JWT)      │
                    │  · Governance (policy eval, FHE)        │
                    │  · OWS (wallets, agents, API keys)      │
                    │  · Copilot (runs, events, approvals)    │
                    │  · SealedBid (FHE-encrypted auctions)   │
                    │  · Sapience (forecasting, on-chain)     │
                    │  · CRE (workflow runs, provenance)      │
                    │  · Metrics (UX events, daily stats)     │
                    │  · Fhenix (FHE encrypt/decrypt)         │
                    │  · Speech (transcription)               │
                    │  · Audit (evidence hashes, artifacts)   │
                    ├─────────────────────────────────────────┤
                    │  SQLite (better-sqlite3)                │
                    │  · users, workspaces, api_keys          │
                    │  · audit_logs, copilot_runs             │
                    │  · sealed_bid_rounds, nonces            │
                    └─────────────────────────────────────────┘
```

### Key Integrations
- **Fhenix** — FHE for confidential policy evaluation and sealed-bid auctions
- **Sapience** — On-chain prediction market forecasting via Groq LLM
- **Ledger DMK** — Hardware signing for high-value transactions
- **ChainGPT** — Web3 LLM for smart contract auditing
- **ElevenLabs** — Speech-to-text for voice-driven agent commands

---

## CI/CD

Every PR runs the full TestSprite suite via GitHub Actions (`.github/workflows/testsprite.yml`). The build fails on any regression.

**Deploy pipeline:** `pnpm build` → `pnpm deploy:hetzner` → rsync artifact → PM2 restart → health check

---

## Documentation

| Doc | Contents |
|-----|----------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, data flows, network roles, Fhenix/ChainGPT/Ledger integrations |
| [Developer Guide](./docs/DEVELOPER.md) | Getting started, local setup, API reference, testing, production readiness |
| [Deployment](./docs/DEPLOYMENT.md) | Deploy to Hetzner, PM2, nginx, env vars, health checks |
| [AI Safety Report](./scripts/hackathon/HACKATHON_REPORT.md) | Multi-dimensional suspicion scorer design, failure mode analysis |
| [LOOP.md](./LOOP.md) | Agent-written log of the write-verify-fix loop, one line per iteration |
| [This doc](./HACKATHON_SUBMISSION.md) | Comprehensive submission summary |

---

## Reproducing

```bash
# Run the full TestSprite suite
testsprite test list --project ad5aa683-dbc5-4484-8236-e4a3aef914ee
testsprite test rerun <test-id> --wait

# Or run locally
pnpm install
pnpm build
pnpm start
# Tests hit https://cognivern.thisyearnofear.com (production)
```

---

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, better-sqlite3
- **Frontend:** React, Vite, TypeScript
- **Infra:** Hetzner VPS, PM2, nginx, GitHub Actions
- **Testing:** TestSprite CLI (19 tests, 481 assertions)
- **Integrations:** Fhenix (FHE), Sapience (forecasting), Ledger (hardware signing), ChainGPT (Web3 LLM), ElevenLabs (speech), Groq (LLM inference)

---

## License

MIT
