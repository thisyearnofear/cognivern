# HydraDB — agentic memory & cross-source retrieval

HydraDB is an **optional, toggleable** retrieval layer mirroring Cognivern's
audit/run ledger, mandates, outcome observations, statements, and external
SaaS context (GitHub, Linear, Attio) into a HydraDB context graph. A
fast/thinking-routed query layer answers multi-hop questions across all of
them. When `HYDRADB_ENABLED=false` (default) every service no-ops — zero
network calls, zero cost.

Its product-facing slice is the **Mandate Evidence Graph**: derived context
for accountable capital decisions — never an authorization system.

- Docs: https://docs.hydradb.com (v2 API) · keys: https://app.hydradb.com ·
  free tier, no card.
- Originally built for the HydraDB cross-source retrieval challenge
  (Aug 2026); benchmark artifacts live in `docs/` (`hydradb-*.json`,
  `hydradb-proof/`).

## Production status

Enabled on the live product since 2026-08-14 (`HYDRADB_ENABLED=true` in the
shared env): the mandate-context sync worker runs in production and
`GET /api/mandates/:id/context` returns live retrieval. The frontend talks to
the v2 API directly for the OS Terminal `hydra` commands.
`pnpm demo:seed` (with `COGNIVERN_TOKEN`) provisions a mandate + outcomes and
syncs the evidence graph.

## Architecture

```text
cognivern audit/run ledger (data/cre-runs.jsonl, MongoDB)
  │  HydraDbIngestionService.ingestCreRun()
  ▼
HydraDB app_knowledge  ◄── GitHub / Linear / Attio connectors
  │  (type="audit"; filterable fields in additional_metadata;
  │   relations link run ↔ agent ↔ vendor ↔ policy ↔ mandate)
  ▼
HydraDB context graph (entity/relation triplets)
  │  HydraDbRetrievalService.retrieve() ── classifyQuery() ── fast | thinking
  ▼
RetrievalOutcome { chunks, metrics: { mode, latencyMs, hydraDbCalls, cost } }
```

Each CRE run becomes one `app_knowledge` record: stable id
`cognivern_run_<runId>` (upsert-safe), `type: "audit"`, no declared schema
(free-tier index limit — all filterable fields live in `additional_metadata`:
`agent_id`, `vendor`, `origin`, `run_id`, `amount`, `asset`, `policy_id`,
`tx_hash`, `reason`, `ok`, `latency_ms`, `decision`, `workflow`, `chain`,
`ts`), and `relations.ids` to `cognivern_agent_*` / `cognivern_vendor_*` /
`cognivern_policy_*` / `cognivern_mandate_*`.

External connectors push records with matching `agent_id` / `vendor`
metadata so the graph deduplicates the same entity across sources; Linear
and Attio map operator email → GitHub login via `LINEAR_TO_GITHUB_LOGIN`.

### The fast/thinking router

`classifyQuery()` routes per query: metadata filter or short factual lookup →
`fast`; multi-hop, temporal, actor-attribution, thread, or long open-ended →
`thinking`. `forceMode` overrides; `retrieveMultiHop()` runs an explicit
sequence for >1-step questions. Every query records `RetrievalMetrics`
(mode, latencyMs, hydraDbCalls, resultCount, topScore, routingReason,
estimatedCostUsd).

## Mandate Evidence Graph

The Cognivern ledger and policy engine remain authoritative; HydraDB is a
derived, workspace-isolated context index used to explain allocation
decisions. The Capital page exposes **Evidence context** for a selected
mandate — the endpoint upserts the mandate, outcomes, a read-only statement
candidate, the bounded recommendation, and mandate-linked spend runs, then
runs a thinking-mode query:

```text
GET  /api/mandates/context/sync-health        # aggregate-only queue status
GET  /api/mandates/:mandateId/context         # build/read derived context
POST /api/mandates/:mandateId/context/sync    # explicit refresh
```

Each workspace gets a dedicated collection
`cognivern_workspace_<safeId>_<sha256-prefix>` (the digest prevents
`team/a` vs `team_a` collisions). Records carry `workspace_id` +
`mandate_id`; the service filters returned chunks by `mandate_id` (nested
`additional_metadata` filters currently drop HydraDB graph context, so
filtering is server-side).

Relations: `mandate ──authorizes──> agent`, `mandate ──uses──> policy`,
`agent ──produced──> run`, `run ──created──> spend attribution`,
`run ──supports──> outcome`, `statement ──evidences──> run/transaction`.

The enforced boundary:

```text
HydraDB context → cited evidence → Cognivern statement
→ bounded recommendation → explicit operator review → policy gate
```

HydraDB never authorizes spend, replaces the CRE ledger, mutates statements,
or turns an observed outcome into a causal ROI claim.

### Sync and freshness contract

- **Automatic:** mandate create/update and outcome creation enqueue
  workspace-scoped syncs — serialized per workspace/mandate.
- **Manual:** `GET …/context` builds current context; `POST …/context/sync`
  refreshes explicitly.
- **Retrying + durable recovery:** detached syncs retry twice with bounded
  backoff; queued jobs persist in SQLite and a worker started with the API
  reclaims due/stale jobs after restart. The queue is recovery only — it
  never authorizes or executes spend.
- **Fail-open:** a failed/disabled sync returns structured status
  (`disabled`/`queued`/`pending`/`synced`/`failed`); mutation responses never
  wait on HydraDB. Spend, statements, and policy gates work when it is slow
  or down.
- **Telemetry:** OTel counters `cognivern.hydradb.sync.jobs.total`,
  `…retries.total`, `…duration.ms` — operational signals only.
- `HYDRADB_SYNC_PENDING_AGE_MS` (default 5m) sets the stale-queue attention
  threshold surfaced by `sync-health`.

## Setup

```env
HYDRADB_ENABLED=true
HYDRADB_API_KEY=your_key_here        # from https://app.hydradb.com
HYDRADB_DATABASE=cognivern           # default
HYDRADB_COLLECTION=default           # logical partition
HYDRADB_DEFAULT_MODE=auto            # auto | fast | thinking
```

Verify:

```bash
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:smoke           # full lifecycle
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:ingest-ledger   # real CRE ledger
pnpm hydradb:seed-mandate-eval                                       # additive local eval seed
pnpm hydradb:seed-mandate-eval-cohort                                # 3-state cohort seed
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:benchmark       # question-set benchmark
```

The mandate evaluator (`pnpm hydradb:mandate-eval`, needs
`MANDATE_EVAL_WORKSPACE_ID` + `MANDATE_EVAL_MANDATE_ID[S]`) compares graph vs
no-graph retrieval on held-out questions and writes
`docs/hydradb-mandate-evaluation*.json`. For staging use
`MANDATE_EVAL_CONFIRM_NONPROD=staging` + `MANDATE_EVAL_OUTPUT_PATH=.artifacts/…`
— disposable workspaces only, never production.

**Latest eval (2026-08-13):** cohort run, 48 questions — graph 48/48 vs
no-graph 47/48 (+2pp), 100% provenance and graph-path usage, 5.03s vs 0.69s
avg latency. Read: graph mode buys relationship context and explainable
review paths, not raw accuracy on small scenarios; use it for allocation
review, fast mode for lookups.

## API

`hydraDbIngestion` — `ingestCreRun(s)`, `ingestAppRecord` (connector records
with `additional_metadata` + `relations.ids`), `ingestMemory` (per-agent
collection), `waitForIndexing`.
`hydraDbRetrieval` — `retrieve({query, forceMode?, metadataFilters?,
maxResults?})`, `retrieveMultiHop`, `buildContextString`.
`HydraDbClient` — raw v2 REST (`/databases`, `/context/*`, `/query`) with
429/5xx retry; use only when the services don't expose what you need.

## Connectors

| Connector | Shared entity | Script |
| --- | --- | --- |
| Cognivern audit ledger (anchor) | `agent_id`, `vendor`, `policy_id` | `pnpm hydradb:ingest-ledger` |
| GitHub (issues + PRs + commits) | `agent_id` (author login) | `pnpm hydradb:github` |
| Linear (issues) | `agent_id` (assignee email → GitHub login) | `pnpm hydradb:linear` (`LINEAR_API_KEY`) |
| Attio (people + companies) | people → `agent_id`; companies → `vendor` | `pnpm hydradb:attio` (`ATTIO_API_KEY` + `ATTIO_WORKSPACE`) |

HydraDB does not pull from connectors — extractors push `app_knowledge` with
matching metadata. Issues mentioning a machine agent get a forceful relation
to `cognivern_agent_<agentId>` via `referencedAgent` detection.

## Files

`src/backend/services/hydradb/` — `HydraDbClient.ts` ·
`HydraDbIngestionService.ts` · `HydraDbRetrievalService.ts` ·
`HydraDbMandateContextRecords.ts` · `HydraDbMandateContextService.ts` (sync +
recovery worker) · `index.ts` (singletons). Scripts under
`tooling/scripts/hydradb/` (smoke, ingest-cre-ledger, mandate-evaluation,
seeds, connectors/*, questions.ts, benchmark.ts). Env schema: `src/config.ts`
(`HYDRADB_*`, all optional, gated by `HYDRADB_ENABLED`).

## Production checklist

- Workspace collection holds only that workspace's records; every returned
  chunk carries the requested `mandate_id` + Cognivern provenance.
- Outcome notes and raw external references absent from the derived index.
- Disabled/unavailable HydraDB leaves spend, statements, recommendations,
  and policy gates operational.
- Sync worker running with the API; `sync-health` (failed jobs, retries,
  stale pending age, latency) monitored before alerting.
- Rerun a held-out evaluation after schema/retrieval/routing changes;
  eval artifacts are a regression signal, not a substitute for tenancy and
  fail-open checks. Do not use seeded IDs as production identifiers.

## Toggle / disable

`HYDRADB_ENABLED=false` (or unset): all services return null/empty, no
network calls. The CRE ledger + MongoDB remain the source of truth; HydraDB
is a rebuildable derived mirror.
