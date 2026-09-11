# Langfuse Lessons — Observability Adjacency Plan

Status: **adopted 2026-09-11** (prompted by the ClickHouse × Langfuse
acquisition). Strategy, not implementation — execution starts with the
Langfuse outcome connector (M1 below) reusing the GitHub-connector
plumbing in `src/backend/services/outcomes/`.

## Positioning (one line)

> Langfuse closes the loop from production data to better prompts.
> Cognivern closes the loop from funded mandate to verified outcome.

Langfuse is LLM observability + evals (traces, scores, datasets,
experiments, prompt management). Cognivern is economic governance (who may
spend what, under which mandate, with what evidence). They touch at exactly
one layer — traces/runs — and diverge everywhere else. That boundary is a
**partnership surface, not a competitive one**: Langfuse tells you what the
model did; Cognivern decides whether it was allowed to do it and whether to
fund it again.

## What we adopt (5 items, priority order)

### 1. Hot-path / cold-path data split (architecture)

Langfuse v2 ran on Postgres for shipping speed, then hit the wall on
high-throughput ingestion + fast analytical reads; v3 moved the hot path to
ClickHouse and kept Postgres for transactional state.

Our equivalent, without a rewrite:

- **Transactional (keep as-is):** mandates, policies, workspaces, keys —
  low-volume, SQLite/Mongo is fine.
- **Hot path (watch):** `audit_logs`, CRE/run ledger appends, SSE/event
  fan-out, outcome observations. When reads hurt, add an append-only
  analytical store (ClickHouse Cloud, or DuckDB/Parquet export first) for
  queries — the CRE JSONL stays the canonical tamper-evident narrative.
- **Now:** make OTel export land somewhere queryable. The SigNoz seed
  script (`tooling/scripts/signoz/seed-telemetry.ts`) exists — wire it as
  the default local observability story.

### 2. Langfuse outcome connector (integration, NOT replication)

Do not build tracing waterfalls, token-per-span breakdowns, prompt
versioning, or eval datasets — that is their monopoly. Instead, ingest
Langfuse data as outcomes, the same way the GitHub connector
(`GitHubOutcomeConnector.ts`, M1 in `OUTCOME_EVIDENCE_PLAN.md`) ingests
merged PRs:

- New source type `langfuse` in `outcomeSourceConfig.ts` alongside
  `github`: project/API host, score names or trace filters, `metricId`,
  `since`.
- New `LangfuseOutcomeConnector.ts` mirroring the GitHub connector's
  contract: poll → verify against the Langfuse API (the API is the
  attestor) → ingest as `observed` / `system_observed` (scores are
  model-judged, not independently attested — never
  `verified_external_state`, which requires `independently_verified`)
  through the existing `OutcomeObservationService`, idempotent keys
  (`langfuse:{project}:{traceId}:{scoreId}`), operator-triggered sync
  via `POST /api/mandates/:mandateId/outcomes/sync`.
- Example observation: "agent completed X traces, cost $Y, median quality
  score Z" linked to the mandate's success metric.
- Why: every Langfuse user becomes a Cognivern prospect — they already
  measure quality, we answer whether it was allowed and whether to fund
  it again.

### 3. OSS + self-hosting as distribution

Langfuse leaned into OSS early — docs, templates, deployment patterns —
which bought trust, distribution, and talent signal at once.

- Ship a one-command `docker-compose` (backend + frontend + queryable
  OTel + seeded demo mandate). **Done (2026-09-11):**
  `deploy/self-host/` — see its README. Default stack uses
  otel-collector + Jaeger (SignOz/ClickHouse stays optional later).
- Keep the license boring (MIT — already good). Their "no planned
  changes to licensing" is what enterprise buyers needed to hear; we can
  say it from day one.
- Publish build notes (`docs/history/LOOP.md`) in handbook style — their
  public handbook was a growth channel, not transparency theater.

### 4. Rail-fluent GTM, rail-agnostic product

The acquisition worked because they had operated as partners for years:
Langfuse was a large ClickHouse Cloud customer, ClickHouse teams used
Langfuse, shared customers, joint meetups.

**Rule:** adapters stay silent in the product; partnerships are loud
outside it.

- **Product identity** stays rail-agnostic: mandate → policy → spend →
  evidence → outcome. Rails are adapters (`ARCHITECTURE_RAILS.md`). The
  UI, first viewport, and glossary must not read as “we are Flare / Canton /
  Fhenix / 0G / Filecoin.” Prefer “settled on {rail}” from evidence
  metadata over hardcoded rail brand copy.
- **GTM** may be rail-*fluent*: joint demos, hackathon tracks, and
  “Cognivern runs on X” posts when an ecosystem is already a live
  distribution door. That is amplification under the agnostic frame —
  same mandate story, different settlement surface — not a branding
  program that picks a favorite.
- When rail ecosystems offer distribution, weight learning + credibility,
  not just the check. Never let a co-marketing surface become the
  product vocabulary.

### 5. Performance and compliance as product features

- Our `<100ms policy check` claim needs public instrumentation (p50/p99
  on the dashboard), the way they published the v3 migration deep-dive.
  Same for CRE ledger verification numbers. **Done (2026-09-11):**
  `GET /health/slo` includes `operations.policy_eval` (claim p95 ≤ 100ms)
  and `operations.ledger_verify` (claim p95 ≤ 500ms); the Observability
  page surfaces both under **Governance performance** (M3b).
- Our evidence story (SHA-256 chain, Filecoin CID, 0G proofs, redacted
  statement exports) is further ahead than theirs was at our stage.
  Package it: the redacted mandate statement is the SOC-2-adjacent
  artifact. Sell that before building more features.

## Explicitly out of scope

- Prompt management, playgrounds, eval datasets, trace waterfalls.
- Chasing their scale prematurely — they moved to ClickHouse when
  Postgres actually broke. We are pre-break: keep the ledger simple,
  add analytics when reads hurt.
- Any claim that telemetry alone is P&L (already forbidden by
  `AGENTIC_CAPITAL_THESIS.md`; restated here so this doc cannot be
  misread as an analytics pivot).

## Sequencing

```text
M1–M3b (Langfuse adjacency + self-host + SLO UI) ✓ 2026-09-11
  ──→ Capital UI: outcome sources + Sync (CAPITAL_AGENT_SURFACES.md A)
    ──→ Dogfood mandate → first published statement
      ──→ WebMCP on Capital (feature-detected) (CAPITAL_AGENT_SURFACES.md B)
Parallel: server MCP mandate tools; rail-fluent GTM outside product
```

Next product work is **Capital completeness** (human path), then WebMCP as
the in-browser agent adapter over the same APIs. Deployment default shifts
toward the VPS when Vercel storage quotas bind — see `DEPLOYMENT.md`.
