# Agent Governance Integration — Interface Spec

**Goal:** Wire the sealed-bid auction to the agent-governance layer so that
software agents initiate rounds, policy gates the close, and every bid/reveal
event is recorded as a hash-signed event in the CRE run ledger. This makes the
submission credible for Track 3 (Agentic Commerce) alongside Track 1 (Private
DeFi).

**Hard constraint:** No Daml model changes. `createdByAgent` and
`governanceRunId` live on the off-ledger round record in the backend, not on
the on-ledger `SealedBidAuction` contract. This avoids a DAR rebuild + NODERS
re-upload. The agent layer governs *who can do what off-ledger*; the Daml
settlement semantics are unchanged.

**Parallelization:** Three people work in parallel. Each owns a disjoint set
of files. The only dependency is the interface in this doc — agree on it,
then build against it.

---

## Day 0 agreement — the interfaces

### Person 1 exports (CRE workflow layer)

File: `src/backend/cre/workflows/sealedBidGovernance.ts` (new)

```typescript
/**
 * Start an agent-governed sealed-bid round.
 * Creates a CRE run, records the round_created event, returns the runId.
 * Called by SealedBidController.createRound when agentId is present.
 */
export async function startAgentRoundCreation(params: {
  agentId: string;
  roundId: string;
  roundParams: {
    description: string;
    serviceCategory: string;
    maxBids: number;
    deadline: string;       // ISO 8601
    settlementAmount?: number | null;
    settlementAssetTag?: string | null;
  };
}): Promise<{ runId: string }>;

/**
 * Evaluate whether the auctioneer is allowed to close the round.
 * Runs three policy checks (see "Policy rules" below). Records a
 * policy_checked event with the result. Returns allowed + reason + checks.
 * Called by SealedBidController.closeRound before closing.
 */
export async function evaluateClosePolicy(params: {
  runId: string;
  roundId: string;
  bidCount: number;
  deadline: string;         // ISO 8601, the round's deadline
}): Promise<{
  allowed: boolean;
  reason: string;
  checks: PolicyCheck[];
}>;

/**
 * Record a hash-signed event in the CRE run ledger for a governed round.
 * Hash = SHA-256(runId + eventType + ISO timestamp + canonical JSON payload).
 * Called by SealedBidController.submitBid and revealWinner.
 */
export async function recordSealedBidEvent(params: {
  runId: string;
  eventType: "bid_submitted" | "round_closed" | "winner_revealed";
  payload: Record<string, unknown>;
}): Promise<{ eventHash: string; timestamp: string }>;

/**
 * Fetch the full governance timeline for a round — every event in the run
 * ledger, in order, with hashes. Called by the frontend to render the
 * tamper-evident audit trail.
 */
export async function getGovernanceTimeline(runId: string): Promise<{
  runId: string;
  agentId: string;
  events: GovernanceEvent[];
}>;

export interface PolicyCheck {
  name: string;             // "min_bids" | "deadline_elapsed" | "budget_within_limit"
  passed: boolean;
  detail: string;           // human-readable, e.g. "3 bids received (min: 3)"
}

export interface GovernanceEvent {
  eventType: string;
  timestamp: string;        // ISO 8601
  eventHash: string;        // SHA-256
  payload: Record<string, unknown>;
}
```

### Person 2 defines (backend controller + service)

File: `src/backend/modules/api/controllers/SealedBidController.ts` (existing)

**`POST /api/vendor/sealed-bid/rounds`** — extended request and response:

```typescript
// Request body — agentId is optional. If absent, round is human-created
// (backward compatible). If present, round is agent-governed.
interface CreateRoundRequest {
  description: string;
  serviceCategory: string;
  manager: string;
  maxBids: number;
  deadline: string;
  selectionMethod: "lowest" | "highest";
  settlementAmount?: number;
  settlementAssetTag?: string;
  agentId?: string;         // NEW — if present, triggers governance flow
}

// Response — data field now includes governance fields when agentId was set
interface CreateRoundResponse {
  roundId: string;
  // ...existing fields...
  createdByAgent?: string;  // NEW — the agentId, if agent-governed
  governanceRunId?: string; // NEW — the CRE runId, if agent-governed
}
```

**`POST /api/vendor/sealed-bid/rounds/:roundId/close`** — extended response:

```typescript
// If the round is agent-governed, closeRound calls evaluateClosePolicy first.
// If policy fails, returns 403 with:
interface ClosePolicyRejectedResponse {
  success: false;
  error: "Policy gate failed";
  policyChecks: PolicyCheck[];   // from Person 1's evaluateClosePolicy
  reason: string;                // human-readable summary
  timestamp: string;
}

// If policy passes (or round is not agent-governed), returns 200 as before:
interface CloseRoundResponse {
  success: true;
  data: {
    roundId: string;
    status: "closed";
    bidCount: number;
    policyChecks?: PolicyCheck[];  // present if agent-governed
  };
  timestamp: string;
}
```

**`GET /api/vendor/sealed-bid/rounds/:roundId`** — extended response:

```typescript
// The round object now includes governance fields when agent-governed:
interface SealedBidRound {
  // ...existing fields...
  createdByAgent?: string;     // NEW
  governanceRunId?: string;    // NEW
}
```

**`GET /api/vendor/sealed-bid/rounds/:roundId/governance-timeline`** — new endpoint:

```typescript
// Only present for agent-governed rounds. Returns the CRE run events.
// 404 if the round is not agent-governed.
interface GovernanceTimelineResponse {
  success: true;
  data: {
    runId: string;
    agentId: string;
    events: GovernanceEvent[];
  };
  timestamp: string;
}
```

### Person 3 consumes (frontend)

File: `src/frontend/src/lib/api-client.ts` (existing) — type additions:

```typescript
export interface SealedBidRound {
  // ...existing fields...
  createdByAgent?: string;
  governanceRunId?: string;
}

export interface PolicyCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface GovernanceEvent {
  eventType: string;
  timestamp: string;
  eventHash: string;
  payload: Record<string, unknown>;
}

export interface GovernanceTimeline {
  runId: string;
  agentId: string;
  events: GovernanceEvent[];
}
```

---

## Policy rules (opinionated — no choices to make)

Three checks gate `closeRound` for agent-governed rounds. All three must pass.

| Check | Rule | Detail string format |
|---|---|---|
| `min_bids` | `bidCount >= 3` | `"3 bids received (min: 3)"` or `"2 bids received (min: 3 — not met)"` |
| `deadline_elapsed` | `now >= deadline` | `"Deadline elapsed at 2026-07-20T14:00:00Z"` or `"Deadline not elapsed (closes at 2026-07-20T14:00:00Z)"` |
| `budget_within_limit` | If round has `settlementAmount`, check `settlementAmount <= 100000`. If no settlement amount, auto-pass. | `"Settlement amount $74,500 within budget limit $100,000"` or `"Settlement amount $150,000 exceeds budget limit $100,000"` or `"No settlement amount — budget check skipped"` |

The budget limit is a fixed constant: `MAX_SETTLEMENT_AMOUNT = 100000` (USD).
This is a demo policy — real deployments would configure it per agent. The
constant lives in `sealedBidGovernance.ts` and is documented as configurable.

**Non-agent-governed rounds skip all policy checks** — `closeRound` behaves
exactly as before. Backward compatible.

---

## Hash-signing spec

Every event recorded via `recordSealedBidEvent` gets a hash:

```
eventHash = SHA-256(
  runId + "|" + eventType + "|" + timestamp + "|" + canonicalJSON(payload)
)
```

Where `canonicalJSON` is `JSON.stringify(payload)` with keys sorted
alphabetically (deterministic). The hash is stored alongside the event in the
CreRunStore and returned in the governance timeline. The frontend renders the
hash as a truncated hex string (`abc123…`) next to each event — this is the
"tamper-evident" property made visible to judges.

This is **not** cryptographic identity signing (no private keys). It's
tamper-evidence: any modification to the event payload, timestamp, or runId
produces a different hash. The hash is computed server-side at record time and
stored; the frontend just displays it. A judge who wants to verify can
re-compute the hash from the displayed payload + timestamp and compare.

---

## Event payloads (opinionated — exact fields)

### `round_created` (recorded by `startAgentRoundCreation`)
```json
{
  "roundId": "0x31a7b245...",
  "description": "Security audit RFP — Q3 2026",
  "serviceCategory": "security-audit",
  "maxBids": 5,
  "deadline": "2026-07-20T14:00:00Z",
  "settlementAmount": 74500,
  "settlementAssetTag": "USDC"
}
```

### `bid_submitted` (recorded by `submitBid`)
```json
{
  "roundId": "0x31a7b245...",
  "bidder": "alice-cognivern",
  "proposalHash": "0x2b...",
  "index": 0
}
```
Note: `amountUsd` is **never** in the event payload — same privacy property as
the existing audit log. Only `proposalHash` (a commitment) is recorded.

### `policy_checked` (recorded by `evaluateClosePolicy`)
```json
{
  "roundId": "0x31a7b245...",
  "allowed": true,
  "checks": [
    { "name": "min_bids", "passed": true, "detail": "3 bids received (min: 3)" },
    { "name": "deadline_elapsed", "passed": true, "detail": "Deadline elapsed at 2026-07-20T14:00:00Z" },
    { "name": "budget_within_limit", "passed": true, "detail": "Settlement amount $74,500 within budget limit $100,000" }
  ]
}
```

### `round_closed` (recorded by `closeRound` after policy passes)
```json
{
  "roundId": "0x31a7b245...",
  "bidCount": 3,
  "closedBy": "auctioner-cognivern"
}
```

### `winner_revealed` (recorded by `revealWinner`)
```json
{
  "roundId": "0x31a7b245...",
  "winner": "bob-cognivern",
  "winningBid": 74500,
  "winningProposalHash": "0x2b...",
  "totalBids": 3
}
```
Note: `winningBid` **is** included here — at reveal time the amount is public
on-ledger via `AuctionResult`, so the governance event matches the ledger
state. This is consistent with the existing `sealed_bid.winner_revealed` audit
log entry.

---

## File ownership (no overlap)

| Person | Files owned | New files |
|---|---|---|
| 1 | `src/backend/cre/workflows/sealedBidGovernance.ts` | yes (new) |
| 1 | `src/backend/cre/runRecorder.ts` | extend (add sealed-bid event type) |
| 1 | `src/backend/cre/types.ts` | extend (add sealed-bid run type) |
| 1 | `src/backend/cre/storage/CreRunStore.ts` | extend (if needed for event queries) |
| 2 | `src/backend/modules/api/controllers/SealedBidController.ts` | existing |
| 2 | `src/backend/services/blockchain/SealedBidService.ts` | existing |
| 2 | `src/backend/services/blockchain/sealed-bid/types.ts` | existing |
| 2 | `src/backend/middleware/sealedBidAuthMiddleware.ts` | existing (if agentId auth needed) |
| 3 | `src/frontend/src/lib/api-client.ts` | existing |
| 3 | `src/frontend/src/components/sealed-bid/round-detail.tsx` | existing |
| 3 | `src/frontend/src/components/sealed-bid/governance-timeline.tsx` | yes (new) |
| 3 | `src/frontend/src/components/sealed-bid/agent-create-round.tsx` | yes (new) |
| 3 | demo video | n/a |

**No file is owned by more than one person.** Merge conflicts should not
happen. If they do, it's a spec violation — re-read this doc.

---

## What NOT to do

- **Do not add `createdByAgent` to the Daml `SealedBidAuction` template.**
  That triggers a DAR rebuild + NODERS re-upload. The agent layer is off-ledger.
- **Do not put `amountUsd` in the `bid_submitted` governance event.** Privacy
  property: only `proposalHash` (a commitment) is recorded before reveal.
- **Do not make policy checks configurable in this iteration.** Three fixed
  checks (min bids, deadline, budget) with one constant (`MAX_SETTLEMENT_AMOUNT
  = 100000`). Configurability is a post-submission concern.
- **Do not use crypto wallet signing for event hashes.** SHA-256 of canonical
  JSON is tamper-evidence, not identity proof. It's the right property for an
  audit trail, and it doesn't require wallet UX in the demo.
- **Do not break backward compatibility.** Non-agent-governed rounds (no
  `agentId` in the request) must work exactly as before — no policy gate, no
  governance run, no new fields in the response beyond `undefined`.

---

## Verification (all three, joint, end of Day 2-3)

1. **Agent creates round** — `POST /rounds` with `agentId: "demo-agent-1"` →
   response includes `createdByAgent` + `governanceRunId` → CRE run has
   `round_created` event with hash.

2. **Bids submitted** — 3 bids via `POST /rounds/:id/bid` → each records a
   `bid_submitted` event in the run ledger with hash. No `amountUsd` in payload.

3. **Policy gate blocks early close** — `POST /rounds/:id/close` before
   deadline → 403 with `policyChecks` showing `deadline_elapsed: passed: false`.

4. **Policy gate allows close after deadline** — wait or adjust deadline →
   `POST /rounds/:id/close` → 200 with `policyChecks` all passed →
   `round_closed` event recorded.

5. **Reveal** — `POST /rounds/:id/reveal` → `winner_revealed` event recorded
   with `winningBid` in payload (public at reveal time).

6. **Governance timeline** — `GET /rounds/:id/governance-timeline` → returns
   all 6 events in order with hashes. Frontend renders them as a timeline.

7. **Backward compatibility** — `POST /rounds` without `agentId` → response
   has no governance fields → `closeRound` skips policy → works as before.

8. **Demo video** — 3 minutes: agent creates round → bids → policy gate
   (show the blocked close, then the allowed close) → reveal → governance
   timeline with hashes → party-view toggle for privacy.
