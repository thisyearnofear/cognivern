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

The signing layer is abstracted behind a `SigningProvider` interface. The default provider uses the local OWS vault (`OwsLocalVaultService`). Alternative providers — **Ledger DMK** (hardware signing for high-value transactions) and **Speculos** (emulated signing for sandbox/CI) — slot in without changing the governance or audit path. See [Signing Provider Abstraction](#signing-provider-abstraction).

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
  +--> approve → SigningProvider.dispatch()  ← Ledger / Speculos / Local / OWS Remote
  +--> hold    → human or second wallet approves
  +--> deny    → no signing
  |
  v
Cognivern Audit + Run Ledger
  ├── AuditLogService.logAction() — every decision recorded, reasons preserved
  ├── [optional] Filecoin evidence anchoring — durable audit storage
  └── [optional] X Layer execution dispatch via Hyperlane
```

## Canonical Decision Lifecycle

Every governance decision follows this path through the codebase:

```
Agent action
  → GovernanceController.evaluateAction()
  → PolicyEnforcementService.evaluateRule()
      ├─ standard rule → local evaluation (allow/deny/require/rate_limit)
      ├─ confidential rule → FhenixPolicyService → Fhenix FHE
      └─ contract_audit rule → ChainGPTAuditService
  → decision: approve / hold / deny
  → [on approve] SigningProvider.dispatch(wallet.metadata.signingProvider)
      ├─ "local"     → OwsLocalVaultService.signMessage()
      ├─ "ledger"    → LedgerSigningProvider.sign()  ← DMK, device must confirm
      ├─ "speculos"  → OwsLocalVaultService.signWithExternalWallet(Speculos HTTP API)
      └─ "ows_remote"→ OwsLocalVaultService.signWithExternalWallet(remote URL)
  → AuditLogService.logAction()
  → [optional] Filecoin evidence anchoring via ZeroGStorageService
  → [optional] X Layer execution dispatch via HyperlaneRelayerService
```

This is the actual code path — not an aspirational design. It is implemented across:

- **`src/backend/modules/api/controllers/GovernanceController.ts`** — HTTP entry point, resolves active policy, calls enforcement
- **`src/backend/services/PolicyEnforcementService.ts`** — Evaluates rules one-by-one, delegates confidential rules to Fhenix, delegates contract audit to ChainGPT
- **`src/backend/services/AuditLogService.ts`** — Persists every decision as a CRE-backed evidence record
- **`src/backend/services/FhenixPolicyService.ts`** — Encrypted policy evaluation using CoFHE SDK
- **`src/backend/services/ChainGPTAuditService.ts`** — Runtime smart contract vulnerability scanning

## Existing Building Blocks

### 1. Ingestion — `POST /ingest/runs`

Project-scoped run submission with ingest key validation, quota metering, and normalized run capture for downstream UI.

### 2. Governance Evaluation

`GovernanceController` exposes policy CRUD and evaluation:

- `GET/POST /api/governance/policies`
- `POST /api/governance/evaluate`

`PolicyEnforcementService` loads the active policy and evaluates actions rule by rule, returning structured allow/deny decisions with per-rule checks.

### 3. Audit & Run Ledger

`AuditLogService` converts actions and events into CRE-backed evidence records.

`CreController` exposes run lists, details, event streams, retries, approvals, and plan updates.

### 4. OWS Wallet Layer

`OwsLocalVaultService` stores encrypted local wallets, issues delegated API keys, and resolves wallet access for spend execution.

`OwsWalletService` exposes `/api/spend`, enforces spend policies, produces approve/hold/deny outcomes, signs approved spend envelopes, and persists runs to the CRE ledger.

### 5. Signing Provider Abstraction

The signing layer is swappable via a `SigningProvider` interface. The dispatch happens in `OwsWalletService.handleApprove()` based on `wallet.metadata.signingProvider`:

| Provider | Value | Backend | Use Case |
|---|---|---|---|
| **Local** | `"local"` (default) | `OwsLocalVaultService.signMessage()` — decrypted local key | Development, low-value, personal agents |
| **OWS Remote** | `"ows_remote"` | `OwsLocalVaultService.signWithExternalWallet()` — HTTP POST to remote signing service | Multi-instance deployments |
| **Ledger DMK** | `"ledger"` | `LedgerSigningProvider` — `@ledgerhq/device-management-kit` via USB/WebHID | Production high-value transactions, hardware-gated |
| **Speculos** | `"speculos"` | `OwsLocalVaultService.signWithExternalWallet()` — HTTP POST to Speculos API | Sandbox/CI, no hardware needed |

The backend wallet descriptor (`OwsWalletDescriptor.metadata`) carries the provider selection:

```typescript
// Local wallet (existing)
{ metadata: {} }

// Ledger hardware wallet
{ metadata: { signingProvider: "ledger" } }

// Speculos emulated wallet (sandbox)
{ metadata: { signingProvider: "speculos", externalSource: "http://speculos:5000" } }
```

**Sandbox integration:** Speculos runs as a Docker container alongside the backend. In sandbox mode (controlled by `demoInterceptor.ts`), wallets are created with `signingProvider: "speculos"` and `externalSource` pointing at the Speculos HTTP API. The existing `signWithExternalWallet()` method handles the HTTP transport — zero new code for the basic case. This lets CI run full governance→signing→audit cycles with hardware-accurate signing but zero asset risk.

**Production Ledger flow:** An agent requests a high-value spend → policy evaluates and approves → `handleApprove()` dispatches to `LedgerSigningProvider` → DMK discovers the device → user confirms on physical Ledger → signature returned → audit-logged as before. The governance and audit pipeline never changes — only the signing step swaps.

### 6. Frontend Control Plane

The frontend contains surfaces for policy management, audit logs, run ledger, agent monitoring, governance checks, and the Command Center terminal UI.

## Network Roles

Each partner network plays a specific role in the product. This table is the single source of truth — all other docs and UI descriptions reference it.

| Partner | Role in product | User-visible? | Status |
|---|---|---|---|
| **Fhenix** | Confidential policy evaluation via FHE. Budgets, limits, and spend counters remain encrypted throughout evaluation. | Yes — FHE shield badge on audit decisions | **Live** (Fhenix testnet: Arbitrum Sepolia / Base Sepolia) |
| **X Layer** | Governed execution dispatch path. After policy evaluation, approved spends are dispatched here for execution and public anchoring. | Yes — in decision audit trail via Hyperlane | Testnet (chainId 1952) |
| **Filecoin** | Durable evidence anchoring for audit logs. Long-term immutable storage of governance decisions and evidence hashes. | Yes — evidence link per decision in audit entry | Calibration testnet |
| **0G** | Real-time governance decision anchoring alongside Filecoin for immediate availability. | Transparently layered with Filecoin | Newton testnet |
| **ChainGPT** | Web3-specialized LLM for smart contract auditing at runtime (pre-spend vulnerability scan) and governance-copilot queries. | Yes — Contract Audit badge on policy checks with ChainGPT metadata | **Live** — via `ChainGPTAuditService` |
| **Speculos** | Ledger device emulator for sandbox/CI signing. Runs as a Docker container; acts as an HTTP signing endpoint for the existing `signWithExternalWallet()` path. | No — infra only | **Live** — Docker Compose sandbox profile |
| **Ledger DMK** | Hardware signing provider for high-value transactions. User confirms on physical Ledger device before any signature is produced. | Yes — "Hardware Signed" badge on audit decisions | **Live** — `LedgerSigningProvider` (DMK) |
| **MongoDB** | Persistent agent memory & run ledger. Replaces JSONL files with queryable, durable storage. | Yes — powers agent recall and run history | **Live** — optional, gated by `MONGODB_URI` |

## Confidential Policy Layer (Fhenix)

Confidential policy evaluation uses Fully Homomorphic Encryption on Fhenix (CoFHE):

- **`ConfidentialSpendPolicy.sol`** on Fhenix holds encrypted budgets (`euint128`), encrypted spend counters, and encrypted approval thresholds.
- **`FhenixPolicyService.ts`** wraps `@cofhe/sdk` to evaluate encrypted amounts, submit to Fhenix, and unseal data for auditors.
- **Cross-chain flow (via Hyperlane):** Fhenix emits a decision attestation → Hyperlane Mailbox dispatches it → X Layer `GovernanceContract.handle()` consumes it for execution and public anchoring.
- **Encrypted state never leaves Fhenix:** Only the verified outcome (Approved/Denied/Held) crosses chains.
- **Selective disclosure:** Auditor permits issued via the dashboard allow scoped decryption of confidential audit logs.

Policies opt in via a `confidential: true` flag in their metadata.

See [Fhenix Integration](./FHENIX_INTEGRATION.md) for full details.

## Data Flow

```
External Agents / Services
        |
        |  POST /ingest/runs
        v
  IngestController
        |
        v
    CRE Run Store  <-------------------------------+
        |                                          |
        v                                          |
 AuditLogService  <---- GovernanceController ------+
        |                   |
        |                   | evaluate action
        |                   v
        |           PolicyEnforcementService
        |              ├── standard → evaluateRule()
        |              ├── confidential → FhenixPolicyService
        |              └── contract_audit → ChainGPTAuditService
        |                   |
        |                   v
        |              PolicyService
        |
        v
  UI / Operator Views
    ├── AuditPage — expandable rows, per-rule breakdown, FHE badge
    ├── Dashboard — stat cards with live latency, approval rate, blocked
    └── GovernanceCheck — NL input, voice, evaluate against active policy
```

## Mode System

Cognivern operates in three distinct modes:

| Mode | Auth Required | Data Source | UI Indicator |
|---|---|---|---|
| **Demo** | No | Client-side demo data (`demo-data.ts`) + backend `DemoDataService` | Amber "Demo Mode" badge in sidebar |
| **Sandbox** | Yes (wallet or email) | Backend `WorkspaceDataService` (canned/test data) with `X-Workspace-Mode: sandbox` header | Sandbox/Production toggle in workspace switcher |
| **Production** | Yes (wallet or email) | Backend `WorkspaceDataService` (live SQLite) | "Live Workspace" green banner |

**Mode resolution (single source of truth in `demoInterceptor.ts`):**

1. Workspace `tier` is stored in SQLite — `'demo'` or `'live'`
2. If `tier === 'demo'`, the backend always serves demo data regardless of the `X-Workspace-Mode` header
3. If `tier === 'live'`, the `X-Workspace-Mode` header (`sandbox` | `production`) selects the data source
4. Self-service upgrade from `demo` to `live` is available in Settings → Workspace → "Go Live"

**Frontend mode store (`demo-store.ts`):**
- `useDemoStore` controls the demo flag independently of auth state
- `login()` automatically exits demo mode
- The `DemoBanner` component shows workspace status in the header

## Key Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/ingest/runs` | POST | Project-scoped run ingestion |
| `/api/governance/policies` | GET, POST | Policy management |
| `/api/governance/policies/confidential` | POST | Create encrypted policy on Fhenix |
| `/api/governance/evaluate` | POST | Evaluate action against policy (core decision lifecycle) |
| `/api/governance/decisions/:decisionId` | GET | FHE decision + cross-chain anchoring status |
| `/api/ows/bootstrap` | POST | Bootstrap OWS wallet |
| `/api/ows/api-keys` | GET, POST | API key management |
| `/api/ows/wallets` | GET | List wallets |
| `/api/spend` | POST | Execute governed spend |
| `/api/spend/encrypted` | POST | Submit pre-encrypted spend (FHE) |
| `/api/spend/preview` | POST | Simulate spend (dry-run) |
| `/api/spend/status` | GET | Execution layer status |
| `/api/audit/logs` | GET | Audit trail |
| `/api/audit/permits` | POST | Issue auditor decryption permit (CoFHE) |
| `/api/audit/logs/:decisionId/decrypt` | GET | Auditor decrypt with valid permit |
| `/api/audit/insights` | GET | Audit insights |
| `/api/cre/runs` | GET | Run ledger |
| `/api/cre/runs/:runId` | GET | Run details |
| `/api/projects` | GET | Project list |
| `/api/projects/:projectId/usage` | GET | Project usage |
| `/api/payroll/confidential` | POST | Privara confidential payroll |
| `/api/fhenix/encrypt` | POST | Trusted encryption sidecar (non-TS agents) |
| `/api/intent` | POST | Natural language intent processing |

## Storage Architecture

File-backed stores are built on a common `BaseStore` abstract class that provides:

- Lazy file loading (JSON/JSONL)
- TTL-based expiration
- Max-record limits
- Atomic read/write operations

| Store | File | Purpose |
|---|---|---|
| `RateLimitStore` | `rate-limit-store.jsonl` | Per-workspace and per-key rate limiting with sliding windows |
| `TokenBlacklistStore` | `token-blacklist.jsonl` | JWT token revocation blacklist |
| `UxEventStore` | `ux-events.jsonl` | UX telemetry events |
| `CreRunStore` | `cre-runs.jsonl` (+ MongoDB optional) | Core Run Engine evidence ledger (via `CreRunPersistence` interface). Conditionally writes to MongoDB when `MONGODB_URI` is set |
| `IdempotencyStore` | file-backed with TTL | Idempotency key tracking |

The `BaseStore<T, R>` interface accepts a config for file path (via env var or default), max records, and TTL. Subclasses override `parseLine()` and `serializeRecord()`.

To swap to Redis, Postgres, or MongoDB: implement the same interface on a new adapter and replace the singleton import — no callers change.

**MongoDB-backed services:**

| Service | File | Collection | Purpose |
|---|---|---|---|
| `MongoDbCreRunPersistence` | `src/backend/cre/storage/MongoDbCreRunPersistence.ts` | `cre_runs` | Durable run ledger alongside JSONL hot cache |
| `MongoDbMemoryService` | `src/backend/services/MongoDbMemoryService.ts` | `agent_memory` | Cross-session agent memory (store, retrieve, query by agentId/type) |

Both are lazy-connected and gracefully degrade when `MONGODB_URI` is unset — zero config required for existing JSONL-only users.

## Async FHE Evaluation (Live)

Fhenix FHE evaluations can take 10-30 seconds (CoFHE encryption + on-chain confirmation). The async UX is now implemented:

1. Backend checks `policy.metadata.confidential === true` on evaluate
2. Returns `202 Accepted` with `{ runId, status: "running", type: "fhe_evaluation" }`
3. Background workflow (`src/backend/cre/workflows/governance.ts`) tracks progress via `CreRunRecorder` with 4 steps:
   - `load_policy` — load the active policy
   - `encrypt_params` — encrypt spend parameters via CoFHE SDK
   - `submit_to_fhenix` — submit to Fhenix contract and wait for on-chain confirmation
   - `record_audit` — persist the decision to the audit log
4. Each step is persisted to `CreRunStore` as it completes, so the existing SSE endpoint (`GET /api/cre/runs/:runId/events/stream`) streams live progress
5. Frontend connects to SSE via `fetch` + `ReadableStream` (not native `EventSource`, which lacks auth header support) and shows an animated 4-step progress panel
6. When `run_finished` arrives with the result payload, the UI transitions to the decision panel
7. `GET /api/governance/evaluate/:runId/result` provides a fallback to fetch the completed result
8. Standard (non-confidential) evaluations remain synchronous via the existing path

**Implementation files:**
- `src/backend/cre/workflows/governance.ts` — background evaluation with CreRunRecorder
- `src/backend/modules/api/controllers/GovernanceController.ts` — 202 dispatch for confidential policies
- `src/frontend/src/hooks/use-fhe-progress.ts` — shared React hook for step tracking and SSE connection
- `src/frontend/src/components/governance/governance-check.tsx` — full-page governance check with FHE progress panel
- `src/frontend/src/components/onboarding/onboarding-wizard.tsx` — compact inline governance check with same FHE support

## Persistence Layer

### PolicyPersistence

Policies are persisted through a `PolicyPersistence` interface (analogous to `CreRunPersistence`):

| Implementation | Location | Storage |
|----------------|----------|---------|
| `InMemoryPolicyPersistence` | `src/backend/persistence/PolicyPersistence.ts` | In-memory `Map` (default) |
| `MongoDbPolicyPersistence` | `src/backend/persistence/MongoDbPolicyPersistence.ts` | MongoDB `policies` collection |

`PolicyService` delegates all CRUD to the injected backend, selected conditionally at startup:
- Default → `InMemoryPolicyPersistence` (same behavior as before)
- `MONGODB_URI` set → `MongoDbPolicyPersistence`

Bundled `.json` policies (from `src/backend/policies/`) are seeded on init with duplicate-ID skip. See `src/backend/persistence/PolicyPersistence.ts`.

## Cross-Cutting Refactors

### Logging Consolidation

Two logging systems existed: `src/backend/utils/logger.ts` (default export, 32 importers) and `src/backend/shared/logging/Logger.ts` (class + facade, 18 importers). They were consolidated by making `utils/logger.ts` re-export from the shared `Logger.ts` facade. All 32 importers continue to work unchanged; the shared `Logger` class had its `LogContext` type loosened to `any` to match winston's native flexibility.

### Circuit Breaker Consolidation

Three circuit breaker implementations were consolidated into one:

| Old Implementation | Location | Disposition |
|-------------------|----------|-------------|
| Standalone `CircuitBreaker` class | `src/backend/shared/utils/circuitBreaker.ts` | **Kept** — canonical implementation |
| `BaseService.withCircuitBreaker()` | `src/backend/shared/services/BaseService.ts` | **Removed** — 104 lines, no subclass called it |
| Inline breaker in `IntentController` | `src/backend/modules/api/controllers/IntentController.ts` | **Refactored** — now uses the standalone `CircuitBreaker` class |

The single `CircuitBreaker` class was extended with public `recordFailure()`/`reset()` methods to support the explicit-failure-recording pattern used by `IntentController`.

## Current Limitations

- File-backed stores (rate limiting, idempotency, telemetry) are single-instance — need Redis/Postgres before horizontal scaling. The `BaseStore` interface exists to make this a single-adapter swap.
- Email auth is supported alongside SIWE (wallet-primary); the SIWE path is more battle-tested in production.
- **Ledger signing requires USB/WebHID access**, which limits deployment to single-instance or co-located with the hardware. The Speculos sandbox path avoids this in testing.
- See the [Deployment Guide](./DEPLOYMENT.md) for operations

## Security Architecture

The product implements layered security:

| Layer | Protection |
|---|---|
| Auth | SIWE + JWT with nonce replay protection |
| API Keys | scrypt hashed, workspace-scoped permissions |
| Rate Limiting | 3 layers (global, workspace, per-endpoint) |
| Encryption | Fhenix FHE on-chain evaluation (confidential policies) |
| Audit | Immutable records on Filecoin / 0G |
| Contract Audit | ChainGPT runtime scan on recipient contracts |

## Related Docs

- [Developer Guide](./DEVELOPER.md) — APIs, local setup, testing
- [Deployment](./DEPLOYMENT.md) — Production deployment and operations
- [Fhenix Integration](./FHENIX_INTEGRATION.md) — Encrypted policy evaluation
- [ChainGPT Integration](./CHAINGPT_INTEGRATION.md) — Web3 AI governance & contract auditing
- [Ledger Integration](./LEDGER_INTEGRATION.md) — Hardware signing provider, Speculos sandbox, implementation plan
