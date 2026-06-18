# Developer Guide

This guide covers Cognivern as a unified governance plane for agent teams: financial spend controls, confidential policy enforcement, and emerging AI spend efficiency operations across toolchains.

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
# Optional — used by OWS wallet bootstrap and Fhenix fallback
FILECOIN_PRIVATE_KEY=
GOVERNANCE_CONTRACT_ADDRESS=
STORAGE_CONTRACT_ADDRESS=

# AI Provider Keys (optional - for intent processing)
OPENAI_API_KEY=
FIREWORKS_API_KEY=      # Primary AI provider (DeepSeek-v4-Flash)
GROQ_API_KEY=           # Fallback provider (Llama-3.3-70B)
VENICE_API_KEY=         # Fallback provider (Llama-3.3-70B)
GEMINI_API_KEY=         # Alternative provider
KILOCODE_API_KEY=       # Free models fallback

# Rate Limits (optional - defaults in code)
RATE_LIMIT_WINDOW_MS=900000      # 15 min window for general endpoints
RATE_LIMIT_MAX_REQUESTS=100       # 100 requests per window
INGEST_RATE_LIMIT_PER_MINUTE=120  # 120 requests/min for ingest
INTENT_RATE_LIMIT_PER_MINUTE=30   # 30 requests/min for AI intent (expensive)
GOVERNANCE_RATE_LIMIT_PER_MINUTE=60  # 60 requests/min for governance

# Control Evaluation Mode (optional — parallel suspicion scoring)
# When true, every governance evaluation gets a suspicion score (0-1)
# stored in the audit trail. Does not change approve/deny decisions.
CONTROL_EVAL_MODE=false
```

# Fhenix / CoFHE (optional — for confidential policy evaluation)

FHENIX_RPC_URL=https://api.testnet.fhenix.zone
FHENIX_SEPOLIA_RPC=https://api.testnet.fhenix.zone
FHENIX_POLICY_CONTRACT=0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE

# Falls back to FILECOIN_PRIVATE_KEY if not set

FHENIX_PRIVATE_KEY=

# Optional: override chain ID (default: 84532 for Fhenix Base Sepolia)

FHENIX_CHAIN_ID=84532

# Optional: override individual CoFHE service URLs

# FHENIX_COFHE_URL=https://testnet-cofhe.fhenix.zone

# FHENIX_VERIFIER_URL=https://testnet-cofhe-vrf.fhenix.zone

# FHENIX_TN_URL=https://testnet-cofhe-tn.fhenix.zone

FHENIX_EVALUATE_TIMEOUT_MS=30000

````

Fhenix variables can be left empty for local dev — the service falls back to a deny decision when the CoFHE client is unavailable. Contract addresses (`GOVERNANCE_CONTRACT_ADDRESS`, `STORAGE_CONTRACT_ADDRESS`) can be left empty for local dev — they default to empty strings. AI provider keys enable the natural language intent system; without them, keyword-based fallback responses are used.

### Smart Contracts

The project includes Solidity contracts in `contracts/src/`:
- **GovernanceContract** — Policy management and agent governance
- **AIGovernanceStorage** — Specialized AI governance data storage

To deploy contracts (e.g. to Filecoin Calibration testnet):

```bash
# Set FILECOIN_PRIVATE_KEY and FILECOIN_RPC_URL in .env
npx hardhat compile
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
````

The deployment script outputs contract addresses to add to your `.env`. See [Operations](./OPS.md) for deployment details.

### Workspace Structure

This is a pnpm monorepo with three packages:

| Package        | Path           | Purpose                       |
| -------------- | -------------- | ----------------------------- |
| Root (backend) | `.`            | Express API, agents, services |
| Frontend       | `src/frontend` | React dashboard               |
| Contracts      | `contracts`    | Hardhat Solidity contracts    |

## Core Services

| Service                    | Responsibility                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `PolicyService`            | Loads and stores local policies                                                                       |
| `PolicyEnforcementService` | Evaluates actions against policy rules, returns allow/deny decisions                                  |
| `FhenixPolicyService`      | Evaluates confidential policy paths, normalizes encrypted decisions, and issues permit-ready evidence |
| `AuditLogService`          | Maps events into CRE-backed evidence records                                                          |
| `IngestController`         | Validates and stores BYO-agent runs, enforces ingest keys                                             |
| `CreController`            | Exposes run ledger, event streams, retries, approvals                                                 |
| `OwsLocalVaultService`     | Encrypted local wallet storage, API-key issuance                                                      |
| `OwsWalletService`         | Spend execution, policy enforcement, signed authorizations                                            |
| `IntentController`         | Natural language intent processing via AI with multi-provider routing                                 |
| `MultiModelRouter`         | Routes AI requests across 6 providers with fallback logic and circuit breakers                        |
| `ControlEvaluationService` | Parallel suspicion scoring (0-1) across 4 dimensions for every governance evaluation; gated by `CONTROL_EVAL_MODE` |

### Product framing for contributors

- **Policy:** central enforcement path for governed execution decisions.
- **Privacy:** confidential policy mode (`policy.metadata.confidential`) for encrypted evaluation and scoped permit workflows.
- **Efficiency:** AI usage and model-routing optimization should integrate into the same governance/audit plane (single source of truth, no parallel enforcement stack).
- **Auditability:** decision artifacts (`decisionId`, attestations, execution context) remain first-class outputs for downstream reporting and controls.

## API Reference

### Data Plane — Run Ingestion

**`POST /ingest/runs`**

Headers: `Authorization: Bearer <ingestKey>`, `X-PROJECT-ID: <projectId>`

```json
{
  "runId": "string",
  "workflow": "string",
  "mode": "local",
  "startedAt": "2026-01-01T00:00:00.000Z",
  "finishedAt": "2026-01-01T00:00:01.000Z",
  "ok": true,
  "steps": [],
  "artifacts": []
}
```

Related: `GET /api/projects`, `GET /api/projects/:projectId/usage`

### Governance Control Plane

**`POST /api/governance/evaluate`**

```json
{
  "agentId": "string",
  "action": { "type": "string", "amount": 200, "currency": "USDC", "description": "..." }
}
```

Response shape (`GovernanceEvaluation`):

```json
{
  "allowed": true,
  "decision": "approved",
  "reasoning": "Approved — passed 4 policy check(s)",
  "policyChecks": [{ "policyId": "...", "result": true, "reason": "..." }],
  "timestamp": "..."
}
```

- `allowed` is the legacy two-state boolean. `true` only for fully approved spends; `held` and `denied` both come back as `false`.
- `decision` is the three-state field — `"approved" | "held" | "denied"`. Prefer this when rendering the verdict; fall back to `allowed` for backwards compat.

**Sandbox demo bands.** With `X-Workspace-Mode: sandbox` (the default for new sign-ins until `setWorkspaceMode("production")` is called) the demoInterceptor bands the decision by amount:

| Amount (USDC) | `decision` |
| --- | --- |
| `< 100` | `approved` |
| `100 ≤ amount ≤ 3000` | `held` |
| `> 3000` | `denied` |

The reasoning string names the demo policy responsible (e.g. "Held for review by Human Approval Threshold").

Related: `GET/POST /api/governance/policies`, `GET /api/governance/health`

### OWS Wallet

| Endpoint             | Method    | Description          |
| -------------------- | --------- | -------------------- |
| `/api/ows/bootstrap` | POST      | Bootstrap OWS wallet |
| `/api/ows/wallets`   | GET       | List wallets         |
| `/api/ows/api-keys`  | GET, POST | API key management   |

### Spend Execution

| Endpoint               | Method | Description                                                     |
| ---------------------- | ------ | --------------------------------------------------------------- |
| `/api/spend`           | POST   | Execute governed spend                                          |
| `/api/spend/encrypted` | POST   | Execute confidential-policy spend with encrypted amount payload |
| `/api/spend/preview`   | POST   | Simulate spend (dry-run)                                        |
| `/api/spend/status`    | GET    | Execution status                                                |

### Audit & Run Ledger

| Endpoint                             | Method | Description                                 |
| ------------------------------------ | ------ | ------------------------------------------- |
| `/api/audit/logs`                    | GET    | Audit trail                                 |
| `/api/audit/insights`                | GET    | Audit insights — pass `?dimension=ai_spend` for `{totalCostUsd, totalTokens, totalCalls, byProvider, recentEntries}`, `?dimension=suspicion` for `{totalScored, averageScore, escalationRate, distribution}`. Omit dimension for the unified summary. Sandbox mode returns zero-state versions of the same shapes. |
| `/api/audit/permits`                 | POST   | Issue confidential audit decryption permits |
| `/api/cre/runs`                      | GET    | Run ledger                                  |
| `/api/cre/runs/:runId`               | GET    | Run details                                 |
| `/api/cre/runs/:runId/events/stream` | GET    | SSE event stream                            |

### AI Intent Processing

| Endpoint              | Method | Description                       |
| --------------------- | ------ | --------------------------------- |
| `/api/intent`         | POST   | Process natural language commands |
| `/api/intent/metrics` | GET    | Intent system metrics             |

**`POST /api/intent`**

```json
{
  "query": "Show my spending",
  "context": { "currentPath": "/dashboard" }
}
```

Returns intent classification, component routing, and agent actions. Falls back to keyword-based classification when AI providers are unavailable.

### MCP Governance Tool

Cognivern exposes an MCP-compliant governance tool for integration with the Prompt Opinion Marketplace and Agents Assemble healthcare AI workflows.

| Endpoint                       | Method | Description                  |
| ------------------------------ | ------ | ---------------------------- |
| `/api/mcp/governance-check`    | GET    | Tool manifest (discovery)    |
| `/api/mcp/governance-check`    | POST   | Evaluate governed action     |

**Tool Discovery (GET)**

Returns the MCP tool manifest with `input_schema` and `output_schema` for client-side validation.

**Evaluation (POST)**

```json
{
  "agentId": "string",
  "action": {
    "type": "string",
    "description": "string",
    "amount": 0,
    "currency": "USDC"
  },
  "fhirContext": {
    "subject": { "resourceType": "Patient", "id": "string" },
    "requester": { "resourceType": "Practitioner", "id": "string" },
    "sensitivityLabels": ["MH", "SUD"]
  },
  "a2aTraceId": "string"
}
```

Returns `allowed`, `reasoning`, `policyChecks`, `provider`, `model`, and `auditLogId`. The `fhirContext` block is optional — when present, the governance evaluation is HIPAA-aware and applies clinical sensitivity rules.

**Smoke test:**

```bash
COGNIVERN_URL=http://localhost:8787 COGNIVERN_API_KEY=development-api-key \
  npx tsx scripts/tests/mcp-governance-smoke.ts
```

### Control Evaluation Mode

When `CONTROL_EVAL_MODE=true`, every governance evaluation gets a composite suspicion score (0-1) across four dimensions — rule violations (2x weight), behavioral deviation, temporal anomaly, and scope creep. The score is stored in `CreRun.evidence.suspicion` and surfaced in the audit trail and dashboard. It never modifies approve/deny decisions.

**Insights endpoint:**

```bash
curl "$COGNIVERN_URL/api/audit/insights?dimension=suspicion" \
  -H "Authorization: Bearer $COGNIVERN_API_KEY"
```

Returns `totalScored`, `distribution` (normal/elevated/high/critical), `averageScore`, `escalationRate`, `topAgents`, `recentEscalations`, and `dimensionContribution`.

**Smoke test:**

```bash
COGNIVERN_URL=http://localhost:8787 COGNIVERN_API_KEY=development-api-key \
  npx tsx scripts/tests/control-eval-smoke.ts
```

## Testing

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Production Readiness

### Completed

- [x] Error boundaries for frontend resilience
- [x] Circuit breakers for external services (Sapience, Contract, AI providers)
- [x] Code splitting and adaptive loading
- [x] Sensitive data redaction in public proofs
- [x] Unit tests for core services (PolicyEnforcement, TradingHistory, Sapience)
- [x] Integration tests for CRE controller
- [x] CI pipeline for backend and frontend builds
- [x] `.env.example` synced with required keys
- [x] Multi-provider AI routing (6 providers: Fireworks, Kilocode, Workers AI, OpenAI, Gemini, Anthropic)
- [x] Natural language intent processing with fallback classification
- [x] Compact UI with responsive improvements
- [x] Rate limiting on public endpoints (configurable per-endpoint)

### Remaining

- [ ] Sentry integration for frontend error tracking
- [ ] 80%+ test coverage for core business logic
- [ ] Automated versioning and changelog
- [ ] Staging environment

### Progress: ~93%

### Remaining (Platform)

- [x] User authentication (SIWE wallet) — implemented via `AuthWatcher` + JWT
- [x] Workspace multi-tenancy with data isolation — per-workspace SQLite tables
- [x] Per-workspace API key management — `api_keys` table + middleware
- [x] Demo data served from backend `DemoDataService` when `X-Workspace-Mode: sandbox`
- [x] Real wallet connection in onboarding flow — RainbowKit + auto sign-in
- [x] Mode system: Demo → Sandbox → Production with clear transitions
- [ ] Self-service workspace tier upgrade (demo → live)
- [ ] Email-based auth as alternative to wallet

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design and data flows
- [Operations](./OPS.md) — Production deployment and operations
