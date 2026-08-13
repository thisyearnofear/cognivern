# HydraDB — Agentic Memory & Cross-Source Retrieval

HydraDB is an agentic-memory / retrieval substrate that cognivern uses as an
**optional, toggleable** layer for cross-source retrieval over its audit,
run-ledger, and funded-mandate evidence. When enabled, cognivern's spend-
governance decisions, mandates, agent runs, outcome observations, statements,
and surrounding SaaS context (GitHub, Linear, Attio) are mirrored into HydraDB
as `app_knowledge` records, and a fast/thinking-routed query layer answers
multi-hop questions across all of them.

This integration was built for the [HydraDB cross-source retrieval
challenge](https://docs.hydradb.com) and is the retrieval substrate behind
cognivern's agent-memory queries. Its product-facing slice is the **Mandate
Evidence Graph**: context for accountable capital decisions, not an
independent authorization system.

- **Docs**: https://docs.hydradb.com (v2 API)
- **MCP**: https://github.com/usecortex/hydradb-mcp
- **Dashboard / API keys**: https://app.hydradb.com
- **Free tier**: unlimited API calls & tenants — no credit card required.

## When to enable

| Scenario                                                                                      | Enable?                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| You want the cognivern Copilot agent to recall cross-source context (audit + GitHub + Linear) | ✅                                                |
| You are running the HydraDB challenge benchmark / demo                                        | ✅                                                |
| You want multi-hop "who spent what, and what did the team say" queries                        | ✅                                                |
| Production spend-governance only (policy eval, signing, audit)                                | ❌ — not needed; cognivern works fully without it |

When `HYDRADB_ENABLED=false` (default), every HydraDB service no-ops and
cognivern behaves exactly as without the integration. There is **zero runtime
cost** when disabled — no network calls, no SDK load.

## Architecture

```
cognivern audit/run ledger (data/cre-runs.jsonl, MongoDB)
  │
  ▼  HydraDbIngestionService.ingestCreRun()
HydraDB app_knowledge  ◄────  GitHub connector (issues + PRs + commits)
  │                       ◄────  Linear connector (issues)
  │                       ◄────  Attio connector (people + companies)
  │  (type="audit", additional_metadata: agent_id, vendor, origin, decision, chain, ts)
  │  (forceful relations link run ↔ agent ↔ vendor ↔ policy)
  ▼
HydraDB context graph (entity/relation triplets)
  │
  ▼  HydraDbRetrievalService.retrieve()  ── classifyQuery() ── fast | thinking
RetrievalOutcome { chunks, metrics: { mode, latencyMs, hydraDbCalls, cost } }
```

### What gets ingested

Each CRE run becomes one `app_knowledge` record with:

- **Stable id**: `cognivern_run_<runId>` (upsert-safe)
- **`type: "audit"`** — the cognivern source category
- **No declared schema** (free-tier index limit): all filterable fields live in
  `additional_metadata` and are queried via `metadata_filters.additional_metadata`.
  Fields: `agent_id`, `vendor`, `origin`, `run_id`, `amount`, `asset`,
  `policy_id`, `tx_hash`, `reason`, `ok`, `latency_ms`, `decision`,
  `workflow`, `chain`, `ts` (YYYY-MM-DD for temporal filters).
- **`relations.ids`**: `cognivern_agent_<agentId>`, `cognivern_vendor_<vendor>`,
  `cognivern_policy_<policyId>`, and `cognivern_mandate_<mandateId>` — HydraDB
  forceful source links used by thinking-mode retrieval.

External connectors (GitHub, Linear, **Attio**) push records with the **same
`agent_id` / `vendor`** in `additional_metadata` so HydraDB's graph deduplicates
the same entity across sources — the core of the challenge's "does it connect
references instead of treating them as separate entities" test. The Linear and
Attio connectors map the operator's email to their GitHub login via
`LINEAR_TO_GITHUB_LOGIN` so the same human dedups across all three sources.

### The fast/thinking router

`classifyQuery()` in `HydraDbRetrievalService.ts` decides the mode per query:

| Signal                                             | Mode       | Reason               |
| -------------------------------------------------- | ---------- | -------------------- |
| Metadata filter + short question (<12 words)       | `fast`     | filter does the work |
| Short factual lookup (≤8 words)                    | `fast`     | single-hop           |
| Multi-hop phrasing ("who … and what did they say") | `thinking` | graph traversal      |
| Temporal ("since", "after", "changed")             | `thinking` | temporal reasoning   |
| Actor attribution ("who filed/approved")           | `thinking` | entity resolution    |
| Thread / conversation                              | `thinking` | thread understanding |
| Long open-ended question                           | `thinking` | multi-clause         |

`forceMode` overrides the router. `retrieveMultiHop()` runs an explicit
sequence of queries (each counted) for questions that need >1 retrieval step.

Every query records `RetrievalMetrics` — `mode`, `latencyMs`, `hydraDbCalls`,
`resultCount`, `topScore`, `routingReason`, `estimatedCostUsd` — so the
benchmark table is produced from real runs.

## Mandate Evidence Graph

The strategic product integration is the **Mandate Evidence Graph**. The
Cognivern ledger and policy engine remain authoritative; HydraDB is a derived,
workspace-isolated context index used to explain allocation decisions.

The Capital page exposes **Evidence context** for a selected mandate. The
endpoint first upserts the mandate, its outcomes, a read-only statement candidate,
the bounded allocation recommendation, and mandate-linked spend runs, then runs
a thinking-mode query over the graph:

```text
GET  /api/mandates/:mandateId/context
POST /api/mandates/:mandateId/context/sync
```

Each workspace receives a dedicated HydraDB collection named
`cognivern_workspace_<safeWorkspaceId>_<sha256-prefix>`. The digest prevents
normalization collisions such as `team/a` and `team_a` from sharing a tenant.
Records carry both `workspace_id` and `mandate_id` metadata. The workspace
collection is the hard tenant boundary. For mandate context, the query includes
the exact mandate identity and the service filters returned chunks and graph
groups by `mandate_id` before exposing them; this preserves HydraDB graph context,
which is currently omitted by HydraDB when nested `additional_metadata` filters
are sent on the same query.

```text
collection = collectionForWorkspace(workspaceId)
query = ... exact mandate name + mandate ID ...
server-side result filter: additional_metadata.mandate_id === mandateId
```

Relations include:

```text
mandate ──authorizes──> agent
mandate ──uses─────────> policy
agent ────produced─────> run
run ──────created──────> spend attribution
run ──────supports─────> outcome observation
statement ──evidences──> run / transaction
```

The returned context includes retrieved chunks, source provenance, graph paths,
latency, retrieval mode, sync status, durable recovery-job status, and ingestion
counts. Provenance links go back to Cognivern records; raw outcome notes and
external evidence references are intentionally omitted from the derived index.
The Capital UI surfaces the context as advisory, shows indexing/recovery progress,
and links it to the existing statement/recommendation review flow:

```text
HydraDB context → cited evidence → statement → bounded recommendation
→ explicit operator review → existing policy gate
```

HydraDB never authorizes spend, replaces the CRE ledger, mutates statements, or
turns an observed outcome into a causal ROI claim. The enforced boundary is:

```text
HydraDB context → cited evidence → Cognivern statement
→ bounded recommendation → explicit operator review → policy gate
```

Mandate creation/update and outcome creation enqueue best-effort syncs serially
per workspace/mandate. Mutation responses never wait for HydraDB, and failures
are visible only as derived context status. Spend execution, statement
publication, and policy evaluation remain available when HydraDB is disabled,
slow, or unavailable.

### Sync and freshness contract

- **Automatic:** API mandate create/update and outcome creation enqueue a
  workspace-scoped sync.
- **Manual:** `GET /api/mandates/:mandateId/context` builds the current derived
  context; `POST /api/mandates/:mandateId/context/sync` explicitly refreshes it.
- **Serialized:** updates for the same workspace/mandate are processed in order
  so rapid edits converge instead of racing.
- **Retrying:** detached best-effort syncs retry failed writes twice with small
  bounded backoff; they never hold the mutation response open.
- **Durable recovery:** queued sync jobs are persisted in SQLite and a worker
  started with the API reclaims due or stale jobs after a process restart. The
  queue is a recovery mechanism only; it does not authorize or execute spend.
- **Freshness:** context responses include the current sync attempt (`syncedAt`)
  and, when available, the last searchable sync (`lastSyncedAt`).
- **Fail-open:** a failed or disabled sync returns structured status (`disabled`,
  `queued`, `pending`, `synced`, or `failed`) and never blocks the authoritative
  mutation.
- **Derived-only:** HydraDB records may be rebuilt or discarded; Cognivern's
  SQLite/MongoDB/CRE records, statements, recommendations, and policy decisions
  remain the source of truth.

The Capital page uses graph/thinking retrieval for evidence review because the
review questions are multi-hop and provenance-sensitive. Simple factual lookups
should use the fast path; the seeded evaluation measured the tradeoff below.


## Setup

### 1. Get a free HydraDB account

1. Sign up at https://app.hydradb.com.
2. Create an API key.
3. Note your database name (or let cognivern create one — default `cognivern`).

### 2. Configure environment

Add to `.env` (or `.env.local`):

```env
HYDRADB_ENABLED=true
HYDRADB_API_KEY=your_key_here
HYDRADB_DATABASE=cognivern          # default
HYDRADB_COLLECTION=default          # logical partition; use agent_id for per-agent memory
HYDRADB_DEFAULT_MODE=auto           # auto | fast | thinking
```

### 3. Verify the integration

```bash
# Smoke test: create DB, ingest a sample run + Slack record, retrieve both modes.
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:smoke

# Ingest the real cognivern audit ledger.
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:ingest-ledger

# Seed an additive local mandate/workspace with spend + verified outcome evidence.
pnpm hydradb:seed-mandate-eval

# Compare 16 held-out mandate questions with graph vs no-graph retrieval.
MANDATE_EVAL_WORKSPACE_ID=... MANDATE_EVAL_MANDATE_ID=... \
  HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:mandate-eval

# Additive local cohort: evidence-backed, evidence-gap, and early/no-spend states.
pnpm hydradb:seed-mandate-eval-cohort
MANDATE_EVAL_WORKSPACE_ID=hydra-eval-workspace \
MANDATE_EVAL_MANDATE_IDS=hydra-eval-mandate,hydra-eval-mandate-hold,hydra-eval-mandate-early \
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:mandate-eval
```

The smoke test exercises the full lifecycle (ensureDatabase → ingest →
waitForIndexing → fast retrieve → thinking retrieve → multi-hop) and prints
metrics for each. Exit 0 on success.

The mandate evaluation writes `docs/hydradb-mandate-evaluation.json` and reports
answer correctness, provenance correctness, graph-path usage, latency, and
accuracy lift over the same scoped no-graph baseline. Its answer key is derived
from Cognivern's authoritative records at run time, while the question wording
is held out from the retrieval implementation. The evaluation is intentionally
not an LLM-judge score: a trial passes only when expected answer fragments,
expected object types, and (for graph questions) graph context are all present.

Latest local seeded run (2026-08-13, workspace `hydra-eval-workspace`, mandate
`hydra-eval-mandate`): graph retrieval passed **16/16 (100%)** and the no-graph
baseline also passed **16/16 (100%)**, for **0 percentage points** of accuracy
lift in this run. Graph path usage was **100%** on graph-required questions and
both trials had **100%** provenance accuracy. Graph retrieval averaged **4.78s**
versus **0.55s** for the baseline.

This result is useful precisely because it limits the claim: graph mode did not
improve answer accuracy on this small seeded scenario, but it did return the
relationship context required by the graph questions and supports explainable
review paths. Use graph mode for allocation review where relationship evidence
matters, fast mode for simple lookups, and rerun the evaluation against
representative mandates before changing routing defaults.

Latest local cohort run (2026-08-13, three additive states, 48 questions): graph
retrieval passed **48/48 (100%)** versus **47/48 (98%)** for the no-graph
baseline, a **2 percentage-point lift**. Graph provenance and graph-path usage
were both **100%**. Average latency was **5.03s** graph versus **0.69s**
no-graph. The cohort artifact is
`docs/hydradb-mandate-evaluation-cohort.json`; it is a local regression fixture,
not production data.

The detailed artifacts record every question, matched fragments, object types,
latency, and top source title:
`docs/hydradb-mandate-evaluation.json` (single mandate) and
`docs/hydradb-mandate-evaluation-cohort.json` (multiple mandates).

## API

### Ingestion (`src/backend/services/hydradb/HydraDbIngestionService.ts`)

```ts
import { hydraDbIngestion } from '@backend/services/hydradb/index.js';

// Ingest a CRE run (auto-extracts spend intent + attestation).
await hydraDbIngestion.ingestCreRun(run);

// Ingest many at once.
await hydraDbIngestion.ingestCreRuns(runs);

// Ingest an external connector record (Slack, GitHub, Linear, ...).
await hydraDbIngestion.ingestAppRecord({
  id: `slack_${channel}_${ts}`,
  database: 'cognivern',
  collection: 'default',
  title: `#${channel} — ${author}`,
  type: 'slack',
  url: `https://...slack.com/archives/...`,
  timestamp: iso,
  content: { text: '...' },
  tenant_metadata: {}, // empty (no schema on free tier)
  additional_metadata: { author, channel, workspace, agent_id, vendor, origin: 'slack', workflow, chain, ts },
  relations: { ids: [`cognivern_agent_${agentId}`] },
});

// Ingest an agent-scoped memory.
await hydraDbIngestion.ingestMemory({
  collection: agentId, // per-agent partition
  id: `pref_${id}`,
  text: 'Agent prefers conservative spend limits.',
  infer: true,
});

// Wait for indexing (searchable).
await hydraDbIngestion.waitForIndexing([id1, id2]);
```

### Retrieval (`src/backend/services/hydradb/HydraDbRetrievalService.ts`)

```ts
import { hydraDbRetrieval } from '@backend/services/hydradb/index.js';

// Auto-routed single query.
const outcome = await hydraDbRetrieval.retrieve({
  query: 'What did http-verify-agent spend on stable-email?',
  forceMode: 'thinking', // optional override
  metadataFilters: { tenant_metadata: { agent_id: 'http-verify-agent' } },
  maxResults: 10,
});
console.log(outcome.chunks);
console.log(outcome.metrics); // { mode, latencyMs, hydraDbCalls, cost, ... }

// Explicit multi-hop (each hop = 1 HydraDB call).
const multi = await hydraDbRetrieval.retrieveMultiHop([
  { query: 'http-verify-agent spend', forceMode: 'thinking' },
  {
    query: 'stable-email',
    metadataFilters: { tenant_metadata: { vendor: 'stable-email' } },
    forceMode: 'fast',
  },
  { query: 'what was said about http-verify-agent in slack', forceMode: 'thinking' },
]);

// Build an LLM context string from chunks.
const ctx = hydraDbRetrieval.buildContextString(outcome.chunks);
```

### Low-level client (`src/backend/services/hydradb/HydraDbClient.ts`)

Wraps the full HydraDB v2 REST API (`/databases`, `/context/*`, `/query`) with
retry on 429/500/503 and envelope unwrapping. Use directly only when the
ingestion/retrieval services don't expose what you need.

## Connectors (challenge: ≥3)

The challenge requires ≥3 connectors with shared entities. Cognivern's
audit ledger is the anchor source (this is the "document ingestion"
deliverable); the others are extractors that push `app_knowledge` records
with matching `tenant_metadata`. **GitHub, Linear, and Attio are 3
from the challenge's connector list.**

| #   | Connector                                       | Entity shared                                                    | Extractor                                                                     | Status                                                |
| --- | ----------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | **Cognivern audit ledger** (document ingestion) | `agent_id`, `vendor`, `policy_id`                                | `pnpm hydradb:ingest-ledger` → `tooling/scripts/hydradb/ingest-cre-ledger.ts` | ✅ live (51 runs)                                     |
| 2   | **GitHub** (issues + PRs + commits)             | `agent_id` (author login)                                        | `pnpm hydradb:github` → `tooling/scripts/hydradb/connectors/github.ts`        | ✅ live (328 records)                                 |
| 3   | **Linear** (issues)                             | `agent_id` (assignee email → GitHub login via identity map)      | `pnpm hydradb:linear` → `tooling/scripts/hydradb/connectors/linear.ts`        | ✅ live (10 issues)                                   |
| 4   | **Attio** (people + companies)                  | people → `agent_id` (email → GitHub login); companies → `vendor` | `pnpm hydradb:attio` → `tooling/scripts/hydradb/connectors/attio.ts`          | 🔗 ready to run (`ATTIO_API_KEY` + `ATTIO_WORKSPACE`) |

### Cross-source identity mapping

The same human operator appears under different ids across sources. The Linear
connector maps `papaandthejimjams@gmail.com` (Linear) → `thisyearnofear`
(GitHub) via `LINEAR_TO_GITHUB_LOGIN` in `linear.ts`, so HydraDB's graph
deduplicates them as one entity. The audit-ledger machine agents
(`http-verify-agent`, `project-a-agent`, `agent-1`) are linked to Linear
issues via `referencedAgent` detection (issues that mention an agent in their
title/description get a forceful relation to `cognivern_agent_<agentId>`).

### Verified cross-source queries

- **Multi-hop**: "Who filed the stable-email investigation in Linear, and what
  did http-verify-agent spend on stable-email?" → returns Linear THI-5 (filed
  by thisyearnofear) + 5 cognivern audit runs (http-verify-agent +
  project-a-agent spending on stable-email). Sources: `linear`, `cognivern_audit`.
- **Fast metadata filter**: `origin: linear` → 677ms, Linear issues only.
- **Cross-source dedup**: the `stable-email` vendor entity joins Linear issues
  to audit-ledger runs across both sources in a single thinking query.

HydraDB does **not** pull from connectors itself — you extract and push via
`app_knowledge`. This is by design (the challenge judges ingestion handling).

> **Connector extractors for GitHub, Linear, and Attio are built.** GitHub pulls
> issues + PRs + commits (commits have human authors that dedup with
> audit-ledger operators; issues in this repo are mostly dependabot bots).
> Linear pulls issues via GraphQL (needs `LINEAR_API_KEY`). Attio pulls people +
> companies via the REST API (needs `ATTIO_API_KEY` and `ATTIO_WORKSPACE` for a
> personal access token). All map the author/assignee to `agent_id` for
> cross-source dedup. Run `pnpm hydradb:github`, `pnpm hydradb:linear`, and
> `pnpm hydradb:attio`.

## Difficult retrieval questions (challenge: category coverage)

The general HydraDB challenge question set lives in
`tooling/scripts/hydradb/questions.ts` and exercises every category the
challenge names. The separate mandate evaluation lives in
`tooling/scripts/hydradb/mandate-evaluation.ts`; it generates 16 questions from
one authoritative mandate at runtime and compares graph retrieval with a
no-graph baseline. Each set is tagged with its retrieval category and expected
answer:

| #   | Question                                                                                 | Category                   | Expected mode |
| --- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------- |
| 1   | What did http-verify-agent spend on stable-email on 2026-06-16, and was the tx recorded? | temporal reasoning         | thinking      |
| 2   | stable-email spend (metadata filter)                                                     | metadata filtering         | fast          |
| 3   | The same vendor stable-email appears in audit + Linear — are they the same entity?       | entity dedup               | thinking      |
| 4   | Who filed the Linear issue about stable-email, and what did http-verify-agent spend?     | actor-based + multi-hop    | thinking      |
| 5   | What did thisyearnofear file about stable-email, and what was the on-chain status?       | multi-hop (2 hops)         | thinking      |
| 6   | What commits did thisyearnofear make, and what did http-verify-agent spend?              | third-party attribution    | thinking      |
| 7   | Linear issues (metadata filter origin=linear)                                            | metadata filtering         | fast          |
| 8   | ¿Cuál fue el gasto del agente http-verify-agent en stable-email?                         | multilingual               | thinking      |
| 9   | What issues are in the Cognivern Governance project referencing http-verify-agent?       | actor-based                | thinking      |
| 10  | Most recent spend run (metadata filter origin=cognivern_audit)                           | knowledge updates          | fast          |
| 11  | Companies in the Attio CRM (metadata filter origin=attio_company)                        | metadata filtering (Attio) | fast          |

## Benchmark / submission

The benchmark runner executes the question set and records per-question
accuracy, latency, HydraDB call count, fast/thinking usage, and notional cost.

```bash
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:benchmark
```

### Latest results (live, free tier)

| Metric                                   | Value            |
| ---------------------------------------- | ---------------- |
| Accuracy                                 | **11/11 (100%)** |
| Mode match (router picked expected mode) | **11/11 (100%)** |
| Avg latency                              | 3735ms           |
| Total HydraDB calls                      | 12               |
| Total notional cost                      | $0.0088          |
| Fast used                                | 4                |
| Thinking used                            | 7                |

| ID  | Category                   | Mode              | Pass | Latency | Calls | Cost    | Sources             |
| --- | -------------------------- | ----------------- | ---- | ------- | ----- | ------- | ------------------- |
| q1  | temporal_reasoning         | thinking          | ✓    | 5897ms  | 1     | $0.0010 | audit+linear+github |
| q2  | metadata_filtering         | fast              | ✓    | 717ms   | 1     | $0.0002 | linear+audit        |
| q3  | entity_deduplication       | thinking          | ✓    | 5876ms  | 1     | $0.0010 | audit+linear+github |
| q4  | actor_based                | thinking          | ✓    | 6070ms  | 1     | $0.0010 | linear+audit        |
| q5  | multi_hop                  | thinking (2 hops) | ✓    | 8882ms  | 2     | $0.0020 | linear+audit        |
| q6  | third_party_attribution    | thinking          | ✓    | 2345ms  | 1     | $0.0010 | all 4               |
| q7  | metadata_filtering         | fast              | ✓    | 561ms   | 1     | $0.0002 | linear              |
| q8  | multilingual               | thinking          | ✓    | 3632ms  | 1     | $0.0010 | audit+linear+github |
| q9  | actor_based                | thinking          | ✓    | 5847ms  | 1     | $0.0010 | audit+linear+github |
| q10 | knowledge_updates          | fast              | ✓    | 706ms   | 1     | $0.0002 | audit               |
| q11 | metadata_filtering (Attio) | fast              | ✓    | 552ms   | 1     | $0.0002 | attio               |

**Fast vs thinking split**: fast mode (metadata-filtered lookups — incl. the
Attio test) averages **634ms / $0.0002**; thinking mode (multi-hop,
cross-source, graph traversal) averages **5507ms / $0.0010**. The router
correctly routes single-hop filtered queries to fast mode and multi-hop /
cross-source queries to thinking — the core latency/accuracy tradeoff the
challenge judges.

Full JSON results: `docs/hydradb-benchmark-results.json`.

## Proof of live (judge-verifiable)

**Demo video (60s):** https://youtu.be/snC7e7BBT8s

The integration is **live and reproducible**, not demo-only. Three independent
ways to verify:

1. **HydraDB's hosted dashboard** — the `cognivern` database holds the ingested
   cross-source records. Screenshot: [`docs/hydradb-proof/hydradb-dashboard.png`](hydradb-proof/hydradb-dashboard.png).
   This lives in HydraDB's cloud, independent of any server you run, so it's
   verifiable on the free tier.
2. **Benchmark output** — `pnpm hydradb:benchmark` runs live against HydraDB and
   prints the accuracy/latency/cost table (11/11, avg 3735ms, $0.0088).
   Screenshot: [`docs/hydradb-proof/benchmark.png`](hydradb-proof/benchmark.png).
3. **Connector counts** — audit (51 runs) + GitHub (328 commits/issues) + Linear
   (10 issues) + Attio (10 companies) are all ingested as `app_knowledge`, and
   the retrieval question set in `tooling/scripts/hydradb/questions.ts` is grounded in
   that real data (expected vs actual answers are graded in `benchmark.ts`).

## Files

| File                                                      | Purpose                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/backend/services/hydradb/HydraDbClient.ts`           | HTTP client (v2 API, retry, envelope unwrap)                      |
| `src/backend/services/hydradb/HydraDbIngestionService.ts` | CRE run → app_knowledge mapper + ingest                           |
| `src/backend/services/hydradb/HydraDbRetrievalService.ts` | fast/thinking router + multi-hop + metrics                        |
| `src/backend/services/hydradb/HydraDbMandateContextRecords.ts` | mandate/outcome/statement graph record mappers               |
| `src/backend/services/hydradb/HydraDbMandateContextService.ts` | workspace sync, durable recovery worker, mandate context |
| `src/backend/services/hydradb/index.ts`                   | barrel export + singletons                                        |
| `tooling/scripts/hydradb/smoke-test.ts`                   | end-to-end lifecycle smoke test                                   |
| `tooling/scripts/hydradb/mandate-evaluation.ts`           | single/cohort graph-vs-no-graph mandate evaluation                |
| `tooling/scripts/hydradb/seed-mandate-evaluation.ts`      | additive local single-mandate evaluation seed                     |
| `tooling/scripts/hydradb/seed-mandate-evaluation-cohort.ts` | additive local representative mandate cohort seed              |
| `tooling/scripts/hydradb/ingest-cre-ledger.ts`            | ingest `data/cre-runs.jsonl` → HydraDB                            |
| `tooling/scripts/hydradb/connectors/github.ts`            | GitHub issues/PRs/commits → HydraDB                               |
| `tooling/scripts/hydradb/connectors/linear.ts`            | Linear issues → HydraDB                                           |
| `tooling/scripts/hydradb/connectors/attio.ts`             | Attio people/companies → HydraDB                                  |
| `src/config.ts`                                           | `HYDRADB_*` env schema (all optional, gated by `HYDRADB_ENABLED`) |

## Production checklist

Before treating mandate context as production-ready in a deployment, verify:

- the real workspace collection contains only records for that workspace;
- every returned chunk has the requested `mandate_id` and Cognivern provenance;
- outcome notes and raw external references are absent from the derived index;
- a disabled/unavailable HydraDB leaves spend, statements, recommendations, and
  policy gates operational;
- a representative held-out evaluation is run after schema, retrieval, or
  routing changes;
- graph latency is acceptable for the review surface, with a visible fallback
  when indexing is pending or the service is unavailable;
- the SQLite-backed sync job worker is running with the API, and stale jobs can
  be inspected/retried without affecting authoritative spend records.

The evaluation artifact is a useful regression signal, not a substitute for
these tenancy and fail-open checks. Do not use the seeded IDs as production
identifiers.

## Toggle / disable

Set `HYDRADB_ENABLED=false` (or unset). All services return null/empty, make
no network calls, and cognivern operates identically to pre-integration. No
data is lost — the cognivern audit ledger (`data/cre-runs.jsonl` + MongoDB)
remains the source of truth; HydraDB is a derived context mirror for retrieval.
