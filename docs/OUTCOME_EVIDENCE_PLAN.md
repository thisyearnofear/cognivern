# Outcome Evidence Plan — GitHub Connector, First Verified Statement, Key→Mandate

Status: **M1 implemented (2026-08-24)**; M2+ pending. Builds on the
implemented mandate foundation (`AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md`
Phases 2–5) and executes the outcome side of the strategy in
`GO_TO_MARKET.md` / `AGENTIC_CAPITAL_THESIS.md`.

M1 shipped: `src/backend/services/outcomes/` (source config + GitHub
connector), `funded_mandates.outcome_sources` column, mandate API accepts
`outcomeSources`, and `POST /api/mandates/:mandateId/outcomes/sync` (operator
auth) ingests verified PR/commit outcomes. Auth reuses the existing
`GITHUB_TOKEN` env var (documented in `.env.example`; the connector reads it,
it is never stored). HydraDB evidence sync fires best-effort after new
ingestions. Unit tests: `tests/unit/OutcomeSourceConfig.test.ts`,
`tests/unit/GitHubOutcomeConnector.test.ts` (29 focused tests green; full
suite 686 passing).

## The gap

`AllocationRecommendationService` requires `independently_verified` outcomes
to move a mandate from `hold` to `consider_next_allocation`. The outcome
ingestion API exists and enforces the schema — but nothing populates
`system_observed` or `independently_verified`. Every outcome today is
operator-typed. **The pipe is built; it has no water.**

This plan fills the pipe with one connector (GitHub), runs one fully
self-controlled cohort through it, and publishes the first statement with a
verified outcome. That artifact then becomes the Prezenti onboarding evidence.

## North star metric

**Published mandate statements containing at least one non-self-reported
outcome.** Revenue is treated as a byproduct of the wedge; this counter is
the leading indicator of the allocator platform.

## Milestone 1 — GitHub outcome connector

A new service that watches a configured GitHub repo for shipped work matching
a mandate's scope, verifies it via the GitHub API, and ingests it as
`verified_external_state` / `independently_verified` outcome observations.

**Why GitHub first:** wedge users (hackathon builders, grant builders)
produce their outcomes in public repos, and the GitHub API is the
verification oracle — `merged_at` set, or a commit present on the target
branch, is independent verification of external state. No human reviewer
needed for the first tier. This extends the existing receipt brand
(verify-without-trusting-us) to outcomes instead of inventing a new trust
mechanism.

### Design

```text
src/backend/services/outcomes/
  GitHubOutcomeConnector.ts    — poll/trigger, verify, ingest
  outcomeSourceConfig.ts       — mandate-level source schema + validation
```

Source config (new optional field on `FundedMandate`, stored as JSON in a new
`outcome_sources TEXT` column on `funded_mandates` — additive migration):

```ts
outcomeSources?: Array<{
  type: 'github';
  repo: string;            // "owner/name"
  mode: 'pr' | 'commits';  // this repo ships direct commits → commit mode matters
  branch?: string;         // default "main"
  labels?: string[];       // pr mode: only PRs with these labels
  pathFilter?: string;     // only work touching these paths
  since?: string;          // ISO date; ignore work shipped before the mandate window
  metricId?: string;       // link to one of the mandate's successMetrics
}>;
```

Connector logic:

1. **PR mode:** fetch closed PRs since last sync
   (`GET /repos/{owner}/{repo}/pulls?state=closed&sort=updated`), filter by
   branch/labels/path, require `merged_at != null`, fetch merge commit SHA,
   confirm it exists on the target branch.
2. **Commit mode:** fetch commits on the target branch since last sync
   (`GET /repos/{owner}/{repo}/commits?sha={branch}&since=…`), filter by
   path, verify each SHA is reachable from the branch head.
3. Ingest via `OutcomeObservationService.create()` with:
   - `kind: 'verified_external_state'`, `confidence: 'independently_verified'`
     (satisfies the existing validation rule for verified external state);
   - `evidence: [{ type: 'url', reference: prOrCommitUrl },
     { type: 'external_record', reference: sha, hash: sha }]`;
   - `source: 'github'`;
   - idempotency key `github:{repo}:{pr|commit}:{sha}` — stable, replay-safe.

Auth: fine-grained GitHub PAT (read-only `contents` + `pull_requests` on the
target repo), stored per-workspace, never inside the mandate payload.

Trigger: operator-initiated `POST /api/mandates/:mandateId/outcomes/sync`
plus optional cron. No webhook infrastructure for v1.

### Acceptance

- A merged PR (pr mode) or branch commit (commit mode) appears as a
  `verified_external_state` outcome with `independently_verified` confidence.
- Re-running sync is idempotent (no duplicates).
- With spend gates satisfied, the recommendation flips `hold` →
  `consider_next_allocation`.

## Milestone 2 — first cohort: Cognivern's own build, fully self-controlled

Decision (2026-08-24): do **not** gate the first verified statement on
Prezenti acceptance or any external partner. Run Cognivern's own next build
sprint (e.g. the September HackCanton round or the next hackathon entry) as
a funded mandate:

- **Budget:** the sprint's real governed inference/tooling spend.
- **Success metrics:** shipped deliverables, e.g.
  `{ id: 'deliverables-shipped', name: 'Deliverables shipped', unit: 'deliverables' }`.
- **Outcome source:** `thisyearnofear/cognivern`, **commit mode** on `main`,
  path-filtered to the sprint's scope.
- At sprint close: generate the statement candidate, confirm the
  recommendation stance, publish the snapshot, produce the redacted export.

The platform governing its own build spend and proving its own outcomes is
the strongest possible first artifact — dogfooding with receipts.

### Acceptance

- A published statement exists with at least one `independently_verified`
  outcome (north star metric goes 0 → 1).
- The redacted export is shareable outside the workspace.

## Milestone 2b — Prezenti onboarding with the artifact

Use the published statement as evidence in the Prezenti application
(`PREZENTI_SPONSORSHIP.md` meta-pitch): "we ran our own builder budget
through Cognivern; here is the attested statement with GitHub-verified
outcomes; run your builders' flexible allowance the same way." Their rubric
already scores public GitHub evidence — the statement attests exactly that.
Update `forms/sponsorship-application.json` and the tracker doc when the
artifact exists.

## Milestone 3 — key→mandate linkage on the credits rail (parallel with M1/M2)

Promote the Flare "key = sealed mandate" pattern (`KeyMandateService`) to the
sponsored-credits rail so the wedge's atomic unit *is* the vision's atomic
unit — every cohort accumulates mandate-shaped records automatically.

- `credit_programs` gains a nullable `mandate_id TEXT` column (additive).
- `cvk_` keys provisioned under a mandate-bound program inherit the binding.
- Spend attribution records for those keys carry the `mandateId` (field
  already supported by `SpendAttributionService`), so statements pick them up.
- Programs without a mandate binding are unaffected.

## Milestone 4 — north star metric instrumentation

- Counter query: `published_mandate_statements` joined to
  `outcome_observations` where `confidence != 'self_reported'`.
- Expose `GET /api/metrics/verified-statements` (operator-only) and log the
  counter on every statement publish. No dashboard build needed yet.

## Sequencing

```text
M1 (GitHub connector) ──→ M2 (own-build mandate, publish first statement)
                              └──→ M2b (Prezenti onboarding evidence)
M3 (key→mandate) — parallel, independent of M1/M2
M4 (metric) — after M2 produces the first data point
```

## Explicitly out of scope

- Stripe, CRM, or any non-GitHub outcome connector.
- Causal attribution or ROI computation (schema forbids it by design).
- Automated capital deployment or tranche release.
- Webhook infrastructure (poll + operator trigger suffices for v1).
- Multi-repo or cross-org GitHub sources.
