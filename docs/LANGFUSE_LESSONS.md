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
  attestor) → ingest as `verified_external_state` /
  `system_observed` (scores are model-judged, not independently
  attested — confidence must reflect that) through the existing
  `OutcomeObservationService`, idempotent keys
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

- Ship a one-command `docker-compose` (backend + frontend + SigNoz +
  seeded demo mandate). Current story ("clone + `.env.example`") works
  but is not a template.
- Keep the license boring (MIT — already good). Their "no planned
  changes to licensing" is what enterprise buyers needed to hear; we can
  say it from day one.
- Publish build notes (`docs/history/LOOP.md`) in handbook style — their
  public handbook was a growth channel, not transparency theater.

### 4. Partnership before paperwork (GTM)

The acquisition worked because they had operated as partners for years:
Langfuse was a large ClickHouse Cloud customer, ClickHouse teams used
Langfuse, shared customers, joint meetups.

- Be a loud customer of our rails (Flare, Canton, Fhenix, 0G, Filecoin):
  joint demos, joint posts, "Cognivern runs on X". Telegraph +
  Cleanverse are already this pattern — treat each rail integration as a
  partnership surface with co-marketing, not just a technical adapter.
- When rail ecosystems offer distribution, weight learning + credibility,
  not just the check.

### 5. Performance and compliance as product features

- Our `<100ms policy check` claim needs public instrumentation (p50/p99
  on the dashboard), the way they published the v3 migration deep-dive.
  Same for CRE ledger verification numbers.
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
M1 (Langfuse connector, reuses GitHub-connector plumbing)
  ──→ M2 (one-command docker-compose self-host template)
    ──→ M3 (public p50/p99 policy-eval + ledger-verify numbers)
Parallel: rail partnership surfaces (joint demos/posts per rail)
```

M1 is the half-day design from 2026-09-11 and the execution start point.
