# Rail matrix — where Cognivern stays chain-agnostic

Cognivern is a **mandate control plane**. Chains are adapters for settlement,
execution, and evidence — not the product vocabulary.

Four planes:

| Plane | Owns | Chain policy |
| --- | --- | --- |
| **Control** | mandate, agent, policy, hold, workspace | Always agnostic |
| **Decision** | evaluate → approve / deny / hold | Agnostic API; optional confidential-compute adapter |
| **Settlement** | move value, close auction, reveal | Pluggable backends (capability-tagged) |
| **Evidence** | prove what happened | Multi-anchor; CRE run is the narrative |

---

## Current state matrix

| Feature | Plane | Coupling | Key code | Notes |
| --- | --- | --- | --- | --- |
| Mandate / workspace / agents / policies | Control | **Clean** | `WorkspaceDataService`, governance CRUD | No chain in core schema |
| Policy string eval / holds / news adjuster | Decision | **Clean** | `WorkspaceDataService.evaluateAction`, `NewsPolicyAdjuster` | Commercial rules |
| Typed `PolicyEnforcementService` + confidential rules | Decision | **Adapter** | `PolicyEnforcementService`, `FhenixPolicyService` | FHE is a compute substrate behind the same evaluate path |
| Sealed-bid round create/bid/close/reveal | Settlement | **Adapter (gold standard)** | `SealedBidBackend`, `SealedBidService`, `Canton*` / `Fhe*` | `backend` chosen at create; dispatcher routes by round |
| Party-view disclosure | Settlement | **Adapter** | `queryBidsAsParty?` on Canton only | Capability, not leak |
| OWS approved native transfer | Execution | **Hardcoded default** | `blockchainConfig` (= X Layer), `OwsWalletService` | Wallet `metadata.chainId` can override, but config name/contracts are X Layer |
| KeeperHub routed spend | Execution | **Adapter-ish** | `KeeperHubExecutionProvider` | Takes `chainId` on the request — good shape |
| On-chain approval record | Evidence / Execution | **Hardcoded** | `OwsWalletOnChainManager` → X Layer governance/storage via `blockchainConfig` | Product copy says “X Layer” |
| Audit log → Filecoin CID | Evidence | **Adapter** | `AuditLogService` → `FilecoinStorageService` | Fire-and-forget sink |
| Audit / governance → 0G proof | Evidence | **Adapter** | `ZeroGProofService` / V2 | Optional; CRE stores receipt |
| Fhenix → Hyperlane → X Layer | Decision→Execution | **Coupled in Solidity** | `ConfidentialSpendPolicy` `xLayerRecipient` / `xLayerDeFiVault` | Destination is a constructor param (domain + recipient) — treat as configured rail, not product identity |
| SIWE login chains | Control (auth) | **Allowlist** | `siweIdentity.SIWE_ALLOWED_CHAIN_IDS` | Correct: auth ≠ settlement |
| Frontend explorers / badges | Evidence UX | **Hardcoded** | `audit-page.tsx`, `run-detail.tsx`, wagmi `xLayerTestnet` | Explorer map by chainId is fine; “Immutable on X Layer” copy is not |

---

## Leakages to fix (control plane should not say “X Layer”)

1. **`blockchainConfig` is X Layer-named and is the global EVM default** — `src/backend/shared/config/index.ts`. Rename conceptually to `defaultEvmExecution` / `executionRails.default`.
2. **Audit UI copy** that hardcodes “recorded on X Layer” / “0G + X Layer” instead of “anchored on {rail}” from evidence metadata.
3. **Explorer helper** in `run-detail.tsx` maps `196` to an xlayer-test URL (wrong network pairing) — symptoms of chain logic living in UI instead of a shared rail registry.
4. **Agent workshop / settings** listing “X Layer” as a fixed role badge rather than “Execution: {configured rails}”.
5. **Ops/product docs** that describe X Layer as *the* execution path rather than *the current default* execution adapter (Canton remains settlement for sealed-bid).

Non-leakages (OK as-is): sealed-bid `backend: "canton" | "fhe"`; CRE `chainId` on *receipts*; wallet metadata `chainId`; Hyperlane destination domain as deploy config.

---

## Minimal interfaces (match existing patterns)

Do **not** invent a new architecture language. Extend what already works for sealed-bid.

### 1. Settlement — already exists

```ts
// sealed-bid/SealedBidBackend.ts — keep; this is the template
interface SealedBidBackend {
  readonly name: BackendName; // "fhe" | "canton" | …
  createRound(…): Promise<SealedBidRound>;
  submitBid(…): Promise<BidRecord>;
  closeRound(…): Promise<SealedBidRound>;
  revealWinner(…): Promise<SealedBidRound>;
  // optional capabilities:
  queryBidsAsParty?(…): Promise<PartyView>;
}
```

Dispatcher: `SealedBidService` (round → backend map).

### 2. Execution — extract from OWS / KeeperHub

```ts
// Proposed: services/blockchain/execution/ExecutionBackend.ts
interface ExecutionBackend {
  readonly name: string;           // "evm-default" | "keeperhub" | "cleanverse" | …
  readonly chainId: number;        // concrete rail this instance talks to
  readonly capabilities: ReadonlySet<"native_transfer" | "erc20_transfer" | "sponsored">;

  transfer(req: {
    fromWalletRef: string;
    to: string;
    amountWei: bigint;
    idempotencyKey: string;
    abortSignal?: AbortSignal;
  }): Promise<{
    status: "sent" | "failed" | "uncertain";
    txHash?: string;
    chainId: number;
    explorerUrl?: string;
  }>;
}
```

Today’s mapping:

| Implementation | Today |
| --- | --- |
| `EvmExecutionBackend` | Native path inside `OwsWalletService` using `blockchainConfig` |
| `KeeperHubExecutionBackend` | Wrap `KeeperHubExecutionProvider` |
| Cleanverse path | Existing Cleanverse branch in OWS — same interface |

Workspace/mandate selects `executionBackend` (default from env).

### 3. Evidence — extract from AuditLogService fan-out

```ts
// Proposed: services/governance/evidence/EvidenceSink.ts
interface EvidenceSink {
  readonly name: string; // "cre" | "filecoin" | "zerog" | "evm-governance"
  anchor(event: {
    runId?: string;
    workspaceId: string;
    kind: string;
    payloadHash: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    sink: string;
    chainId?: number;
    ref: string;          // cid | txHash | proofId
    explorerUrl?: string;
  } | null>; // null = disabled / skipped
}
```

Today’s mapping:

| Sink | Today |
| --- | --- |
| CRE (canonical) | `CreRunStore` / run recorder — always on |
| Filecoin | `FilecoinStorageService.anchorAuditRecord` |
| 0G | `ZeroGProofService.recordDecision` |
| EVM governance/storage | `OwsWalletOnChainManager.recordOnChainApproval` |

`AuditLogService` becomes an orchestrator: write CRE, then `Promise.allSettled(sinks.map(s => s.anchor(…)))`, attach results as typed evidence — UI renders from evidence, not from stringly “X Layer”.

### 4. Decision compute — thin alias over what you have

```ts
interface ConfidentialDecisionBackend {
  readonly name: "fhenix" | "plaintext";
  evaluateSpend(…): Promise<{ decisionId: string; outcome: "approve" | "deny" | "hold" | "pending" }>;
}
```

`FhenixPolicyService` already is this; plaintext path is local policy eval. Keep Hyperlane destination as **config on the Fhenix deploy**, not as Cognivern product identity.

### 5. Shared rail registry (frontend + backend)

```ts
// packages/shared or backend/shared/rails.ts
interface RailDescriptor {
  id: string;          // "xlayer-testnet" | "canton-devnet" | "filecoin-calibration" | …
  plane: "settlement" | "execution" | "evidence" | "decision";
  chainId?: number;    // omit for non-EVM (Canton)
  displayName: string;
  explorerTx?: (hash: string) => string;
  capabilities: string[];
}
```

One map drives explorers, settings badges, and evidence chips. Kill per-page `if (chainId === 196)` forks.

---

## Target ownership

```text
Mandate / Policy / Agent     → Control (no chain fields required)
     ↓
DecisionBackend              → plaintext | fhenix
     ↓ approve
ExecutionBackend             → evm-default | keeperhub | …
SettlementBackend (auctions) → canton | fhe | …
     ↓
EvidenceSink[]               → cre + filecoin + zerog + evm-gov
```

Default rails are **env / workspace settings**, not schema.

---

## Suggested implementation order

1. **Rail registry** in shared + fix explorer/copy leakages (pure refactor, high clarity).
2. **Rename/split `blockchainConfig`** → `executionRails.default` without changing behavior.
3. **`EvidenceSink` interface** + make `AuditLogService` orchestrate existing Filecoin/0G/EVM writers.
4. **`ExecutionBackend` interface** + wrap OWS native transfer + KeeperHub (behavior-preserving).
5. **Workspace `defaultExecutionRail` / `evidenceSinks`** settings (opt-in UI later).
6. Only then: add a second EVM execution rail (e.g. Base) to prove agnosticism.

Do **not** rewrite Canton/FHE sealed-bid — that pattern is already correct; copy it.

### Step 1 status (done)

- Shared registry: `packages/shared/src/rails.ts`
- Frontend explorers / audit / settings / integrate / demo / agent workshop use registry helpers
- `blockchainConfig.railId` added; `OwsWalletOnChain` returns `chainId` / `railId` / `explorerUrl`
- Fixed mainnet `196` → testnet explorer mismatch

### Step 2–3 status (done)

- `executionRails.default` is the canonical default EVM rail; `blockchainConfig` remains a stable alias
- `EvidenceSink` + Filecoin / 0G storage adapters under `services/governance/evidence/`
- `AuditLogService` fans out anchors via `scheduleEvidenceAnchors` (CRE still canonical)

### Step 4 status (done)

- `ExecutionBackend` interface + adapters under `services/blockchain/execution/`
  - `EvmExecutionBackend` (`local`) → vault native transfer on `executionRails.default`
  - `KeeperHubExecutionBackend` → wraps `KeeperHubExecutionProvider`
  - `CleanverseExecutionBackend` → wraps Cleanverse aUSDC path
- `OwsWalletService.finalizeApprovedSpend` resolves backend via `resolveExecutionBackend(wallet.metadata.executionProvider)`
- Unit coverage: `tests/unit/ExecutionBackend.test.ts`

### Step 5 status (done)

- Workspace settings: `defaultExecutionRail`, `defaultExecutionProvider`, `evidenceSinks`
- Shared validators in `packages/shared/src/rails.ts`
- `PUT /workspace` accepts and validates the new fields
- Spend path falls back to workspace defaults when wallet metadata omits provider/chain
- `AuditLogService` filters evidence fan-out via `selectEvidenceSinks`
- Settings → Workspace → **Rail preferences** UI (opt-in)

### Step 6 status (done)

- `executionRails` is multi-rail: `default`, `secondary` (Mantle Sepolia), `byId`, `resolve()`, `list()`
- `EvmExecutionBackend` picks RPC/gas from `executionRails.resolve(req.chainId)`
- Receipt verification (OWS + CRE) uses the rail matching the claimed chain
- Env rename: prefer `EXECUTION_*`; legacy `XLAYER_*` still accepted as aliases

### Next

- Gradual ops cutover of live `.env` from `XLAYER_*` → `EXECUTION_*` (no behavior change)
- Optional: wire governance-anchor contracts on secondary rails when deployed

---

## Success test

Same mandate + policy + agent can:

1. Run a Canton sealed-bid round, **and**
2. Execute an approved native transfer on the configured EVM rail,

with both appearing as evidence under one CRE narrative — and the UI never needs the word “X Layer” except as a rail display name from the registry.
