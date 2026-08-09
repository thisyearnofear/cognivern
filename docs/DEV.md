# Developer Guide

Architecture, local setup, API reference, testing, and production readiness for Cognivern.

## Getting Started (No Code Required)

Try Cognivern without connecting a wallet:

1. Go to **[cognivern.persidian.com](https://cognivern.persidian.com)**
2. Use the guided demo CTA — no signup needed for the public/demo path
3. You'll land in a sandbox with sample policies and pre-filled spend examples

For moderated user sessions, use the [Tester Guide](./TESTER_GUIDE.md).
Authenticated research requires a disposable workspace or staging environment;
do not use production credentials, real funds, or another user's workspace.

From the demo you can preview spends, adjust policy sliders, and view the audit trail.

### Production Setup

1. **Create workspace** — Sign in, enter workspace name, get an API key
2. **Register agent** — Dashboard → "Create Agent" → pick a template or fill manually
3. **Set policy** — Choose Strict (<$100/day), Moderate (<$1K/day), or Open, or create custom rules (daily limit, per-tx limit, vendor allowlist, contract blocklist, time window)
4. **Connect agent** — Give your agent the Agent ID and API key:

```bash
curl -X POST https://api.cognivern.persidian.com/api/governance/evaluate \
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

# HydraDB — optional agentic-memory / cross-source retrieval (free tier).
# When HYDRADB_ENABLED=false (default), all HydraDB services no-op.
# See docs/HYDRADB.md.
HYDRADB_ENABLED=false
HYDRADB_API_KEY=                # Optional — get one at https://app.hydradb.com
HYDRADB_DATABASE=cognivern
HYDRADB_DEFAULT_MODE=auto       # auto | fast | thinking
```

Fhenix variables can be left empty for local dev — the service falls back to a deny decision when CoFHE is unavailable. AI provider keys enable natural language intent; without them, keyword-based fallback is used.

### Smart Contracts

```bash
npx hardhat compile
npx hardhat run tooling/scripts/deploy/deploy-hardhat.cjs --network calibration
```

Deployment outputs contract addresses to add to `.env`. See [Deployment](./DEPLOYMENT.md) for deployment details.

### Workspace Structure

pnpm monorepo with three packages:

| Package        | Path           | Purpose                       |
| -------------- | -------------- | ----------------------------- |
| Root (backend) | `.`            | Express API, agents, services |
| Frontend       | `src/frontend` | React dashboard               |
| Contracts      | `contracts`    | Hardhat Solidity contracts    |

## System Architecture

### Mission

**Make autonomous work fundable.**

Cognivern is the economic control plane for agentic work. It gives a business a
bounded mandate for an autonomous workflow, governs the capital and execution
inside that mandate, and preserves the evidence needed to understand what the
work produced.

The current implementation is strongest at governed execution and audit:
policy checks, approvals, wallet boundaries, run records, source provenance,
transaction evidence, and observability. Complete outcome accounting, causal
ROI attribution, external agent investment, and credit underwriting are future
layers—not current product claims.

The strategic lifecycle is:

```text
funded mandate → governed actions → attributable spend → evidenced outcome → allocation decision
```

See [`AGENTIC_CAPITAL_THESIS.md`](./AGENTIC_CAPITAL_THESIS.md) for the product
and distribution strategy. See
[`AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md`](./AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md)
for the mandate, outcome, statement, and evidence invariants before extending
capital attribution.

### Responsibility Boundary

| OWS Owns                   | Cognivern Owns                                           | Swappable Via           |
| -------------------------- | -------------------------------------------------------- | ----------------------- |
| Wallet storage             | Policy semantics and governed execution                  | —                       |
| API-key issuance           | Approval workflows and spend/run evidence                | —                       |
| Transaction signing        | Run ledger and audit evidence; outcome links are roadmap | SigningProvider adapter |
| Signing policy enforcement | Allocation analytics and reporting (roadmap)             | —                       |

### System Overview

```
Agent
  |
  | intended spend / sign request
  v
Cognivern Evaluation Layer
  |
  ├── GovernanceController.evaluateAction()
  │   ├── standard rule → WorkspaceDataService.evaluateAction()
  │   │   └── evaluateRule() — amount, daily_total, budget, allowlist, chain
  │   ├── confidential rule → FhenixPolicyService → Fhenix FHE
  │   └── contract_audit rule → ChainGPTAuditService
  │   └── recordSpend() — updates agent.spend_history + trades counter
  │
  ├── [optional] ControlEvaluationService.score()  ← CONTROL_EVAL_MODE=true
  │   └─ 4-dimension suspicion score (0-1), never blocks the decision
  │
  +--> approve → SigningProvider.dispatch()  ← Ledger / Speculos / Local / OWS Remote
  +--> hold    → human or second wallet approves
  +--> deny    → no signing
  |
  v
Cognivern Audit + Run Ledger
  ├── AuditLogService.logAction() — every decision recorded, reasons preserved
  ├── Tamper-evident hash-chained mutation ledger (CreLedgerChain) — every
  │     add/replace is hash-linked; verify() detects edited runs + broken links
  ├── [optional] Suspicion evidence persisted to CreRun.evidence.suspicion
  ├── [optional] Filecoin evidence anchoring via FilecoinStorageService (FVM AIGovernanceStorage)
  ├── [optional] 0G Storage evidence anchoring via ZeroGStorageService (indexer
  │     upload, gated by ZEROG_PRIVATE_KEY; deep-verify re-fetches + hash-compares)
  ├── [optional] 0G on-chain decision proof via ZeroGProofService (GovernanceProof
  │     contract — GovernanceDecision events on Galileo, verifiable on ChainScan)
  └── [optional] X Layer execution dispatch via Hyperlane
```

#### Tamper-evident run ledger

CRE runs mutate over their lifecycle (status transitions, post-anchor evidence
updates), so the run file itself can't be append-only. `CreLedgerChain` is a
sidecar append-only, hash-chained journal (`data/cre-ledger.jsonl`) that records
every `add` / `replace` / `truncate` op with `sha256(prevHash | seq | op | runId |
runHash | timestamp)`. `verify()` recomputes each entry hash and the prevHash
linkage, so rewriting or deleting history breaks the chain; the verify endpoint
additionally compares each run's current `hashRun(run)` against the latest
recorded `runHash` — a byte edited on disk flips that run to "Tampered".

**Persistence invariant:** `hashRun(run) = sha256(JSON.stringify(run))` is
computed by `CreRunStore` _after_ `persistence.append(run)` and _before_
`ledger.record(...)`. Persistence layers must not mutate the run object in
place — MongoDB's `insertOne` adds an `_id` to the passed document, which would
make the ledger hash a `_id`-bearing object while the canonical JSONL store
holds the `_id`-free version, false-flagging every run as tampered after the
next reload. `MongoDbCreRunPersistence` therefore inserts shallow copies and
strips `_id` on load. Any new persistence layer must respect the same
no-mutation contract.

### Canonical Decision Lifecycle

Every governance decision follows this path:

```
Agent action
  → GovernanceController.evaluateAction()
  → WorkspaceDataService.evaluateAction()
      ├─ standard rule → evaluateRule() (allow/deny/require/rate_limit)
      ├─ confidential rule → FhenixPolicyService → Fhenix FHE
      └─ contract_audit rule → ChainGPTAuditService
  → recordSpend() — updates agent.spend_history + trades counter
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

### Network Roles

| Partner        | Role                                                                                                                                                                                                                                                                                                                       | Status                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Fhenix**     | Confidential policy evaluation via FHE. Budgets, limits, and spend counters remain encrypted.                                                                                                                                                                                                                              | Live (Arbitrum Sepolia)              |
| **X Layer**    | Governed execution dispatch path. Approved spends dispatched here for execution and public anchoring.                                                                                                                                                                                                                      | Testnet (chainId 1952)               |
| **Filecoin**   | Durable evidence anchoring for audit logs via `FilecoinStorageService` → FVM.                                                                                                                                                                                                                                              | Live (Calibration testnet)           |
| **0G**         | Dual surface: (a) on-chain governance decision proofs via `GovernanceProof` contract — every evaluate call posts a `GovernanceDecision` event to 0G Chain, verifiable on ChainScan; (b) 0G Storage evidence anchoring via `ZeroGStorageService` (indexer upload, gated by `ZEROG_PRIVATE_KEY`, re-fetched by deep-verify). | Galileo Testnet (chain ID 16602)     |
| **ChainGPT**   | Web3-specialized LLM for smart contract auditing and governance queries.                                                                                                                                                                                                                                                   | Live                                 |
| **Ledger DMK** | Hardware signing for high-value transactions.                                                                                                                                                                                                                                                                              | Live                                 |
| **MongoDB**    | Persistent agent memory & run ledger. Inserts copies of CRE runs so its auto `_id` never mutates the ledger-hashed object (see persistence invariant above).                                                                                                                                                               | Optional, gated by `MONGODB_URI`     |
| **HydraDB**    | Optional agentic-memory / cross-source retrieval substrate. Mirrors the audit + run ledger as app-knowledge and answers multi-hop questions across audit + Slack + GitHub. Free tier, unlimited calls.                                                                                                                     | Optional, gated by `HYDRADB_ENABLED` |

### Fhenix Integration — Confidential Policy Evaluation

Fhenix (CoFHE), where configured in the supported integration/testnet path, lets
Cognivern evaluate policy on **encrypted state** — budgets, spend counters, and
vendor allowlists never appear in plaintext. Only the decision
(approve/hold/deny) is revealed. Production availability and fallback behavior
remain environment-dependent; see [Current Limitations](#current-limitations).

#### Layered Architecture

| Layer                               | Chain                         | Role                                                                              |
| ----------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Execution & Public Policy Anchoring | X Layer Testnet (1952)        | `GovernanceContract`, `AIGovernanceStorage`                                       |
| Live Audit Anchoring                | 0G Galileo Testnet (16602)    | `GovernanceProof` contract — `GovernanceDecision` events, verifiable on ChainScan |
| Audit Archive                       | Filecoin Calibration          | Long-term immutable audit storage                                                 |
| **Confidential Policy State**       | **Fhenix (Arbitrum Sepolia)** | Encrypted budgets, encrypted spend counters, FHE-evaluated policy checks          |

Cross-chain: Fhenix computes the encrypted decision → Hyperlane Mailbox dispatches to X Layer → `GovernanceContract.handle()` consumes for execution and public anchoring.

#### What Gets Encrypted

| Concept                | Without Fhenix           | With Fhenix                            |
| ---------------------- | ------------------------ | -------------------------------------- |
| Per-agent daily budget | `uint256` in policy JSON | `euint128` on Fhenix                   |
| Spend counter          | In-memory counter        | `euint128` on Fhenix                   |
| Vendor allowlist       | `string[]`               | `ebool` via encrypted set              |
| Amount in `/api/spend` | Plaintext                | Client-side encrypted via `@cofhe/sdk` |

#### Configuration

```env
FHENIX_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc   # Arbitrum Sepolia (CoFHE arb-sepolia)
FHENIX_POLICY_CONTRACT=0x710005F7454B8756F7E1118B26d1361b001fc818
FHENIX_COFHE_URL=https://testnet-cofhe.fhenix.zone
FHENIX_PRIVATE_KEY=             # Falls back to FILECOIN_PRIVATE_KEY
FHENIX_CHAIN_ID=421614          # Arbitrum Sepolia — CoFHE TaskManager 0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9
FHENIX_EVALUATE_TIMEOUT_MS=30000
```

#### Key Contracts

| Contract                  | Address                                      | Network          |
| ------------------------- | -------------------------------------------- | ---------------- |
| `ConfidentialSpendPolicy` | `0x710005F7454B8756F7E1118B26d1361b001fc818` | Arbitrum Sepolia |
| `GovernanceContract`      | `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` | Arbitrum Sepolia |
| `GovernedVault`           | `0x468F1CfBB5bec9352b279192a952916610f58BB4` | Arbitrum Sepolia |

#### Async FHE Flow

FHE evaluations take 10-30 seconds. The system handles this asynchronously:

1. `POST /api/governance/evaluate` returns `202 Accepted` with `runId` when `policy.metadata.confidential === true`
2. Background workflow runs 4 steps: `load_policy` → `encrypt_params` → `submit_to_fhenix` → `record_audit`
3. Each step streams via SSE at `GET /api/cre/runs/:runId/events/stream`
4. Frontend shows animated 4-step progress panel
5. `GET /api/governance/evaluate/:runId/result` provides a fallback fetch

Code: `contracts/fhenix/src/ConfidentialSpendPolicy.sol`, `src/backend/services/FhenixPolicyService.ts`, `src/backend/cre/workflows/governance.ts`, `src/frontend/src/hooks/use-fhe-progress.ts`

### Canton Integration — Confidential Vendor Selection

Canton (Daml) is a swappable settlement backend for cognivern's sealed-bid vendor selection. The Fhenix-backed sealed-bid path holds bids as CoFHE ciphertext handles but can't complete the reveal; the Canton backend rewrites the settlement layer so the reveal actually works — atomically, in one transaction — while giving structural sub-transaction privacy that FHE alone can't. For HackCanton S2 the sealed-bid auction is the headline primitive (Track 1: Private DeFi & Capital Markets), and the agent-governance layer — which initiates rounds, records hash-signed bid/reveal events in the run ledger, and enforces policy before the auctioneer can close — is the Track 3 (Agentic Commerce) fit, not backdrop. The broader multi-chain stack (Fhenix/Filecoin/0G/ChainGPT/X Layer) is supporting context. Value settlement is live on DevNet: a `PaymentDeposit` template is escrowed before the auction and atomically transferred to the winner inside `CloseAndReveal`. The updated DAR (package `d62e13ab…`) is uploaded to the shared DevNet participant, and `pnpm canton:proof` produces `valueSettledAtomically: true` with an on-ledger `settledAssetCid` — see `.artifacts/canton-devnet-proof-latest.json`. `SettlementProof.daml` passes all 9 assertions on the IDE ledger.

The Canton path is locked against future Daml refactors by a literal-value canary in the post-reveal `AuctionResult` assertion (`winningProposal === "0x2b"` for the bid whose `proposalHash` was pinned in `submitBid`). Four live-sandbox invariants in `tests/integration/canton-sealed-bid.test.ts` cover the settlement + privacy surface.

#### Backend adapter pattern

`SealedBidService` (`src/backend/services/blockchain/SealedBidService.ts`) is a thin async dispatcher over the `SealedBidBackend` interface. Rounds pick their backend at create time via a `backend: "fhe" | "canton"` field; the dispatcher records `roundId → backendName` and routes subsequent calls (`submitBid`, `closeRound`, `revealWinner`) to the owning backend.

| Backend                  | File                                   | Notes                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FheSealedBidBackend`    | `sealed-bid/FheSealedBidBackend.ts`    | CoFHE ciphertext handles via `FhenixPolicyService.encryptValue`. Reveal uses the **Option B manager-decrypt-and-publish flow**: callers supply `decryptionProof: Array<{bidder, plaintext}>` (every bid covered); backend rejects without it, selects per `selectionMethod`, marks losers rejected + winner selected. |
| `CantonSealedBidBackend` | `sealed-bid/CantonSealedBidBackend.ts` | Maps `createRound → SealedBidAuction` create, `submitBid → SubmitBid` choice, `revealWinner → CloseAndReveal` choice.                                                                                                                                                                                                 |

See [`CANTON.md`](./CANTON.md) for the Daml model (four templates), runtime layout (local/Hetzner/DevNet), env vars, evidence anchoring, and the full DevNet cutover runbook.

#### FHE Option B trust model

The Fhenix confidential-compute pipeline (`ConfidentialSpendPolicy` + `SealedBidVendorSelection`) removed the trusted-operator middleman via the **Option B manager-decrypt-and-publish flow**:

- `evaluateSpend` / `submitBid` already grant `FHE.allowTransient(encryptedHandle, msg.sender)`, so the contract owner of the result handle is whoever called the entry-point — the address that will publish.
- `publishSpendResult(decisionId, uint8 plaintext)` and `publishWinner(roundId, winner, winningBid, ...)` require `msg.sender == the original submitter (manager)`. The off-chain CoFHE `decryptForView` permit must be signed by that same address (it was the `FHE.allowTransient` recipient), so the FHE ACL chain + permit binding + on-chain identity check together close the impersonation gap — no cryptographic-library helper required.
- The legacy `resolveDecision` / `revealWinner` paths stay wide-open (with `onlyOwner` lifted) so existing operator-side tooling (FheDecisionWatcher, scheduled notifiers) keeps working as a fallback. `delete pendingDecisions[decisionId]` after the first resolution dedups cross-chain Hyperlane dispatch so the X Layer GovernanceContract does not double-count.
- When the **cofhe-contracts library** ships `FHE.verifyDecryptResult`, only `publishWinner`'s ABI signature already carries the right shape — it accepts `uint256[] bidIndexes, bytes[] thresholdSignatures`, so verification can be layered on top of the manager-identity check additively without breaking callers. `publishSpendResult(bytes32 decisionId, uint8 plaintext)` would need a new function (e.g. `publishSpendResultWithVerification`) for the same upgrade — adding a parameter to the existing function changes the function selector and breaks current callers.
- The **in-memory** `FheSealedBidBackend.revealWinner` is the backend-side counterpart of `publishWinner` and enforces an analogous (but contract-independent) trust model: it consumes `decryptionProof: Array<{bidder, plaintext}>` from the caller without any CoFHE-permit check on its own (there's no chain-side identity to mirror), but it structurally rejects proofs missing any bidder's plaintext so the manager can't silently drop a competitor from the proof. The on-chain `publishWinner` and the in-memory backend share the **same shape** of fail-loud guarantees; the cryptographic binding is enforced only at the chain layer.
- The `requestDeFiAction` spend-policy path migrated to the same publish-then-dispatch pattern via `publishDeFiAction(decisionId, uint8 plaintext)`. `requestDeFiAction` now produces a `decisionId`, captures `submitter = msg.sender` in `pendingDecisions`, grants `FHE.allowTransient(notDenied, msg.sender)`, sets `resolvedOutcomes[decisionId] = Outcome.Pending` (same default-init fix as `evaluateSpend`), persists the encrypted `newSpent` in `pendingDecisions[decisionId].pendingNewSpent` with `FHE.allowThis` for cross-tx read, emits `DeFiActionRequested`, and does NOT synchronously dispatch + does NOT update the counter. Direct callers who want immediate execution then call `publishDeFiAction(decisionId, 2 /*Approve*/)` themselves, producing the effective downstream outcome for the GovernedVault on X Layer. Counter commit moved from request-time to publish-time on Approve: `publishDeFiAction` grants `FHE.allowTransient(pending.pendingNewSpent, address(this))`, assigns `c.spentToday = pending.pendingNewSpent`, then `FHE.allowThis` for persistence — closes the phantom-balance divergence surface where an evaluator could exhaust `dailyLimit` by request-spamming without publishing. `(target, data)` are captured at request time and replayed at publish time, so the publish-side signature shrinks to just `(decisionId, plaintext)` and the carry-through mismatch risk is gone. `publishDeFiAction` also requires `pending.isDeFi` to gate publish-time counter writes to DeFi-produced decisions (spend decisions carry `pendingNewSpent` as default uninitialised ciphertext, which would silently zero `c.spentToday` on Approve). Dedup via `delete pendingDecisions[decisionId]`; Deny/Hold emit the event but skip execution.
- **Migration note (iter 27):** `publishDeFiAction` dispatches to `xLayerDeFiVault` via Hyperlane ONLY when `plaintext == Approve (2)`. Deny/Hold resolutions emit `DeFiActionPublished` on the Fhenix chain but do NOT cross the Hyperlane bridge — this is intentional. Deny/Hold have nothing to execute on X Layer, so the unconditional every-resolution-dispatch legacy from the synchronous baseline would be wasted Hyperlane gas.
- **Architectural separation (who consumes what):** `publishSpendResult` and `resolveDecision` dispatch to `xLayerRecipient` (which `GovernanceContract.handle()` receives on X Layer, lines 133–162 of `contracts/src/GovernanceContract.sol` — decode → `bool approved = (outcome == 2)` → `_evaluateActionInternal(...)`). `publishDeFiAction` dispatches to a SEPARATE recipient, `xLayerDeFiVault`, which is a different contract entirely (`GovernedVault`, the specialized DeFi execution target). So `GovernanceContract.handle()` does not need to special-case the DeFi path at all — its semantics are unchanged.
- **Audit result:** zero TypeScript event listeners for `DecisionPublished` / `DeFiActionPublished` / `DeFiActionRequested` in `src/` (the only match in `FhenixPolicyService.ts:108` is an ABI-constant reference, not a `viem.watchEvent` or `web3.eth.subscribe`). Zero telemetry counters anywhere matching "dispatches per agent" / "approvals by agent" / "dispatchCount". Zero FheDecisionWatcher references in any metric path (the watcher is referenced only in `HealthController.ts` for `isRunning()` + `getPendingCount()`, a pending-decision count, not a dispatch count).
- **Future telemetry builders:** re-run a similar sweep at the time of building — pattern is `grep -rIn --include='*.ts' --include='*.tsx' --include='*.sol' --include='*.cjs' --include='*.js' --include='*.sh' --include='*.yml' --include='*.yaml' --include='*.toml' --include='*.env*' --include='*.json' 'DeFiActionPublished|DecisionPublished|xLayer\.\|mailbox\.dispatch' src tests deploy scripts monitoring`. **Off-chain observation**: standard `eth_getLogs` over the Fhenix RPC (chain id 421614), filtering on the `DeFiActionPublished(bytes32,uint8)` topic, returns the resolved `Outcome` for every decisionId including Deny/Hold — i.e. the Fhenix-side event stream remains the canonical surface for DeFi-action observability even though the cross-chain Hyperlane handler on X Layer doesn't see Deny/Hold.

### ChainGPT Integration — Web3 AI Governance

ChainGPT provides Web3-specialized LLM capabilities for governance analysis and runtime smart contract auditing.

| Capability                                                                                                                                                                               | Where                                                       | Config                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Web3 LLM Provider** — Routes Web3 queries (sanction checks, calldata decoding, contract analysis) via `MultiModelRouter`                                                               | `src/backend/modules/cloudflare-agents/MultiModelRouter.ts` | `CHAINGPT_API_KEY`                                                             |
| **Smart Contract Auditor** — Pre-spend vulnerability scan. Triggered by `contract_audit` rule type. Returns approve/hold/deny by severity (critical/high=deny, medium=hold, low=approve) | `src/backend/services/ChainGPTAuditService.ts`              | `CHAINGPT_API_KEY`, `CHAINGPT_AUDIT_TIMEOUT_MS`, `CHAINGPT_AUDIT_CACHE_TTL_MS` |
| **News-driven Policy Auto-Adjustment** — Breaking news from ChainGPT webhooks auto-flips matching policies to hold                                                                       | `src/backend/services/NewsPolicyAdjuster.ts`                | Webhook: `POST /api/webhooks/chain-gpt-news`                                   |

```env
CHAINGPT_API_KEY=your_api_key_here
CHAINGPT_BASE_URL=https://api.chaingpt.org
CHAINGPT_AUDIT_TIMEOUT_MS=30000
CHAINGPT_AUDIT_CACHE_TTL_MS=300000
```

Flow: agent submits spend targeting a contract → `PolicyEnforcementService` evaluates `contract_audit` rule → `ChainGPTAuditService.auditContract()` runs vulnerability scan → decision by severity → audit trail records verdict with score and findings.

### Ledger Integration

The `SigningProvider` interface in `src/backend/signing/SigningProvider.ts` defines a 3-method contract. Dispatch happens in `OwsWalletService.handleApprove()` based on `wallet.metadata.signingProvider`:

| Provider       | Value               | Backend                                                     | Use Case                              |
| -------------- | ------------------- | ----------------------------------------------------------- | ------------------------------------- |
| **Local**      | `"local"` (default) | `OwsLocalVaultService.signMessage()`                        | Development, low-value                |
| **OWS Remote** | `"ows_remote"`      | `OwsLocalVaultService.signWithExternalWallet()`             | Multi-instance                        |
| **Ledger DMK** | `"ledger"`          | `LedgerSigningProvider` (`@ledgerhq/device-management-kit`) | Production high-value, hardware-gated |
| **Speculos**   | `"speculos"`        | `OwsLocalVaultService.signWithExternalWallet()` via HTTP    | Sandbox/CI                            |

Wallet metadata:

```typescript
{ metadata: {} }                                           // Local (default)
{ metadata: { signingProvider: "ledger" } }                // Ledger hardware
{ metadata: { signingProvider: "speculos", externalSource: "http://speculos:5000" } }  // Sandbox
```

Speculos runs as a Docker container (`ops/deploy/docker-compose.yml`, `profiles: ["sandbox"]`). This lets CI run full governance→signing→audit cycles with hardware-accurate signing but zero asset risk.

Dependencies: `@ledgerhq/device-management-kit`, `@ledgerhq/device-signer-kit-ethereum`, `@ledgerhq/device-transport-kit-node-hid`, `@ledgerhq/device-transport-kit-speculos`, `rxjs`

### Native Agents

Cognivern's native agents, including `SapienceTradingAgent` and
`UserTradingAgent`, route actions through the same
`/api/governance/evaluate → /api/spend/preview → /api/spend` flow used by
external API callers. Trading is one implementation example, not the strategic
center of the product. The durable abstraction is a funded mandate whose actions
share one policy engine, one execution boundary, and one evidence trail.

#### Sapience Trading Cycle

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

#### Failure Modes

- **Governance API unreachable** — agent fails closed. No trade executes.
- **Preview denied** — trade not executed, denial recorded in audit log
- **Held for confirmation** — trade not executed, hold recorded. Operator sets `SAPIENCE_HUMAN_CONFIRM_TOKEN` or confirms via UI
- **LLM providers exhausted** — falls back to 50% probability, typically no edge → no trade

#### Configuration

| Env var                        | Default                 | Purpose                                         |
| ------------------------------ | ----------------------- | ----------------------------------------------- |
| `COGNIVERN_SELF_BASE_URL`      | `http://localhost:3000` | URL agents use to call their own governance API |
| `COGNIVERN_API_KEY`            | (required)              | API key for governance calls                    |
| `SAPIENCE_HUMAN_CONFIRM_TOKEN` | unset                   | Static token for trades ≥ 10 USDe               |
| `SAPIENCE_ENABLED`             | `false`                 | Toggle Sapience agent registration on startup   |

### Mode System

| Mode           | Auth Required | Data Source                                                            | UI Indicator                  |
| -------------- | ------------- | ---------------------------------------------------------------------- | ----------------------------- |
| **Demo**       | No            | Client-side demo data + backend `DemoDataService`                      | Amber "Demo Mode" badge       |
| **Sandbox**    | Yes           | Backend `WorkspaceDataService` with `X-Workspace-Mode: sandbox` header | Sandbox/Production toggle     |
| **Production** | Yes           | Backend `WorkspaceDataService` (live SQLite)                           | "Live Workspace" green banner |

Mode resolution (`demoInterceptor.ts`): workspace `tier` stored in SQLite (`'demo'` or `'live'`). If `tier === 'demo'`, backend always serves demo data. If `tier === 'live'`, the `X-Workspace-Mode` header selects data source.

## Storage Architecture

| Store                      | File                                       | Purpose                                      |
| -------------------------- | ------------------------------------------ | -------------------------------------------- |
| `RateLimitStore`           | `rate-limit-store.jsonl`                   | Per-workspace and per-key rate limiting      |
| `TokenBlacklistStore`      | `token-blacklist.jsonl`                    | JWT token revocation                         |
| `UxEventStore`             | `ux-events.jsonl`                          | UX telemetry events                          |
| `CreRunStore`              | `cre-runs.jsonl` (+ MongoDB optional)      | Core Run Engine evidence ledger              |
| `CopilotRunStore`          | SQLite (`copilot_runs` + `copilot_events`) | Live demo mission runs + event streams       |
| `MongoDbCreRunPersistence` | MongoDB `cre_runs`                         | Durable run ledger (optional, `MONGODB_URI`) |
| `MongoDbMemoryService`     | MongoDB `agent_memory`                     | Cross-session agent memory (optional)        |

All file-backed stores use a common `BaseStore` abstract class. To swap to Redis/Postgres/MongoDB: implement the same interface on a new adapter and replace the singleton import.

**Policy persistence** uses `PolicyPersistence` interface — `InMemoryPolicyPersistence` (default) or `MongoDbPolicyPersistence` (when `MONGODB_URI` is set). Bundled `.json` policies from `src/backend/policies/` are seeded on init.

## Security Architecture

| Layer          | Protection                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Auth           | SIWE + JWT with nonce replay protection                                  |
| API Keys       | scrypt hashed, workspace-scoped permissions                              |
| Rate Limiting  | 3 layers (global, workspace, per-endpoint)                               |
| Encryption     | Fhenix FHE on-chain evaluation (confidential policies)                   |
| Audit          | Immutable records on 0G Chain (Galileo Testnet) + Filecoin (dual-anchor) |
| Contract Audit | ChainGPT runtime scan on recipient contracts                             |

## Telemetry & Observability

Cognivern exports OpenTelemetry-native traces, metrics, and logs to SigNoz
for end-to-end observability of agent governance decisions. The integration
is designed so that every LLM call, policy evaluation, audit log entry, and
agent cycle appears as a correlated span in SigNoz.

### Bootstrap

The OTel SDK is initialized in `src/backend/observability/otel.ts`, which is
imported before any other module in `src/index.ts` so auto-instrumentations
patch http/express/dns/winston before they load. When
`OTEL_EXPORTER_OTLP_ENDPOINT` is unset, the SDK stays disabled with zero
overhead. When set, it exports via OTLP/HTTP to SigNoz Cloud (or any
OTLP-compatible backend).

### Instrumented surfaces

| Surface                  | Span name                       | Source file                   |
| ------------------------ | ------------------------------- | ----------------------------- |
| LLM call (with fallback) | `llm.execute_with_fallback`     | `MultiModelRouter.ts`         |
| LLM provider call        | `llm.provider.<name>`           | `MultiModelRouter.ts`         |
| Governance decision      | `governance.evaluate_decision`  | `PolicyEnforcementService.ts` |
| Audit log entry          | `audit.log_action`              | `AuditLogService.ts`          |
| Agent cycle              | `agent.sapience.forecast_cycle` | `SapienceTradingAgent.ts`     |

Each span carries attributes (provider, model, tokens, cost, outcome,
suspicion score, etc.) and the trace is nested so a governance decision
contains the LLM call and audit log as child spans.

### Trace deep-linking

Each governance evaluation captures the active OTel span's `traceId` and
stores it on the CRE run's evidence block. The audit page renders a
"View trace in SigNoz" link that opens the exact trace in SigNoz Cloud,
showing the full decision tree for that one governance call.

### Metrics

Counters and histograms are emitted for token consumption, cost, latency,
policy violations, HTTP request SLOs, and agent cycle health. See
`docs/signoz-dashboards.json` for three pre-built dashboard definitions.

### Status endpoint

`GET /api/observability/status` (public, no workspace auth) returns the
real backend OTel state: whether tracing is enabled, whether the OTLP
endpoint is reachable, which spans/metrics are instrumented, and the
SigNoz Cloud URL for deep-linking. The frontend Observability page renders
this as a status card with a Live/Disabled/Unreachable badge.

### Seed script

`pnpm signoz:seed` runs a scripted sequence of 6 governance evaluations
(3 approved, 2 denied, 1 held) to populate the SigNoz dashboards with
correlated trace data.

### Graceful fallbacks

All SigNoz touchpoints degrade gracefully when telemetry is unavailable.
The frontend helper (`src/frontend/src/lib/signoz.ts`) never throws,
caches the cloud URL with a 60s TTL, and falls back to the default SigNoz
Cloud URL on any error. The dashboard observability strip distinguishes
"disabled" from "fetch failed" so a network error is never mistaken for
an unconfigured backend.

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

| Endpoint               | Method | Description                                            |
| ---------------------- | ------ | ------------------------------------------------------ |
| `/api/spend`           | POST   | Execute governed spend                                 |
| `/api/spend/encrypted` | POST   | Confidential-policy spend with encrypted amount        |
| `/api/spend/preview`   | POST   | Simulate spend (dry-run)                               |
| `/api/spend/status`    | GET    | Execution status (includes `cleanverse` / `keeperHub`) |

### Cleanverse (CVI / CVA)

Optional Track 2 verified-agent capital rail. When a wallet has
`metadata.executionProvider: "cleanverse"`, spends are A-Pass gated (CVI)
before policy evaluation and settle as aUSD-D on Monad testnet (CVA).

| Endpoint                 | Method | Description                                                        |
| ------------------------ | ------ | ------------------------------------------------------------------ |
| `/api/cleanverse/status` | GET    | Config + Monad / aUSD-D status                                     |
| `/api/cleanverse/screen` | POST   | Screen sender + recipient A-Pass (`{ sender, recipient, chain? }`) |

Env: `CLEANVERSE_API_ID`, `CLEANVERSE_API_KEY`, `CLEANVERSE_API_URL`,
`MONAD_RPC_URL`, `MONAD_CHAIN_ID`, `CLEANVERSE_ATOKEN_ADDRESS`. Optional
institutional country rule on A-Pass country tags (v5.5):
`CLEANVERSE_ALLOW_COUNTRIES` (comma-separated ISO 3166-1 alpha-2 whitelist;
both parties must hold a tag, fail-closed on missing tags) or
`CLEANVERSE_BLOCK_COUNTRIES` (blacklist; wins if both set). A configured rule
is a hard deny gate (`cleanverse-country-rule`) alongside the CVI screen.
The current disposable Monad testnet demo wallet is
`0x2FeE0208c0d1598104f52fb55Dcc2811707c8879`; it is configured with
`executionProvider: "cleanverse"`, `chainId: 10143`, and must never have its
private key committed or shared. The configured aUSD-D contract is
`0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892` with 6 decimals.
Product UI: `/verified-capital`. The read-only live acceptance check is
`tooling/scripts/acceptance/cleanverse-live-negative-paths.ts`; it verifies the
active country rule, an unregistered-address denial, and the known demo pair.
See [HACKATHON_SUBMISSION_CLEANVERSE.md](./HACKATHON_SUBMISSION_CLEANVERSE.md).

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

### Current Limitations

- Funded mandate identity and outcome ingestion are the next implementation layers; the current Capital surface reports governed spend attribution but does not yet generate mandate statements
- Funded mandates and outcome ingestion are strategic product layers; current APIs primarily govern and record agent actions
- Complete ROI/P&L accounting and causal attribution are not implemented; AI telemetry is not business accounting
- External agent financing, investment, and credit underwriting are not implemented
- File-backed stores are single-instance — need Redis/Postgres before horizontal scaling
- Email auth supported alongside SIWE; SIWE path is more battle-tested
- Ledger signing requires USB/WebHID access — limits deployment to single-instance or co-located with hardware
- Fhenix CoFHE SDK not initialized in production — confidential spend uses safe fallback (deny by default, demo mode for small amounts)
- See [Deployment](./DEPLOYMENT.md) for deployment and operations

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

The write-verify-fix loop caught production issues during the build window; see [`LOOP.md`](./history/LOOP.md) for the full iteration log.

## Production Readiness

### Live demo operational checks

- `GET /health` is the core liveness probe.
- `GET /health?deep=true` reports required dependencies separately from optional
  integrations. An unavailable optional 0G Storage indexer remains visible as an
  `optional: true` degraded dependency without taking core API health down;
  `optionalDegraded: true` is the machine-readable signal.
- `GET /health/slo` is intentionally unauthenticated so an external monitor can
  collect route latency/error metrics without production workspace credentials.
  It exposes operational route metrics only and is protected by the application's
  dedicated `/health/slo` rate limiter (an upstream edge limiter may be added as
  defense in depth). The generic deployment guide should use `/health/slo`, not
  `/api/health/slo`.
- Configure `SLACK_WEBHOOK_URL` or `PAGERDUTY_ROUTING_KEY` to forward critical
  denied/flagged governance decisions to an operator alert sink.

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
