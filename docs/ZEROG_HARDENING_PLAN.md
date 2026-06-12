# 0G Integration Hardening Plan — Target: 9/10

This plan transforms the 0G integration from a proof-of-concept stub into a production-grade audit anchoring service. Every change maps to one or more Core Principles.

## Current State (4/10)

- **Write-only** — uploads records but never retrieves or verifies them
- **Fire-and-forget** — rootHash is logged then discarded (never stored in CRE evidence)
- **No tests** — zero coverage for any path
- **No validation** — API response is `as`-cast with fallback to `"pending"`
- **No retry** — single attempt, 15s timeout, then silent failure
- **logEvent() ignored** — only `logAction()` anchors
- **No .env.example** — env vars undocumented

---

## Phase 1: Enhance ZeroGStorageService

*Principles: Enhancement First, Clean, Modular*

### 1.1 Typed response validation

Replace the unsafe `as` cast with a runtime validation function. No `IZeroGStorage` interface — the class is a singleton and `vi.mock()` handles testability without interface ceremony.

```typescript
interface UploadResponseShape {
  root?: string;
  rootHash?: string;
  txHash?: string;
}

function parseUploadResponse(data: unknown): UploadResponseShape {
  if (typeof data !== "object" || data === null) throw new Error("Invalid response");
  const obj = data as Record<string, unknown>;
  if (typeof obj.root !== "string" && typeof obj.rootHash !== "string") {
    throw new Error("Missing root hash in response");
  }
  const result: UploadResponseShape = {};
  if (typeof obj.root === "string") result.root = obj.root;
  if (typeof obj.rootHash === "string") result.rootHash = obj.rootHash;
  if (typeof obj.txHash === "string") result.txHash = obj.txHash;
  return result;
}
```

### 1.2 Integrate CircuitBreaker

Reuse the existing `CircuitBreaker` from `shared/utils/circuitBreaker.ts`:

```typescript
import { CircuitBreaker } from "../shared/utils/circuitBreaker.js";

private circuit = new CircuitBreaker("ZeroGStorage", {
  threshold: 3,
  resetAfterMs: 30000,
});
```

Wrap `fetch` in `circuit.execute(...)`. No new retry mechanism needed.

### 1.3 Add local hash computation

```typescript
import crypto from "node:crypto";
const localHash = crypto.createHash("sha256").update(payload).digest("hex");
```

### 1.4 Enrich ZeroGUploadResult

```typescript
export interface ZeroGUploadResult {
  rootHash: string;
  localHash: string;
  txHash?: string;
  network: "0g-newton-testnet";
  timestamp: string;
}
```

### 1.5 Add retrieval + verification (deferred consumer)

```typescript
async retrieveRecord(rootHash: string): Promise<Record<string, unknown> | null>
async verify(rootHash: string, expectedHash: string): Promise<boolean>
```

- `retrieveRecord`: GET from `${indexerUrl}/download/${rootHash}`
- `verify`: re-fetch, compute SHA-256, compare to `expectedHash`
- Both return `null` when disabled
- **Note:** No immediate consumer — these are for a future verification endpoint. Included now because they're trivial (< 20 lines) and complete the read path for testability.

### 1.6 Add `getStatus()`

```typescript
getStatus(): { enabled: boolean; indexerUrl: string }
```

---

## Phase 2: Wire into CRE Evidence Pipeline

*Principles: DRY, Consolidation*

### 2.1 Extend `CreRun.evidence` in `src/backend/cre/types.ts`

```typescript
evidence?: {
  hash: string;
  cid?: string;
  zeroGRootHash?: string;  // 0G content-addressable root hash
  signature?: string;
  signer?: string;
  artifactIds?: string[];
  citations?: string[];
};
```

Co-locates the 0G record alongside the Filecoin CID in a single evidence envelope.

### 2.2 Update `AuditLogService.logAction()` — fire-and-forget with async update

The original plan had a race condition: calling `add()` then `add()` again creates duplicate entries in the append-only store. The fix uses `creStore.replace()` (upsert) in the async callback — no blocking, no duplicates.

```typescript
// Fire-and-forget with post-hoc evidence update (non-blocking)
zeroGStorageService
  .anchorAuditRecord({ ... })
  .then(async (result) => {
    if (result) {
      run.evidence = { ...run.evidence, zeroGRootHash: result.rootHash };
      await this.creStore.replace(run);
    }
  })
  .catch(() => { /* already logged inside ZeroGStorageService */ });
```

**Latency note:** This keeps `logAction()` non-blocking — the caller never waits for 0G. The `replace()` call only fires if the anchor succeeds, updating the already-stored run in-place.

### 2.3 Wire `logEvent()` to 0G — same evidence shape as `logAction()`

```typescript
zeroGStorageService
  .anchorAuditRecord({
    runId,
    workflow: workflowType,
    eventType: eventData.eventType,
    agentType: eventData.agentType,
    timestamp: startedAt,
    evidenceHash: evidence.hash,
  })
  .then(async (result) => {
    if (result) {
      run.evidence = { ...run.evidence, zeroGRootHash: result.rootHash };
      await this.creStore.replace(run);
    }
  })
  .catch(() => {});
```

Uses the same evidence fields as `logAction()` (runId, workflow, evidenceHash) — no inconsistency between event and action anchor payloads.

### 2.4 Update `enrichCreRunEvidence` in `src/backend/shared/utils/evidence.ts`

Propagate `zeroGRootHash` through the existing evidence enrichment pipeline so it shows up in audit exports:

```typescript
evidence: {
  hash: run.evidence?.hash || hashEvidence({ ... }),
  // ...existing fields...
  zeroGRootHash: run.evidence?.zeroGRootHash,
}
```

---

## Phase 3: Tests

*Principles: Modular, Clean*

### 3.1 Unit Tests — `src/backend/services/ZeroGStorageService.test.ts`

Follow the `ChainGPTAuditService.test.ts` pattern (co-located Vitest test). Mock `fetch` with `vi.stubGlobal`.

| # | Test | Validates |
|---|------|-----------|
| 1 | Returns `null` when disabled | No `ZEROG_PRIVATE_KEY` → graceful degradation |
| 2 | Succeeds with valid response | Correct URL, method, body; typed result with `rootHash` + `localHash` |
| 3 | Returns `null` on non-200 | Non-fatal failure path |
| 4 | Returns `null` on timeout | 15s `AbortSignal.timeout` |
| 5 | Returns `null` on malformed response | `parseUploadResponse` throws → caught |
| 6 | `retrieveRecord` fetches and parses | GET to correct endpoint |
| 7 | `retrieveRecord` returns `null` when disabled | No key → no fetch |
| 8 | `verify` returns `true` on match | Integrity check passes |
| 9 | `verify` returns `false` on mismatch | Integrity check fails |
| 10 | `getStatus` reports enabled/disabled | Simple state check |
| 11 | Circuit breaker opens after failures | Stops calling API |
| 12 | Circuit breaker resets after recovery | Successful call restores service |

### 3.2 Update `tests/unit/AuditLogService.test.ts`

Add a test verifying the 0G rootHash is captured in CRE evidence when the anchor succeeds.

### 3.3 No new tooling

Reuses existing Vitest setup. `vi.fn()`, `vi.stubGlobal()`, `describe/it/expect`.

---

## Phase 4: Documentation & Configuration

*Principles: Organized*

### 4.1 Add `.env.example` entries

```env
# 0G Storage (Audit Anchoring, optional)
ZEROG_PRIVATE_KEY=
ZEROG_INDEXER_URL=https://indexer-storage-testnet-standard.0g.ai
```

### 4.2 Update `docs/ARCHITECTURE.md`

Add to canonical decision lifecycle:
```
→ [optional] 0G Storage evidence anchoring via ZeroGStorageService
```

Add to storage architecture section describing the dual-anchoring model.

---

## Implementation Sequence

| Order | Phase | Lines | Files | Risk |
|-------|-------|-------|-------|------|
| 1 | 1.1–1.6 Enhance ZeroGStorageService | ~80 | 1 | Low |
| 2 | 3.1 Unit tests | ~200 | 1 (new) | None |
| 3 | 2.1 Extend evidence types | ~5 | 1 | Low |
| 4 | 2.2–2.3 Wire into AuditLogService | ~25 | 1 | Low (race fixed) |
| 5 | 2.4 Update evidence enrichment | ~5 | 1 | Low |
| 6 | 3.2 Update AuditLogService tests | ~50 | 1 | Low |
| 7 | 4.1–4.2 Documentation | ~15 | 2 | None |

**Total: ~380 lines across ~8 files.** No new dependencies. No framework changes.

---

## Design Decisions

| Decision | Rationale | Principle |
|----------|-----------|-----------|
| No `IZeroGStorage` interface | Singleton class, `vi.mock()` handles testability without interface ceremony | PREVENT BLOAT |
| `creStore.replace()` for post-anchor update | `add()` is append-only — calling it twice creates duplicates. `replace()` does upsert by runId | CLEAN |
| Fire-and-forget + `.then(replace)` | Keeps `logAction()` non-blocking; 0G latency never touches the caller | PERFORMANT |
| `zeroGRootHash` on `CreRun.evidence` | Co-locates with Filecoin `cid`. Single evidence envelope | DRY, CONSOLIDATION |
| Reuse `CircuitBreaker` | Don't build retry — existing one handles threshold + reset | DRY |
| Co-locate test (`*.test.ts`) | Matches `ChainGPTAuditService.test.ts` convention | ORGANIZED |
| Same anchor payload for `logEvent` and `logAction` | Both include runId, workflow, evidenceHash — no shape inconsistency | DRY |
| No batch upload / queue | No evidence of throughput issues — violates PREVENT BLOAT | PREVENT BLOAT |
| No `ZEROG_ENABLED` env var | `ZEROG_PRIVATE_KEY` presence already controls `enabled` | CONSOLIDATION |

---

## What Is NOT Included (and Why)

| Omitted | Reason |
|---------|--------|
| Batch upload / queue | No throughput issues yet — PREVENT BLOAT |
| Multi-network support | Premature — Newton testnet is correct |
| Frontend 0G rootHash display | Follow-up; data is in CRE runs and accessible via existing audit endpoints |
| IPFS CID extraction for 0G hashes | 0G uses hex hashes, not multihash — `extractCid` patterns don't apply. Intentionally separate field |
| New API endpoints | 0G anchoring is transparent — no routes needed |

---

## Acceptance Criteria

The integration is "9/10" when:

- [ ] `ZeroGStorageService` has `anchorAuditRecord`, `retrieveRecord`, `verify`, `getStatus`
- [ ] API response validated at runtime (no unsafe `as` casts, no `as any`)
- [ ] `ZeroGUploadResult` includes `localHash` (SHA-256 of uploaded payload)
- [ ] `CircuitBreaker` wraps all external calls
- [ ] `CreRun.evidence.zeroGRootHash` populated on every anchored record via `replace()` (no duplicate writes)
- [ ] `logEvent()` also anchors to 0G with same evidence shape as `logAction()`
- [ ] `enrichCreRunEvidence` propagates `zeroGRootHash`
- [ ] 12+ unit tests pass covering all paths
- [ ] `.env.example` documents ZEROG vars
- [ ] `ARCHITECTURE.md` reflects updated evidence pipeline
