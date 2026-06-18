# Architecture

## Mission

**Make agent wallet activity governable.**

Cognivern is a control plane for OWS wallets that handles policy checks, approvals, and audit for autonomous agents.

## Responsibility Boundary

| OWS Owns                   | Cognivern Owns                     | Swappable Via              |
| -------------------------- | ---------------------------------- | -------------------------- |
| Wallet storage             | Policy evaluation                  | —                          |
| API-key issuance           | Approval workflows                 | —                          |
| Transaction signing        | Audit-log indexing / signing layer | SigningProvider adapter    |
| Signing policy enforcement | Run ledger & analytics             | —                          |

## System Overview

```
Agent
  |
  | intended spend / sign request
  v
Cognivern Evaluation Layer
  |
  ├── GovernanceController.evaluateAction()
  │   ├── standard rule → PolicyEnforcementService.evaluateRule()
  │   ├── confidential rule → FhenixPolicyService → Fhenix FHE
  │   └── contract_audit rule → ChainGPTAuditService
  │
  ├── [optional] ControlEvaluationService.score()  ← CONTROL_EVAL_MODE=true
  │   └── 4-dimension suspicion score (0-1), never blocks the decision
  │
  +--> approve → SigningProvider.dispatch()  ← Ledger / Speculos / Local / OWS Remote
  +--> hold    → human or second wallet approves
  +--> deny    → no signing
  |
  v
Cognivern Audit + Run Ledger
  ├── AuditLogService.logAction() — every decision recorded, reasons preserved
  ├── [optional] Suspicion evidence persisted to CreRun.evidence.suspicion
  ├── [optional] Filecoin evidence anchoring via FilecoinStorageService (FVM AIGovernanceStorage)
  ├── [optional] 0G Storage evidence anchoring via ZeroGStorageService (dual-anchor)
  └── [optional] X Layer execution dispatch via Hyperlane
```

## Canonical Decision Lifecycle

Every governance decision follows this path:

```
Agent action
  → GovernanceController.evaluateAction()
  → PolicyEnforcementService.evaluateRule()
      ├─ standard rule → local evaluation (allow/deny/require/rate_limit)
      ├─ confidential rule → FhenixPolicyService → Fhenix FHE
      └─ contract_audit rule → ChainGPTAuditService
  → decision: approve / hold / deny
  → [optional, CONTROL_EVAL_MODE=true] ControlEvaluationService.score()
      └─ 4 dimensions: rule violations (2x), behavioral, temporal, scope creep
      └─ composite score (0-1), label (normal/elevated/high/critical), escalated flag
      └─ never modifies the decision — pure observation
  → [on approve] SigningProvider.dispatch(wallet.metadata.signingProvider)
      ├─ "local"     → OwsLocalVaultService.signMessage()
      ├─ "ledger"    → LedgerSigningProvider.sign()  ← DMK, device must confirm
      ├─ "speculos"  → OwsLocalVaultService.signWithExternalWallet(Speculos HTTP API)
      └─ "ows_remote"→ OwsLocalVaultService.signWithExternalWallet(remote URL)
  → AuditLogService.logAction()
  → [optional] Filecoin / 0G evidence anchoring
  → [optional] X Layer execution dispatch via Hyperlane Mailbox
```

Implementation files:
- `src/backend/modules/api/controllers/GovernanceController.ts` — HTTP entry point
- `src/backend/services/PolicyEnforcementService.ts` — Rule evaluation, delegates to Fhenix/ChainGPT
- `src/backend/services/AuditLogService.ts` — CRE-backed evidence records
- `src/backend/services/FhenixPolicyService.ts` — Encrypted policy evaluation via CoFHE SDK
- `src/backend/services/ChainGPTAuditService.ts` — Runtime smart contract vulnerability scanning
- `src/backend/services/ControlEvaluationService.ts` — Parallel suspicion scoring (gated by `CONTROL_EVAL_MODE`)

## Network Roles

| Partner | Role | Status |
|---|---|---|
| **Fhenix** | Confidential policy evaluation via FHE. Budgets, limits, and spend counters remain encrypted. | Live (Arbitrum Sepolia) |
| **X Layer** | Governed execution dispatch path. Approved spends dispatched here for execution and public anchoring. | Testnet (chainId 1952) |
| **Filecoin** | Durable evidence anchoring for audit logs via `FilecoinStorageService` → FVM. | Live (Calibration testnet) |
| **0G** | Primary agent-economy rail. On-chain governance + vault, evidence anchoring, agent-to-agent settlement, Agentic ID (ERC-7857). | Newton testnet; mainnet Wave 3 |
| **ChainGPT** | Web3-specialized LLM for smart contract auditing and governance queries. | Live |
| **Ledger DMK** | Hardware signing for high-value transactions. | Live |
| **MongoDB** | Persistent agent memory & run ledger. | Optional, gated by `MONGODB_URI` |

## Fhenix Integration — Confidential Policy Evaluation

Fhenix (CoFHE) lets Cognivern evaluate policy on **encrypted state** — budgets, spend counters, and vendor allowlists never appear in plaintext. Only the decision (approve/hold/deny) is revealed.

### Layered Architecture

| Layer | Chain | Role |
|-------|-------|------|
| Execution & Public Policy Anchoring | X Layer Testnet (1952) | `GovernanceContract`, `AIGovernanceStorage` |
| Live Audit Anchoring | 0G Newton Testnet | Real-time governance decision anchoring |
| Audit Archive | Filecoin Calibration | Long-term immutable audit storage |
| **Confidential Policy State** | **Fhenix (Arbitrum Sepolia)** | Encrypted budgets, encrypted spend counters, FHE-evaluated policy checks |

Cross-chain: Fhenix computes the encrypted decision → Hyperlane Mailbox dispatches to X Layer → `GovernanceContract.handle()` consumes for execution and public anchoring.

### What Gets Encrypted

| Concept | Without Fhenix | With Fhenix |
|---------|---------------|-------------|
| Per-agent daily budget | `uint256` in policy JSON | `euint128` on Fhenix |
| Spend counter | In-memory counter | `euint128` on Fhenix |
| Vendor allowlist | `string[]` | `ebool` via encrypted set |
| Amount in `/api/spend` | Plaintext | Client-side encrypted via `@cofhe/sdk` |

### Configuration

```env
FHENIX_RPC_URL=https://api.testnet.fhenix.zone
FHENIX_POLICY_CONTRACT=0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE
FHENIX_PRIVATE_KEY=             # Falls back to FILECOIN_PRIVATE_KEY
FHENIX_CHAIN_ID=421614          # Arbitrum Sepolia
FHENIX_EVALUATE_TIMEOUT_MS=30000
```

### Key Contracts

| Contract | Address | Network |
|----------|---------|---------|
| `ConfidentialSpendPolicy` | `0x710005F7454B8756F7E1118B26d1361b001fc818` | Arbitrum Sepolia |
| `GovernanceContract` | `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` | Arbitrum Sepolia |
| `GovernedVault` | `0x468F1CfBB5bec9352b279192a952916610f58BB4` | Arbitrum Sepolia |

### Async FHE Flow

FHE evaluations take 10-30 seconds. The system handles this asynchronously:

1. `POST /api/governance/evaluate` returns `202 Accepted` with `runId` when `policy.metadata.confidential === true`
2. Background workflow runs 4 steps: `load_policy` → `encrypt_params` → `submit_to_fhenix` → `record_audit`
3. Each step streams via SSE at `GET /api/cre/runs/:runId/events/stream`
4. Frontend shows animated 4-step progress panel
5. `GET /api/governance/evaluate/:runId/result` provides a fallback fetch

Code: `contracts/fhenix/src/ConfidentialSpendPolicy.sol`, `src/backend/services/FhenixPolicyService.ts`, `src/backend/cre/workflows/governance.ts`, `src/frontend/src/hooks/use-fhe-progress.ts`

## ChainGPT Integration — Web3 AI Governance

ChainGPT provides Web3-specialized LLM capabilities for governance analysis and runtime smart contract auditing.

| Capability | Where | Config |
|-----------|-------|--------|
| **Web3 LLM Provider** — Routes Web3 queries (sanction checks, calldata decoding, contract analysis) via `MultiModelRouter` | `src/backend/modules/cloudflare-agents/MultiModelRouter.ts` | `CHAINGPT_API_KEY` |
| **Smart Contract Auditor** — Pre-spend vulnerability scan. Triggered by `contract_audit` rule type. Returns approve/hold/deny by severity (critical/high=deny, medium=hold, low=approve) | `src/backend/services/ChainGPTAuditService.ts` | `CHAINGPT_API_KEY`, `CHAINGPT_AUDIT_TIMEOUT_MS`, `CHAINGPT_AUDIT_CACHE_TTL_MS` |
| **News-driven Policy Auto-Adjustment** — Breaking news from ChainGPT webhooks auto-flips matching policies to hold | `src/backend/services/NewsPolicyAdjuster.ts` | Webhook: `POST /api/webhooks/chain-gpt-news` |

```env
CHAINGPT_API_KEY=your_api_key_here
CHAINGPT_BASE_URL=https://api.chaingpt.org
CHAINGPT_AUDIT_TIMEOUT_MS=30000
CHAINGPT_AUDIT_CACHE_TTL_MS=300000
```

Flow: agent submits spend targeting a contract → `PolicyEnforcementService` evaluates `contract_audit` rule → `ChainGPTAuditService.auditContract()` runs vulnerability scan → decision by severity → audit trail records verdict with score and findings.

## Ledger Integration — Hardware Signing

The `SigningProvider` interface in `src/backend/signing/SigningProvider.ts` defines a 3-method contract. Dispatch happens in `OwsWalletService.handleApprove()` based on `wallet.metadata.signingProvider`:

| Provider | Value | Backend | Use Case |
|----------|-------|---------|----------|
| **Local** | `"local"` (default) | `OwsLocalVaultService.signMessage()` | Development, low-value |
| **OWS Remote** | `"ows_remote"` | `OwsLocalVaultService.signWithExternalWallet()` | Multi-instance |
| **Ledger DMK** | `"ledger"` | `LedgerSigningProvider` (`@ledgerhq/device-management-kit`) | Production high-value, hardware-gated |
| **Speculos** | `"speculos"` | `OwsLocalVaultService.signWithExternalWallet()` via HTTP | Sandbox/CI |

Wallet metadata:
```typescript
{ metadata: {} }                                           // Local (default)
{ metadata: { signingProvider: "ledger" } }                // Ledger hardware
{ metadata: { signingProvider: "speculos", externalSource: "http://speculos:5000" } }  // Sandbox
```

Speculos runs as a Docker container (`deploy/docker-compose.yml`, `profiles: ["sandbox"]`). This lets CI run full governance→signing→audit cycles with hardware-accurate signing but zero asset risk.

Dependencies: `@ledgerhq/device-management-kit`, `@ledgerhq/device-signer-kit-ethereum`, `@ledgerhq/device-transport-kit-node-hid`, `@ledgerhq/device-transport-kit-speculos`, `rxjs`

## Native Agents — Governed Spend Integration

Cognivern's two native trading agents (`SapienceTradingAgent` and `UserTradingAgent`) route their actions through the same `/api/governance/evaluate → /api/spend/preview → /api/spend` flow used by external API callers. One policy engine, one audit log, one source of truth.

### Sapience Trading Cycle

`SapienceTradingAgent.runCycleWithGovernance()` is the canonical entry point:

1. **Fetch condition** — Sapience GraphQL for an open, public condition
2. **Generate forecast** — multi-provider LLM produces probability + reasoning
3. **Governance: forecast attestation** — `GovernanceClient.evaluate()` posts to `/api/governance/evaluate`. Policy blocks if gas cost > $1
4. **Submit attestation** — on approval, EAS attestation published on Arbitrum
5. **Fetch market price** — if confidence ≥ 0.6, get YES/NO price from Sapience
6. **Compute edge** — if `|edge| ≤ 0.1`, skip trade
7. **Governance: trade preview** — `GovernanceClient.previewSpend()` with 10 USDe. Policy enforces vendor, asset, per-trade cap (50 USDe), daily cap (200 USDe), confidence ≥ 0.3, forecast < 1h old, human confirm for ≥ 10 USDe
8. **Human confirmation gate** — if required, looks for `SAPIENCE_HUMAN_CONFIRM_TOKEN`. Absent → trade held
9. **Execute on Sapience** — `SapienceService.executeTrade()` calls `prepareForTrade` then `mint`
10. **Verify audit** — `GovernanceClient.recentAudit()` confirms trade was logged

### Failure Modes

- **Governance API unreachable** — agent fails closed. No trade executes.
- **Preview denied** — trade not executed, denial recorded in audit log
- **Held for confirmation** — trade not executed, hold recorded. Operator sets `SAPIENCE_HUMAN_CONFIRM_TOKEN` or confirms via UI
- **LLM providers exhausted** — falls back to 50% probability, typically no edge → no trade

### Configuration

| Env var | Default | Purpose |
|---|---|---|
| `COGNIVERN_SELF_BASE_URL` | `http://localhost:3000` | URL agents use to call their own governance API |
| `COGNIVERN_API_KEY` | (required) | API key for governance calls |
| `SAPIENCE_HUMAN_CONFIRM_TOKEN` | unset | Static token for trades ≥ 10 USDe |
| `SAPIENCE_ENABLED` | `false` | Toggle Sapience agent registration on startup |

## Mode System

| Mode | Auth Required | Data Source | UI Indicator |
|---|---|---|---|
| **Demo** | No | Client-side demo data + backend `DemoDataService` | Amber "Demo Mode" badge |
| **Sandbox** | Yes | Backend `WorkspaceDataService` with `X-Workspace-Mode: sandbox` header | Sandbox/Production toggle |
| **Production** | Yes | Backend `WorkspaceDataService` (live SQLite) | "Live Workspace" green banner |

Mode resolution (`demoInterceptor.ts`): workspace `tier` stored in SQLite (`'demo'` or `'live'`). If `tier === 'demo'`, backend always serves demo data. If `tier === 'live'`, the `X-Workspace-Mode` header selects data source.

## Key Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/ingest/runs` | POST | Project-scoped run ingestion |
| `/api/governance/policies` | GET, POST | Policy management |
| `/api/governance/policies/confidential` | POST | Create encrypted policy on Fhenix |
| `/api/governance/evaluate` | POST | Evaluate action against policy |
| `/api/governance/decisions/:decisionId` | GET | FHE decision + cross-chain anchoring status |
| `/api/ows/bootstrap` | POST | Bootstrap OWS wallet |
| `/api/ows/api-keys` | GET, POST | API key management |
| `/api/spend` | POST | Execute governed spend |
| `/api/spend/encrypted` | POST | Submit pre-encrypted spend (FHE) |
| `/api/spend/preview` | POST | Simulate spend (dry-run) |
| `/api/audit/logs` | GET | Audit trail |
| `/api/audit/permits` | POST | Issue auditor decryption permit (CoFHE) |
| `/api/audit/logs/:decisionId/decrypt` | GET | Auditor decrypt with valid permit |
| `/api/audit/insights` | GET | Audit insights (supports `?dimension=ai_spend` and `?dimension=suspicion`) |
| `/api/cre/runs` | GET | Run ledger |
| `/api/cre/runs/:runId` | GET | Run details |
| `/api/copilot/runs` | GET, POST | Copilot missions |
| `/api/copilot/runs/:runId/confirm` | POST | Operator approve/deny decision |
| `/api/copilot/runs/:runId/events/stream` | GET | SSE event stream |
| `/api/intent` | POST | Natural language intent processing |

## Storage Architecture

| Store | File | Purpose |
|---|---|---|
| `RateLimitStore` | `rate-limit-store.jsonl` | Per-workspace and per-key rate limiting |
| `TokenBlacklistStore` | `token-blacklist.jsonl` | JWT token revocation |
| `UxEventStore` | `ux-events.jsonl` | UX telemetry events |
| `CreRunStore` | `cre-runs.jsonl` (+ MongoDB optional) | Core Run Engine evidence ledger |
| `CopilotRunStore` | SQLite (`copilot_runs` + `copilot_events`) | Live demo mission runs + event streams |
| `MongoDbCreRunPersistence` | MongoDB `cre_runs` | Durable run ledger (optional, `MONGODB_URI`) |
| `MongoDbMemoryService` | MongoDB `agent_memory` | Cross-session agent memory (optional) |

All file-backed stores use a common `BaseStore` abstract class. To swap to Redis/Postgres/MongoDB: implement the same interface on a new adapter and replace the singleton import.

**Policy persistence** uses `PolicyPersistence` interface — `InMemoryPolicyPersistence` (default) or `MongoDbPolicyPersistence` (when `MONGODB_URI` is set). Bundled `.json` policies from `src/backend/policies/` are seeded on init.

## Security Architecture

| Layer | Protection |
|---|---|
| Auth | SIWE + JWT with nonce replay protection |
| API Keys | scrypt hashed, workspace-scoped permissions |
| Rate Limiting | 3 layers (global, workspace, per-endpoint) |
| Encryption | Fhenix FHE on-chain evaluation (confidential policies) |
| Audit | Immutable records on 0G + Filecoin (dual-anchor) |
| Contract Audit | ChainGPT runtime scan on recipient contracts |

## Current Limitations

- File-backed stores are single-instance — need Redis/Postgres before horizontal scaling
- Email auth supported alongside SIWE; SIWE path is more battle-tested
- Ledger signing requires USB/WebHID access — limits deployment to single-instance or co-located with hardware
- See [Operations](./OPS.md) for deployment and operations

## Related Docs

- [Developer Guide](./DEVELOPER.md) — Local setup, APIs, testing, production readiness
- [Operations](./OPS.md) — Production deployment, PM2, incident response
