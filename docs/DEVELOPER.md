# Developer Guide

Local setup, API reference, and production readiness for Cognivern.

## Getting Started (No Code Required)

Try Cognivern without connecting a wallet:

1. Go to **[cognivern.vercel.app](https://cognivern.vercel.app)**
2. Click **"Try Live Demo"** — no signup needed
3. You'll land in a sandbox with a demo agent, sample policies, and pre-filled spend examples

From the demo you can preview spends, adjust policy sliders, and view the audit trail.

### Production Setup

1. **Create workspace** — Sign in, enter workspace name, get an API key
2. **Register agent** — Dashboard → "Create Agent" → pick a template or fill manually
3. **Set policy** — Choose Strict (<$100/day), Moderate (<$1K/day), or Open, or create custom rules (daily limit, per-tx limit, vendor allowlist, contract blocklist, time window)
4. **Connect agent** — Give your agent the Agent ID and API key:

```bash
curl -X POST https://cognivern.thisyearnofear.com/api/governance/evaluate \
  -H "x-api-key: cvn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-YOUR-AGENT-ID", "action": {"type": "swap", "description": "Swap 1500 USDC for ETH", "amount": 1500, "currency": "USDC"}}'
```

Standard policies return sync decisions. Confidential (FHE) policies return `202 Accepted` with a `runId` to poll.

### Decisions

| Decision | Meaning | What Happens |
| -------- | -------- | ----------- |
| **Approved** ✅ | Spend fits policy | Native-token transfer broadcast on X Layer testnet |
| **Held** ⏸ | Needs review | Approve/Deny in dashboard. Failed broadcasts leave run retryable. |
| **Denied** ❌ | Violates policy | Money does not move |

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

Deployment outputs contract addresses to add to `.env`. See [Operations](./OPS.md) for deployment details.

### Workspace Structure

pnpm monorepo with three packages:

| Package        | Path           | Purpose                       |
| -------------- | -------------- | ----------------------------- |
| Root (backend) | `.`            | Express API, agents, services |
| Frontend       | `src/frontend` | React dashboard               |
| Contracts      | `contracts`    | Hardhat Solidity contracts    |

## Core Services

| Service                    | Responsibility |
| -------------------------- | -------------- |
| `PolicyService`            | Loads and stores policies |
| `PolicyEnforcementService` | Evaluates actions against rules, returns allow/deny |
| `FhenixPolicyService`      | Confidential policy paths, encrypted decisions, permit-ready evidence |
| `AuditLogService`          | Maps events into CRE-backed evidence records |
| `OwsLocalVaultService`     | Encrypted local wallet storage, API-key issuance |
| `OwsWalletService`         | Spend execution, policy enforcement, signed authorizations |
| `IntentController`         | Natural language intent via AI with multi-provider routing |
| `MultiModelRouter`         | Routes AI across 6 providers with fallback + circuit breakers |
| `ControlEvaluationService` | Parallel suspicion scoring (0-1), gated by `CONTROL_EVAL_MODE` |

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

| Endpoint | Method | Description |
|---|---|---|
| `/api/ows/bootstrap` | POST | Bootstrap OWS wallet |
| `/api/ows/wallets` | GET | List wallets |
| `/api/ows/api-keys` | GET, POST | API key management |

### Spend Execution

| Endpoint | Method | Description |
|---|---|---|
| `/api/spend` | POST | Execute governed spend |
| `/api/spend/encrypted` | POST | Confidential-policy spend with encrypted amount |
| `/api/spend/preview` | POST | Simulate spend (dry-run) |
| `/api/spend/status` | GET | Execution status |

### Audit & Run Ledger

| Endpoint | Method | Description |
|---|---|---|
| `/api/audit/logs` | GET | Audit trail |
| `/api/audit/insights` | GET | Insights — `?dimension=ai_spend` or `?dimension=suspicion` |
| `/api/audit/permits` | POST | Issue confidential audit decryption permits |
| `/api/cre/runs` | GET | Run ledger |
| `/api/cre/runs/:runId/events/stream` | GET | SSE event stream |

### AI Intent Processing

**`POST /api/intent`** — `{ "query": "Show my spending", "context": { "currentPath": "/dashboard" } }`

Returns intent classification, component routing, and agent actions. Falls back to keyword-based classification when AI providers are unavailable.

### MCP Governance Tool

MCP-compliant governance tool for integration with external agent frameworks.

| Endpoint | Method | Description |
|---|---|---|
| `/api/mcp/governance-check` | GET | Tool manifest (discovery) |
| `/api/mcp/governance-check` | POST | Evaluate governed action |

POST body includes optional `fhirContext` for HIPAA-aware governance evaluation with clinical sensitivity rules.

## Testing

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Production Readiness

### Completed

- [x] Error boundaries, circuit breakers, code splitting
- [x] Sensitive data redaction in public proofs
- [x] Unit + integration tests, CI pipeline
- [x] Multi-provider AI routing (6 providers)
- [x] Rate limiting on public endpoints (configurable per-endpoint)
- [x] SIWE wallet auth + JWT with nonce replay protection
- [x] Workspace multi-tenancy with per-workspace SQLite tables
- [x] Demo data from backend `DemoDataService` for sandbox mode
- [x] Mode system: Demo → Sandbox → Production

### Remaining

- [ ] Sentry integration for frontend error tracking
- [ ] 80%+ test coverage for core business logic
- [ ] Staging environment
- [ ] Self-service workspace tier upgrade (demo → live)

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design, integrations, data flows
- [Operations](./OPS.md) — Production deployment, PM2, incident response
