# Outcome Evidence Plan — connectors, first verified statement, agent surfaces

> Merged doc: absorbs `CAPITAL_AGENT_SURFACES.md`. Interface invariants live in
> [`AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md`](./AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md);
> strategy in [`PRODUCT_STRATEGY.md`](./PRODUCT_STRATEGY.md).

Status: GitHub connector shipped 2026-08-24 · Langfuse connector shipped
2026-09-11 · Capital UI + WebMCP plan adopted 2026-09-11 · **M2 dogfood (first
verified statement) pending.**

North-star metric: **published mandate statements containing at least one
non-self-reported outcome.**

## The gap

`AllocationRecommendationService` requires `independently_verified` outcomes
to move a mandate `hold` → `consider_next_allocation`. GitHub fills that
tier; Langfuse fills `system_observed` (useful for statements and quality
loops, insufficient alone to flip the recommendation). A calibrated
statement-scorer (TypeSafe Jev `noul` — see [TYPESAFE.md](./TYPESAFE.md)) is
the proposed middle tier: "does this evidence satisfy the mandate?" → a
confidence-scored judgment that can feed statements and, paired with an
independent source, allocation.

## Outcome connectors (shipped)

`src/backend/services/outcomes/` — `outcomeSourceConfig.ts` (mandate-level
`outcomeSources` on `funded_mandates.outcome_sources`) plus one connector per
source type, all dispatched through
`POST /api/mandates/:mandateId/outcomes/sync` (operator auth; idempotent keys;
no webhook infra for v1). HydraDB evidence sync fires best-effort after
ingestion.

- **`github`** — `GitHubOutcomeConnector.ts`. Merged PRs (`pr` mode:
  `merged_at != null`, merge SHA confirmed on branch) or branch commits
  (`commits` mode, for this repo's direct-commit flow), filtered by
  branch/labels/path/since. Ingests `verified_external_state` /
  `independently_verified` — the GitHub API is the verification oracle.
  Key: `github:{repo}:{pr|commit}:{sha}`. Auth: `GITHUB_TOKEN` env (never
  stored in the mandate payload).
- **`langfuse`** — `LangfuseOutcomeConnector.ts`. Modes `scores`
  (NUMERIC/BOOLEAN via `/api/public/v3/scores`) and `traces`
  (`/api/public/traces`). Ingests `observed` / `system_observed` — never
  `independently_verified` (scores are model/human-judged). Key:
  `langfuse:{project}:{traceId}:{scoreId}`. Auth: `LANGFUSE_PUBLIC_KEY` +
  `LANGFUSE_SECRET_KEY` (v1 = one key pair per deployment).

## Four surfaces, one domain layer

Operators should not need curl to attach a source, sync, or publish; agents
should call the same contracts the UI uses. Domain ops implemented once,
adapters thin:

```text
createMandate / updateMandate
setOutcomeSources          # github | langfuse
syncOutcomes               # POST …/outcomes/sync
listOutcomes / getRecommendation
previewStatement / publishStatement / exportStatement
```

| Surface | Who | Role |
| --- | --- | --- |
| Capital UI | Human operators | Full mandate loop, no API required |
| REST + API keys | Scripts / external agents | Automation, spend attribution |
| Server MCP | Headless agents | `/api/mcp/governance-check` today; expand for mandate ops |
| WebMCP | In-browser agents | Same actions via `document.modelContext` tools |

Rail-agnostic rule applies (`ARCHITECTURE_RAILS.md`, `LANGFUSE_LESSONS.md`):
tools describe **mandate / policy / outcome** verbs, not rail brands.

### Milestone A — Capital UI completeness (ship first)

Gap: Capital supports create → outcomes → recommendation → statement preview
→ publish → export. Missing: editing `outcomeSources` in the UI, an operator
**Sync outcomes** button, and clear empty states pre-sync. Acceptance: from
the UI alone, create mandate → add GitHub source → Sync → see
`independently_verified` outcomes → publish + export. Langfuse attaches the
same way (`system_observed`). No secrets in the mandate payload.

### Milestone B — WebMCP on Capital (feature-detected)

[WebMCP](https://webmachinelearning.github.io/webmcp/) (W3C WebML draft,
Chrome origin trial): `document.modelContext.registerTool({ name, description,
inputSchema, execute })` — prefer current draft; `navigator.modelContext` is
legacy. Live tab only (not a substitute for server MCP, not headless).
Mutating tools require user confirmation; read tools use `readOnlyHint`;
untrusted payloads carry `untrustedContentHint`. Register the same domain ops
on `/capital`; degrade gracefully when absent. Do not block the M2 dogfood on
WebMCP or the origin trial.

### Milestone C — server MCP mandate tools (parallel, headless)

Keep `/api/mcp/governance-check`; add discovery + tools for mandate
list/get, outcome sync, statement preview/export — same domain ops, no forked
business logic.

## Milestone 2 — first cohort: dogfood our own build

Decision (2026-08-24): do not gate the first verified statement on Prezenti
or any external partner. Run Cognivern's own next build sprint as a funded
mandate: real governed inference/tooling spend as budget, shipped
deliverables as success metrics, `thisyearnofear/cognivern` commit-mode
outcome source path-filtered to the sprint scope. At sprint close: generate
statement candidate → confirm recommendation stance → publish snapshot →
redacted export. Acceptance: a published statement with ≥1
`independently_verified` outcome (north star 0 → 1), export shareable outside
the workspace.

## Milestone 2b — Prezenti onboarding with the artifact

Use the published statement as Prezenti evidence
(`PREZENTI_SPONSORSHIP.md`): "we ran our own builder budget through
Cognivern; here is the attested statement with GitHub-verified outcomes; run
your builders' flexible allowance the same way." Their rubric already scores
public GitHub evidence. Update `forms/sponsorship-application.json` and the
tracker when the artifact exists.

## Milestone 3 — key→mandate linkage on the credits rail

Promote the Flare "key = sealed mandate" pattern (`KeyMandateService`) to
sponsored credits so every cohort accumulates mandate-shaped records:
`credit_programs.mandate_id` (additive, nullable), `cvk_` keys inherit the
binding, spend attribution carries `mandateId` (field already supported by
`SpendAttributionService`). Unbound programs unaffected.

## Milestone 4 — metric instrumentation

Counter: `published_mandate_statements` ⨝ `outcome_observations` where
`confidence != 'self_reported'`. Expose `GET /api/metrics/verified-statements`
(operator-only); log on every publish. No dashboard build yet.

## Sequencing

```text
A (Capital outcome sources + Sync UI) ──→ M2 (own-build mandate → statement)
  ──→ B (WebMCP, feature-detected)
Parallel: C (server MCP mandate tools) · M3 (key→mandate) · M4 (after M2)
```

## Explicitly out of scope

Stripe/CRM/prompt-eval features (Langfuse owns that surface) · causal
attribution or ROI (schema forbids it) · automated capital deployment or
tranche release · webhook infra · multi-repo/cross-org sources or
multi-project Langfuse key maps.
