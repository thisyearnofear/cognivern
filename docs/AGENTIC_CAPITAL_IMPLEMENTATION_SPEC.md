# Agentic Capital Implementation Spec

## Status

**Phase 4/5 foundation implemented, publication shipping.** Funded mandate identity and links, operator-authenticated outcome observation ingestion, a hashed statement candidate, bounded allocation recommendations, and immutable published statement snapshots with permissioned redacted export are implemented. Financing, automatic execution, and ROI claims remain out of scope. This document turns the agentic capital thesis
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

### Mandate statement (Phase 4 schema)

A statement is a generated snapshot composed from a mandate, spend attribution,
run evidence, and outcome observations. Candidates are ephemeral; a published
snapshot is persisted immutably in `published_mandate_statements`, versioned per
mandate, and only leaves the workspace as an explicit redacted export:

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
  `contentHash` itself and the generated-at display timestamp. Excluding the
  display timestamp makes repeated read-only generation over unchanged evidence
  produce the same integrity hash. Canonicalization must recursively sort object keys,
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

1. **Implemented:** Add an operator-authenticated, workspace-scoped outcome observation endpoint.
2. **Implemented:** Validate metric ownership, value, unit, source, timestamp, and evidence references.
3. **Implemented:** Support idempotent ingestion using a required caller-supplied observation key with a database uniqueness constraint.
4. **Implemented:** Keep manual observations visibly distinct from system-observed and independently verified observations.
5. **Implemented:** Do not compute ROI or causal attribution.

### Phase 4 — statement generation

1. **Implemented:** Generate an ephemeral statement candidate from the workspace-owned mandate, measurement-windowed attribution report, and outcome observations.
2. **Implemented:** Include known unknowns and evidence completeness.
3. **Implemented:** Hash the canonical candidate payload with SHA-256. The candidate is not persisted or published.
4. **Implemented:** Persist immutable published snapshots and add a permissioned export/share path with redaction.
5. **Implemented:** Add a read-only Capital preview before considering any next-allocation recommendation.

### Phase 5 — bounded allocation recommendations

**Implemented as a read-only advisory layer** over the statement candidate:

- **Implemented:** operational metrics such as cost per observed outcome per asset (base units per verified outcome — explicitly not a financial return figure).
- **Implemented:** evidence-completeness score and blockers shown next to every metric.
- **Implemented:** a recommendation (`hold` | `consider_next_allocation`) that never executes automatically.
- **Implemented:** a governance note requiring explicit operator approval through the existing policy boundary for any new spend.

Gating is fail-closed: the recommendation stays `hold` when there are no outcome observations, no independently verified outcomes, no receipt-backed spend records, or any uncertain spend requiring reconciliation. The endpoint is `GET /api/mandates/:mandateId/recommendation` and is read-only.


## API shape for the next code milestone

The first implementation should be intentionally small:

```text
POST /api/mandates
GET  /api/mandates
GET  /api/mandates/:mandateId
PATCH /api/mandates/:mandateId
```

The following endpoints are now available for the Phase 3 observation layer:

```text
POST /api/mandates/:mandateId/outcomes
GET  /api/mandates/:mandateId/outcomes
```

`POST` requires a JWT-authenticated operator workspace context and an
`Idempotency-Key` (workspace API keys intentionally do not satisfy this
operator-authentication requirement). The key is enforced by a database uniqueness constraint, so
concurrent retries cannot create duplicate observations. Reusing a key with a
changed payload returns a conflict. `verified_external_state` additionally
requires `independently_verified` confidence and at least one evidence
reference. Neither endpoint computes ROI or causal attribution.

The read-only statement candidate and recommendation endpoints are now available:

```text
GET  /api/mandates/:mandateId/statement
GET  /api/mandates/:mandateId/recommendation
```

The statement endpoint generates a point-in-time candidate and does not persist
or publish it. The recommendation endpoint is an advisory review surface that
fails closed on weak evidence and never executes a spend.

Published statement snapshots are persisted immutably and versioned per mandate:

```text
POST /api/mandates/:mandateId/statements
GET  /api/mandates/:mandateId/statements
GET  /api/mandates/:mandateId/statements/:statementId
GET  /api/mandates/:mandateId/statements/:statementId/export
```

`POST` freezes the current candidate as `statement-<mandateId>-v<N>` and persists
it with its content hash, publisher, and timestamp. It fails closed (409) when
derived allocation exceeds authorization. `GET .../statements` lists version
summaries newest-first; `GET .../statements/:statementId` returns a snapshot; and
`GET .../statements/:statementId/export` returns a redacted copy — internal
sources, notes, and evidence references stripped, capital and both original and
redacted hashes preserved — without mutating the stored snapshot. Every read is
scoped by workspace and mandate.

All mutating endpoints need operator authentication and workspace ownership
checks. No endpoint in this layer broadcasts funds.

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
