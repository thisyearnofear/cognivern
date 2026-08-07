# HydraDB — Agentic Memory & Cross-Source Retrieval

HydraDB is an agentic-memory / retrieval substrate that cognivern uses as an
**optional, toggleable** layer for cross-source retrieval over its audit and
run-ledger data. When enabled, cognivern's spend-governance decisions, agent
runs, and surrounding SaaS context (GitHub, Linear) are mirrored into HydraDB
as `app_knowledge` records, and a fast/thinking-routed query layer answers
multi-hop questions across all of them.

This integration was built for the [HydraDB cross-source retrieval
challenge](https://docs.hydradb.com) and is the retrieval substrate behind
cognivern's agent-memory queries.

- **Docs**: https://docs.hydradb.com (v2 API)
- **MCP**: https://github.com/usecortex/hydradb-mcp
- **Dashboard / API keys**: https://app.hydradb.com
- **Free tier**: unlimited API calls & tenants — no credit card required.

## When to enable

| Scenario | Enable? |
| --- | --- |
| You want the cognivern Copilot agent to recall cross-source context (audit + GitHub + Linear) | ✅ |
| You are running the HydraDB challenge benchmark / demo | ✅ |
| You want multi-hop "who spent what, and what did the team say" queries | ✅ |
| Production spend-governance only (policy eval, signing, audit) | ❌ — not needed; cognivern works fully without it |

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
  `cognivern_policy_<policyId>` — forceful relations that `mode: "thinking"`
  traverses for multi-hop queries.
- **`relations.ids`**: `cognivern_agent_<agentId>`, `cognivern_vendor_<vendor>`,
  `cognivern_policy_<policyId>` — forceful relations that `mode: "thinking"`
  traverses for multi-hop queries.

External connectors (GitHub, Linear) push records with the **same
`agent_id` / `vendor`** in `additional_metadata` so HydraDB's graph deduplicates
the same entity across sources — the core of the challenge's "does it connect
references instead of treating them as separate entities" test. The Linear
connector maps the operator's Linear email to their GitHub login via
`LINEAR_TO_GITHUB_LOGIN` so the same human dedups across all three sources.

### The fast/thinking router

`classifyQuery()` in `HydraDbRetrievalService.ts` decides the mode per query:

| Signal | Mode | Reason |
| --- | --- | --- |
| Metadata filter + short question (<12 words) | `fast` | filter does the work |
| Short factual lookup (≤8 words) | `fast` | single-hop |
| Multi-hop phrasing ("who … and what did they say") | `thinking` | graph traversal |
| Temporal ("since", "after", "changed") | `thinking` | temporal reasoning |
| Actor attribution ("who filed/approved") | `thinking` | entity resolution |
| Thread / conversation | `thinking` | thread understanding |
| Long open-ended question | `thinking` | multi-clause |

`forceMode` overrides the router. `retrieveMultiHop()` runs an explicit
sequence of queries (each counted) for questions that need >1 retrieval step.

Every query records `RetrievalMetrics` — `mode`, `latencyMs`, `hydraDbCalls`,
`resultCount`, `topScore`, `routingReason`, `estimatedCostUsd` — so the
benchmark table is produced from real runs.

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
```

The smoke test exercises the full lifecycle (ensureDatabase → ingest →
waitForIndexing → fast retrieve → thinking retrieve → multi-hop) and prints
metrics for each. Exit 0 on success.

## API

### Ingestion (`src/backend/services/hydradb/HydraDbIngestionService.ts`)

```ts
import { hydraDbIngestion } from "@backend/services/hydradb/index.js";

// Ingest a CRE run (auto-extracts spend intent + attestation).
await hydraDbIngestion.ingestCreRun(run);

// Ingest many at once.
await hydraDbIngestion.ingestCreRuns(runs);

// Ingest an external connector record (Slack, GitHub, Linear, ...).
await hydraDbIngestion.ingestAppRecord({
  id: `slack_${channel}_${ts}`,
  database: "cognivern",
  collection: "default",
  title: `#${channel} — ${author}`,
  type: "slack",
  url: `https://...slack.com/archives/...`,
  timestamp: iso,
  content: { text: "..." },
  tenant_metadata: {},  // empty (no schema on free tier)
  additional_metadata: { agent_id, vendor, origin: "slack", workflow, chain, ts },
  additional_metadata: { author, channel, workspace },
  relations: { ids: [`cognivern_agent_${agentId}`] },
});

// Ingest an agent-scoped memory.
await hydraDbIngestion.ingestMemory({
  collection: agentId,           // per-agent partition
  id: `pref_${id}`,
  text: "Agent prefers conservative spend limits.",
  infer: true,
});

// Wait for indexing (searchable).
await hydraDbIngestion.waitForIndexing([id1, id2]);
```

### Retrieval (`src/backend/services/hydradb/HydraDbRetrievalService.ts`)

```ts
import { hydraDbRetrieval } from "@backend/services/hydradb/index.js";

// Auto-routed single query.
const outcome = await hydraDbRetrieval.retrieve({
  query: "What did http-verify-agent spend on stable-email?",
  forceMode: "thinking",          // optional override
  metadataFilters: { tenant_metadata: { agent_id: "http-verify-agent" } },
  maxResults: 10,
});
console.log(outcome.chunks);
console.log(outcome.metrics);    // { mode, latencyMs, hydraDbCalls, cost, ... }

// Explicit multi-hop (each hop = 1 HydraDB call).
const multi = await hydraDbRetrieval.retrieveMultiHop([
  { query: "http-verify-agent spend", forceMode: "thinking" },
  { query: "stable-email", metadataFilters: { tenant_metadata: { vendor: "stable-email" } }, forceMode: "fast" },
  { query: "what was said about http-verify-agent in slack", forceMode: "thinking" },
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
audit ledger is the anchor source; the others are extractors that push
`app_knowledge` records with matching `tenant_metadata`:

| # | Connector | Entity shared | Extractor | Status |
| --- | --- | --- | --- | --- |
| 1 | **Cognivern audit ledger** | `agent_id`, `vendor`, `policy_id` | `pnpm hydradb:ingest-ledger` → `scripts/hydradb/ingest-cre-ledger.ts` | ✅ live (51 runs) |
| 2 | **GitHub** (issues + PRs + commits) | `agent_id` (author login) | `pnpm hydradb:github` → `scripts/hydradb/connectors/github.ts` | ✅ live (328 records) |
| 3 | **Linear** (issues) | `agent_id` (assignee email → GitHub login via identity map) | `pnpm hydradb:linear` → `scripts/hydradb/connectors/linear.ts` | ✅ live (10 issues) |

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

> **Connector extractors for GitHub and Linear are built.** GitHub pulls issues +
> PRs + commits (commits have human authors that dedup with audit-ledger
> operators; issues in this repo are mostly dependabot bots). Linear pulls
> issues via GraphQL (needs `LINEAR_API_KEY`). Both map the author/assignee
> to `agent_id` for cross-source dedup. Run `pnpm hydradb:github` and
> `pnpm hydradb:linear`.

## Difficult retrieval questions (challenge: category coverage)

The question set lives in `scripts/hydradb/questions.ts` (to be added) and
exercises every category the challenge names. Each is tagged with its
retrieval category and expected answer, run against the ingested ledger +
connectors:

| # | Question | Category | Expected mode |
| --- | --- | --- | --- |
| 1 | What did http-verify-agent spend on stable-email on 2026-06-16, and was the tx recorded? | temporal reasoning | thinking |
| 2 | stable-email spend (metadata filter) | metadata filtering | fast |
| 3 | The same vendor stable-email appears in audit + Linear — are they the same entity? | entity dedup | thinking |
| 4 | Who filed the Linear issue about stable-email, and what did http-verify-agent spend? | actor-based + multi-hop | thinking |
| 5 | What did thisyearnofear file about stable-email, and what was the on-chain status? | multi-hop (2 hops) | thinking |
| 6 | What commits did thisyearnofear make, and what did http-verify-agent spend? | third-party attribution | thinking |
| 7 | Linear issues (metadata filter origin=linear) | metadata filtering | fast |
| 8 | ¿Cuál fue el gasto del agente http-verify-agent en stable-email? | multilingual | thinking |
| 9 | What issues are in the Cognivern Governance project referencing http-verify-agent? | actor-based | thinking |
| 10 | Most recent spend run (metadata filter origin=cognivern_audit) | knowledge updates | fast |

## Benchmark / submission

The benchmark runner executes the question set and records per-question
accuracy, latency, HydraDB call count, fast/thinking usage, and notional cost.

```bash
HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:benchmark
```

### Latest results (live, free tier)

| Metric | Value |
| --- | --- |
| Accuracy | **10/10 (100%)** |
| Mode match (router picked expected mode) | **10/10 (100%)** |
| Avg latency | 4389ms |
| Total HydraDB calls | 11 |
| Total notional cost | $0.0086 |
| Fast used | 3 |
| Thinking used | 7 |

| ID | Category | Mode | Pass | Latency | Calls | Cost | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- |
| q1 | temporal_reasoning | thinking | ✓ | 4337ms | 1 | $0.0010 | audit+linear+github |
| q2 | metadata_filtering | fast | ✓ | 785ms | 1 | $0.0002 | linear+audit |
| q3 | entity_deduplication | thinking | ✓ | 4616ms | 1 | $0.0010 | all 3 |
| q4 | actor_based | thinking | ✓ | 6677ms | 1 | $0.0010 | linear+audit |
| q5 | multi_hop | thinking (2 hops) | ✓ | 9651ms | 2 | $0.0020 | linear+audit |
| q6 | third_party_attribution | thinking | ✓ | 7411ms | 1 | $0.0010 | all 3 |
| q7 | metadata_filtering | fast | ✓ | 731ms | 1 | $0.0002 | linear |
| q8 | multilingual | thinking | ✓ | 3166ms | 1 | $0.0010 | all 3 |
| q9 | actor_based | thinking | ✓ | 5858ms | 1 | $0.0010 | all 3 |
| q10 | knowledge_updates | fast | ✓ | 654ms | 1 | $0.0002 | audit |

**Fast vs thinking split**: fast mode (metadata-filtered lookups) averages
**723ms / $0.0002**; thinking mode (multi-hop, cross-source, graph
traversal) averages **5445ms / $0.0010**. The router correctly routes
single-hop filtered queries to fast mode and multi-hop/cross-source queries
to thinking — the core latency/accuracy tradeoff the challenge judges.

Full JSON results: `docs/hydradb-benchmark-results.json`.

## Files

| File | Purpose |
| --- | --- |
| `src/backend/services/hydradb/HydraDbClient.ts` | HTTP client (v2 API, retry, envelope unwrap) |
| `src/backend/services/hydradb/HydraDbIngestionService.ts` | CRE run → app_knowledge mapper + ingest |
| `src/backend/services/hydradb/HydraDbRetrievalService.ts` | fast/thinking router + multi-hop + metrics |
| `src/backend/services/hydradb/index.ts` | barrel export + singletons |
| `scripts/hydradb/smoke-test.ts` | end-to-end lifecycle smoke test |
| `scripts/hydradb/ingest-cre-ledger.ts` | ingest `data/cre-runs.jsonl` → HydraDB |
| `src/config.ts` | `HYDRADB_*` env schema (all optional, gated by `HYDRADB_ENABLED`) |

## Toggle / disable

Set `HYDRADB_ENABLED=false` (or unset). All services return null/empty, make
no network calls, and cognivern operates identically to pre-integration. No
data is lost — the cognivern audit ledger (`data/cre-runs.jsonl` + MongoDB)
remains the source of truth; HydraDB is a read-only mirror for retrieval.
