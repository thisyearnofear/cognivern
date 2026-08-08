# Agentic Capital Implementation Spec

## Status

**Proposed next foundation layer.** This document turns the agentic capital thesis
into an implementation boundary without claiming complete ROI accounting, causal
attribution, external financing, or automatic capital deployment.

The current product already has the execution substrate:

```text
agent → governed decision → wallet/tool execution → CRE run → spend attribution
```

This spec adds the next link:

```text
spend attribution → observed outcome → permissioned mandate statement
```

## Objective

Define the boundary for a future first-class **funded mandate statement** that will let an operator answer:

- What was this agent or workflow authorized to achieve?
- How much capital was allocated and consumed?
- Which governed runs and spend intents belong to the mandate?
- What outcomes have been observed or independently verified?
- What evidence supports those observations?
- What remains unknown before another allocation decision is made?

The statement is an evidence package for review. It is not an investment product,
accounting ledger, or causal ROI engine.

## Non-goals

This layer must not:

- accept deposits from external capital providers;
- underwrite agents or assign credit;
- call telemetry or token estimates P&L;
- claim that an outcome was caused by an agent merely because it followed the spend;
- automatically release another tranche;
- merge wallet spend, provider-billed model cost, and estimated token cost into one
  financial amount;
- replace a customer's accounting, CRM, procurement, or finance system.

## Core objects

### Funded mandate (proposed schema)

A mandate is the operator-owned allocation boundary. It is not yet a persisted
runtime object; when implemented, it should be workspace-scoped with at least:

```ts
interface FundedMandate {
  id: string;
  workspaceId: string;
  name: string;
  objective: string;
  agentIds: string[];
  status: 'draft' | 'active' | 'paused' | 'closed';
  budget: {
    byAsset: Record<
      string,
      {
        authorizedAmount: string;
        allocatedAmount: string;
        consumedAmount: string;
        pendingAmount: string;
      }
    >;
  };
  policyIds: string[];
  measurementWindow?: {
    startsAt: string;
    endsAt?: string;
  };
  successMetrics: Array<{
    id: string;
    name: string;
    unit: string;
    target?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

Amounts remain integer base units and are asset-specific. Both mandate budgets
and statements are keyed by asset; neither may assume that two assets are
comparable without an explicit conversion supplied by a trusted external
accounting process.

### Outcome observation (proposed schema)

An outcome is a future observation record attached to a mandate, not a claim of
causation.

```ts
interface OutcomeObservation {
  id: string;
  mandateId: string;
  workspaceId: string;
  metricId?: string;
  kind: 'observed' | 'verified_external_state';
  value: string;
  unit: string;
  observedAt: string;
  source: string;
  confidence: 'self_reported' | 'system_observed' | 'independently_verified';
  evidence: Array<{
    type: 'url' | 'artifact' | 'run' | 'transaction' | 'external_record';
    reference: string;
    hash?: string;
  }>;
  notes?: string;
}
```

The `kind` and `confidence` fields are intentionally separate:

- `observed` means Cognivern or an operator recorded an observation;
- `verified_external_state` means the referenced external system or evidence was
  checked, but still does not prove that the agent caused the result;
- `self_reported` is not independently verified;
- `system_observed` means a connected system emitted the observation;
- `independently_verified` means a reviewer or verification process checked the
  source and evidence.

There is no `causal`, `roi`, `profit`, or `returnOnToken` status in this schema.

### Mandate statement (future Phase 4 schema)

A statement is a future generated snapshot composed from a mandate, spend
attribution, run evidence, and outcome observations. Publication immutability,
persistence, and hashing are requirements for Phase 4; they are not available
properties of the current Capital surface:

```ts
interface FundedMandateStatement {
  version: 1;
  statementId: string;
  mandate: FundedMandate;
  capital: {
    byAsset: Record<
      string,
      {
        authorizedAmount: string;
        allocatedAmount: string;
        consumedAmount: string;
        pendingAmount: string;
      }
    >;
    walletSpendByAsset: Record<string, string>;
    estimatedModelCostUsd?: number;
    providerBilledCostUsd?: number;
  };
  performance: {
    outcomes: OutcomeObservation[];
    knownUnknowns: string[];
    attributionNote: string;
  };
  evidence: {
    runIds: string[];
    allocationIds: string[];
    transactionHashes: string[];
    externalReferences: string[];
  };
  generatedAt: string;
  contentHash: string;
}
```

`walletSpendByAsset`, model cost, and provider-billed cost are separate fields
with separate semantics. The model and provider fields are optional, separately
sourced, and are not populated by the current attribution implementation. They
must not be added together and labeled as a return or P&L figure by the product.

## Invariants

### Workspace isolation

- A mandate, spend attribution, run, and outcome observation must belong to the
  same workspace before being included in a statement.
- A workspace-scoped API must reject cross-workspace references rather than
  silently dropping them or resolving them by ID alone.
- Portable statements may be shared outside the workspace only as an explicit
  export action, with secrets and private policy values redacted.

### Budget safety

- `allocatedAmount` must be derived from governed attribution records, not entered
  independently in a future statement.
- Current `SpendAttribution` records may exist without a `mandateId`; adding that
  linkage must remain backward-compatible with older records.
- A mandate must not report allocated capital above its authorized amount for the
  same asset.
- Replayed requests and lifecycle retries must not double-count allocation or
  consumption.
- Pending and uncertain spend remains visible and is not counted as consumed until
  the execution evidence is reconciled.

### Evidence separation

- A spend record explains what capital left an execution boundary.
- An outcome record explains what was observed in an external or internal system.
- A link between them is an evidence relationship, not proof of causation.
- Missing, stale, or conflicting evidence must be surfaced in `knownUnknowns`.

### Statement integrity

- Statements are deterministic snapshots over a selected time window and mandate.
- The embedded `mandate` is a value snapshot captured at generation time, never a
  live mutable reference to the current mandate record.
- The statement hash covers the canonical statement payload excluding
  `contentHash` itself. Canonicalization must recursively sort object keys,
  preserve array order, encode UTF-8 JSON without insignificant whitespace,
  normalize JSON numbers to their ECMAScript JSON representation, and preserve
  Unicode characters without escaping them. Hash the resulting UTF-8 bytes with
  SHA-256 and encode `contentHash` as lowercase hexadecimal. Amount strings must
  remain strings and timestamps must remain normalized ISO-8601 strings.
- Publishing a new statement creates a new `statementId` or version; previously
  published statements are never mutated in place.
- A statement must preserve the underlying run, allocation, transaction, and
  external references needed for review.

## Recommended implementation sequence

### Phase 1 — current milestone: attributable spend ledger

Already implemented in the current worktree. These records are not yet
mandate-backed; `mandateId` is a future linkage:

- canonical `SpendAttribution` records;
- workspace-scoped attribution reporting;
- lifecycle deduplication by intent and retry chain;
- receipt-gated consumed status;
- local and KeeperHub reconciliation;
- recovery-required state for uncertain execution;
- Capital dashboard and ledger surfaces.

### Phase 2 — mandate identity and links

Next code milestone:

1. Add a workspace-scoped mandate persistence model.
2. Add create/list/get/update lifecycle endpoints with operator authorization.
3. Add `mandateId` to spend intent and attribution metadata without breaking older
   records.
4. Validate that a mandate's agent and policy references belong to the same
   workspace.
5. Display mandate context in the existing Capital ledger.

### Phase 3 — outcome ingestion

1. Add an operator-authenticated outcome observation endpoint.
2. Validate metric, value, unit, source, timestamp, and evidence references.
3. Support idempotent ingestion using a caller-supplied observation key.
4. Keep manual observations visibly distinct from system-observed and independently
   verified observations.
5. Do not compute ROI or causal attribution.

### Phase 4 — statement generation

1. Build a statement from the mandate, current attribution report, and observations.
2. Include known unknowns and evidence completeness.
3. Hash the canonical payload and persist the published snapshot.
4. Add a permissioned export/share path with redaction.
5. Add review UI before considering any next-allocation recommendation.

### Phase 5 — bounded allocation recommendations

Only after repeated real workflows produce trustworthy statements:

- calculate operational metrics such as cost per observed outcome;
- show confidence and evidence completeness next to every metric;
- recommend, but do not automatically execute, a next allocation;
- require explicit operator approval and the existing governance boundary for any
  new spend.

## API shape for the next code milestone

The first implementation should be intentionally small:

```text
POST /api/mandates
GET  /api/mandates
GET  /api/mandates/:mandateId
PATCH /api/mandates/:mandateId
```

The following endpoints should wait until mandate identity and workspace checks
are in place:

```text
POST /api/mandates/:mandateId/outcomes
GET  /api/mandates/:mandateId/statement
POST /api/mandates/:mandateId/statement/publish
```

All mutating endpoints need operator authentication, workspace ownership checks,
and idempotency for retries. No endpoint in this layer should broadcast funds.

## Acceptance criteria

The mandate foundation is ready for outcome ingestion when:

- an operator can create a mandate in one workspace and cannot read or mutate it
  from another;
- a governed spend can reference a mandate without changing legacy spend flows;
- the Capital ledger can filter and aggregate spend by mandate;
- uncertain or mismatched transfers cannot be presented as consumed capital;
- retrying the same request does not duplicate records or totals;
- every statement candidate can enumerate its source runs and allocations;
- documentation and UI label observations as observed/verified rather than ROI;
- backend typecheck, frontend typecheck/lint, focused tests, and the full test suite
  remain green.

## Product language

Use:

- **funded mandate**;
- **governed spend**;
- **attributable execution**;
- **observed outcome**;
- **verified external state**;
- **evidence completeness**;
- **known unknowns**;
- **next allocation decision**.

Avoid until separately evidenced:

- guaranteed ROI;
- causal revenue attribution;
- return on token;
- autonomous investment;
- agent credit score;
- passive yield or fund performance.
