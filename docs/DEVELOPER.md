# Developer Guide

Local setup, API reference, and production readiness for Cognivern.

## Getting Started (No Code Required)

Try Cognivern without connecting a wallet:

1. Go to **[cognivern.persidian.com](https://cognivern.persidian.com)**
2. Use the guided demo CTA — no signup needed for the public/demo path
3. You'll land in a sandbox with sample policies and pre-filled spend examples

For moderated user sessions, use the [User-Testing Protocol](./USER_TESTING_PROTOCOL.md)
and provide participants only the canonical URL from the [Tester Guide](./TESTER_GUIDE.md).
Authenticated research requires a disposable workspace or staging environment;
do not use production credentials, real funds, or another user's workspace.

From the demo you can preview spends, adjust policy sliders, and view the audit trail.

### Production Setup

1. **Create workspace** — Sign in, enter workspace name, get an API key
2. **Register agent** — Dashboard → "Create Agent" → pick a template or fill manually
3. **Set policy** — Choose Strict (<$100/day), Moderate (<$1K/day), or Open, or create custom rules (daily limit, per-tx limit, vendor allowlist, contract blocklist, time window)
4. **Connect agent** — Give your agent the Agent ID and API key:

```bash
curl -X POST https://cognivern.persidian.com/api/governance/evaluate \
  -H "x-api-key: cvn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-YOUR-AGENT-ID", "action": {"type": "swap", "description": "Swap 1500 USDC for ETH", "amount": 1500, "currency": "USDC"}}'
```

Standard policies return sync decisions. Confidential (FHE) policies return `202 Accepted` with a `runId` to poll.

### Decisions

| Decision        | Meaning           | What Happens                                                      |
| --------------- | ----------------- | ----------------------------------------------------------------- |
| **Approved** ✅ | Spend fits policy | Native-token transfer broadcast on X Layer testnet                |
| **Held** ⏸     | Needs review      | Approve/Deny in dashboard. Failed broadcasts leave run retryable. |
| **Denied** ❌   | Violates policy   | Money does not move                                               |

Each decision includes a Decision ID, attestation hash, matched policy rules, and on-chain tx hash (if approved).

### Common Setups

- **DAO Treasury** — Multiple bots as agents, Strict policy, Ledger hardware signing, monthly CSV exports
- **Crypto Fund** — Trading bots, Moderate policy, ChainGPT contract audits, MongoDB for compliance reporting
- **Individual Trader** — Single bot, Open policy with daily limit, demo mode for strategy testing

## Local Setup

### Requirements

- Node.js v20.14+
- pnpm

### Install & Run

```bash
pnpm install
pnpm build
pnpm start
```

### Environment

Create `.env` from `.env.example`. Minimum for local dev:

```env
API_KEY=your_api_key_here
FILECOIN_PRIVATE_KEY=          # Optional — OWS wallet + Fhenix fallback
GOVERNANCE_CONTRACT_ADDRESS=   # Optional — defaults to empty
STORAGE_CONTRACT_ADDRESS=      # Optional — defaults to empty
ZEROG_PRIVATE_KEY=             # Optional — 0G storage anchoring + on-chain proof signer (falls back to OWS_BOOTSTRAP_PRIVATE_KEY)
ZEROG_RPC_URL=                 # Optional — 0G Galileo RPC (defaults to evmrpc-testnet.0g.ai)
ZEROG_CHAIN_ID=                # Optional — 0G chain id (defaults to 16602)
ZEROG_PROOF_CONTRACT=          # Optional — GovernanceProof contract for on-chain decision proofs
OPENAI_API_KEY=                # Optional — AI intent processing
FIREWORKS_API_KEY=             # Optional — primary AI provider
GROQ_API_KEY=                  # Optional — fallback AI provider
CONTROL_EVAL_MODE=false        # Optional — parallel suspicion scoring
```

Fhenix variables can be left empty for local dev — the service falls back to a deny decision when CoFHE is unavailable. AI provider keys enable natural language intent; without them, keyword-based fallback is used.

### Smart Contracts

```bash
npx hardhat compile
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
```

Deployment outputs contract addresses to add to `.env`. See [Deployment](./DEPLOYMENT.md) for deployment details.

### Workspace Structure

pnpm monorepo with three packages:

| Package        | Path           | Purpose                       |
| -------------- | -------------- | ----------------------------- |
| Root (backend) | `.`            | Express API, agents, services |
| Frontend       | `src/frontend` | React dashboard               |
| Contracts      | `contracts`    | Hardhat Solidity contracts    |

## Core Services

| Service                    | Responsibility                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PolicyService`            | Loads and stores policies                                                                                          |
| `PolicyEnforcementService` | Evaluates actions against rules, returns allow/deny                                                                |
| `FhenixPolicyService`      | Confidential policy paths, encrypted decisions, permit-ready evidence                                              |
| `AuditLogService`          | Maps CRE runs to audit logs; persists policyChecks, suspicion, aiUsage, txHash, anchoring evidence                 |
| `OwsLocalVaultService`     | Encrypted local wallet storage, API-key issuance                                                                   |
| `OwsWalletService`         | Spend execution, policy enforcement, signed authorizations                                                         |
| `IntentController`         | Natural language intent via AI with multi-provider routing; enriches responses with real workspace data            |
| `MultiModelRouter`         | Routes AI across 6 providers with fallback + circuit breakers                                                      |
| `ControlEvaluationService` | Parallel suspicion scoring (0-1), gated by `CONTROL_EVAL_MODE`                                                     |
| `WorkspaceDataService`     | Agent/policy/spend management; `evaluateAction()` is the canonical rule evaluator called by `GovernanceController` |

## API Reference

### Governance Control Plane

**`POST /api/governance/evaluate`**

```json
{
  "agentId": "string",
  "action": { "type": "string", "amount": 200, "currency": "USDC", "description": "..." }
}
```

Response (`GovernanceEvaluation`):

```json
{
  "allowed": true,
  "decision": "approved",
  "reasoning": "Approved — passed 4 policy check(s)",
  "policyChecks": [{ "policyId": "...", "result": true, "reason": "..." }],
  "timestamp": "..."
}
```

- `allowed` is legacy boolean (`true` only for approved; `held` and `denied` both `false`)
- `decision` is the three-state field — prefer this when rendering

Related: `GET/POST /api/governance/policies`, `GET /api/governance/health`

### Data Plane — Run Ingestion

**`POST /ingest/runs`** — Headers: `Authorization: Bearer <ingestKey>`, `X-PROJECT-ID: <projectId>`

Related: `GET /api/projects`, `GET /api/projects/:projectId/usage`

### OWS Wallet

| Endpoint             | Method    | Description          |
| -------------------- | --------- | -------------------- |
| `/api/ows/bootstrap` | POST      | Bootstrap OWS wallet |
| `/api/ows/wallets`   | GET       | List wallets         |
| `/api/ows/api-keys`  | GET, POST | API key management   |

### Spend Execution

| Endpoint               | Method | Description                                     |
| ---------------------- | ------ | ----------------------------------------------- |
| `/api/spend`           | POST   | Execute governed spend                          |
| `/api/spend/encrypted` | POST   | Confidential-policy spend with encrypted amount |
| `/api/spend/preview`   | POST   | Simulate spend (dry-run)                        |
| `/api/spend/status`    | GET    | Execution status                                |

### Audit & Run Ledger

| Endpoint                             | Method | Description                                                |
| ------------------------------------ | ------ | ---------------------------------------------------------- |
| `/api/audit/logs`                    | GET    | Audit trail                                                |
| `/api/audit/insights`                | GET    | Insights — `?dimension=ai_spend` or `?dimension=suspicion` |
| `/api/audit/permits`                 | POST   | Issue confidential audit decryption permits                |
| `/api/cre/runs`                      | GET    | Run ledger                                                 |
| `/api/cre/runs/:runId/events/stream` | GET    | SSE event stream                                           |

### AI Intent Processing

**`POST /api/intent`** — `{ "query": "Show my spending", "context": { "currentPath": "/dashboard" } }`

Returns intent classification, component routing, and agent actions. Falls back to keyword-based classification when AI providers are unavailable.

### MCP Governance Tool

MCP-compliant governance tool for integration with external agent frameworks.

| Endpoint                    | Method | Description               |
| --------------------------- | ------ | ------------------------- |
| `/api/mcp/governance-check` | GET    | Tool manifest (discovery) |
| `/api/mcp/governance-check` | POST   | Evaluate governed action  |

POST body includes optional `fhirContext` for HIPAA-aware governance evaluation with clinical sensitivity rules.

## Testing

```bash
pnpm test
pnpm typecheck
pnpm lint
```

### TestSprite Integration Tests

The project includes 24 TestSprite CLI backend tests, 30 MCP-generated Playwright frontend tests, and checked-in Playwright smoke coverage for the current public/demo UI. The checked-in suite includes:

- `tests/e2e/landing.spec.ts` — public landing page content and primary CTAs;
- `tests/e2e/demo-flow.spec.ts` — governed and ungoverned spend-demo paths;
- `tests/e2e/authenticated-smoke.spec.ts` — opt-in navigation through the
  authenticated core surfaces using an existing disposable account.

The authenticated smoke test does not create accounts or mutate records. Run it
only with `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` set to a disposable test
account. A skipped run without credentials is expected and does not validate
production authentication.

```bash
# Public/demo browser smoke tests (no credentials required)
pnpm test:e2e tests/e2e/landing.spec.ts tests/e2e/demo-flow.spec.ts

# Authenticated browser smoke test (disposable account only)
E2E_TEST_EMAIL='tester@example.com' \\
E2E_TEST_PASSWORD='disposable-password' \\
pnpm exec playwright test tests/e2e/authenticated-smoke.spec.ts

# List all TestSprite tests
testsprite test list --project 8be1ec9e-a2c5-484a-8a2e-422b87832028

# Run a specific test
testsprite test rerun <test-id> --wait

# Run locally (tests hit production)
python3 .testsprite/tests/spendos_deep.py
```

Test files live in `.testsprite/tests/` and cover: auth (register, login, nonce, verify, refresh, logout), health (6 variants), metrics, Fhenix FHE, intent classification, projects, sealed-bid auctions, MCP governance, agents (stats, leaderboard, market data), OWS (wallets, API keys, permissions), copilot, CRE runs, speech, spend (deep SpendOS: preview, execute, encrypted, confirm, scan), governance CRUD, and audit trail integrity.

The write-verify-fix loop caught production issues during the build window; see [LOOP.md](./LOOP.md) for the iteration log and [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md) for representative examples.

## Production Readiness

### Completed

- [x] Error boundaries, circuit breakers, code splitting
- [x] Sensitive data redaction in public proofs
- [x] Unit + integration tests, CI pipeline
- [x] TestSprite integration suite (24 CLI + 30 MCP frontend tests) with direct Canton ledger assertions
- [x] Multi-provider AI routing (6 providers)
- [x] Rate limiting on public endpoints (configurable per-endpoint)
- [x] SIWE wallet auth + JWT with nonce replay protection
- [x] Workspace multi-tenancy with per-workspace SQLite tables
- [x] Demo data from backend `DemoDataService` for sandbox mode
- [x] Mode system: Demo → Sandbox → Production

### Remaining

- [ ] Sentry integration for frontend error tracking
- [ ] 80%+ test coverage for core business logic
- [ ] Isolated staging/test environment with seeded states and a verified reset procedure for moderated user testing
- [ ] Self-service workspace tier upgrade (demo → live)

## Running with SigNoz (Observability)

Cognivern ships with OpenTelemetry instrumentation for every LLM call,
governance decision, audit log, and agent cycle. To export telemetry to
SigNoz:

### 1. Set environment variables

```env
# SigNoz Cloud OTLP endpoint (e.g. https://us.ingest.signoz.cloud)
OTEL_EXPORTER_OTLP_ENDPOINT=https://us.ingest.signoz.cloud
# SigNoz ingestion key (from Settings -> Ingestion)
SIGNOZ_INGESTION_KEY=your-ingestion-key
# Optional: SigNoz Cloud URL for trace deep-links
SIGNOZ_CLOUD_URL=https://us.signoz.cloud
# Service name shown in SigNoz
OTEL_SERVICE_NAME=cognivern-backend
```

If omitted, the OTel SDK stays disabled with zero overhead.

### 2. Start the backend

```bash
pnpm build:backend
node --loader config/esm-dir-loader.mjs dist/src/index.js
```

### 3. Seed telemetry data

```bash
pnpm signoz:seed -- --api-key $COGNIVERN_API_KEY
```

This runs 6 governance evaluations (3 approved, 2 denied, 1 held) to
populate the SigNoz dashboards with correlated trace data.

### 4. Import dashboards

In SigNoz Cloud, go to Dashboards -> Import -> paste the JSON from
`docs/signoz-dashboards.json`.

### 5. Verify

Open the Observability page in the Cognivern frontend (Developer ->
Tracing) to verify the telemetry boundary in three parts: the OTLP endpoint
should be reachable, the SigNoz query API should be configured, and the Live
telemetry cards should contain data. An endpoint responding only proves network
reachability; a successful query confirms that data is actually visible in the
workspace. The Audit and Runs pages should show "View trace in SigNoz" links
when their decision/run evidence contains a trace ID.

For production operations, treat the Observability page as the quick check and
SigNoz as the source of truth for alerting, retention, and cross-workspace
analysis. Keep the trace ID in the Cognivern audit/run record so a reviewer can
move from a business decision to its distributed trace without searching by
timestamp.

The Tracing page supports 1-hour, 24-hour, and 7-day windows. When a signed-in
workspace ID is available, governance metrics emitted through the workspace
data path are filtered by `workspace_id`; older or unscoped telemetry remains
visible only in the unfiltered view. The page also surfaces lightweight watch
signals for non-zero LLM failures and p95 latency above 2 seconds. These are
operator cues, not a replacement for SigNoz alert rules.

Run `pnpm signoz:check` to validate the checked-in dashboard manifest. With
`SIGNOZ_CLOUD_URL` and `SIGNOZ_API_KEY` set, it performs a read-only comparison
against the SigNoz dashboard API and exits non-zero when a declared dashboard
is missing. This makes manual dashboard imports detectable in CI or a release
check without mutating the shared workspace.

See `docs/ARCHITECTURE.md` -> "Telemetry & Observability" for the full
instrumentation map, and `HACKATHON_SUBMISSION_SIGNOZ.md` for the hackathon
submission write-up.

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design, integrations, data flows
- [Deployment](./DEPLOYMENT.md) — Deploy to Hetzner, PM2, nginx, health checks
