/**
 * HydraDbRetrievalService — query layer with a fast/thinking mode router.
 *
 * The router is the differentiator for the HydraDB challenge's
 * "latency vs accuracy" competition: most questions should resolve in fast
 * mode (sub-second, cheap), with thinking mode reserved for questions that
 * genuinely need graph traversal / multi-hop / entity dedup.
 *
 * Every query records metrics (mode, latency, call count, hit/miss) so the
 * benchmark table can be produced from real runs.
 *
 * All methods no-op (return empty results) when HydraDB is disabled.
 */

import logger from "@backend/utils/logger.js";
import { config } from "../../../config.js";
import { HydraDbClient, type HydraDbQueryResult, type HydraDbChunk } from "./HydraDbClient.js";

export type RetrievalMode = "fast" | "thinking";

export interface RetrievalRequest {
  query: string;
  collection?: string;
  type?: "knowledge" | "memory" | "all";
  maxResults?: number;
  metadataFilters?: Record<string, unknown>;
  /** Override the router; force a specific mode. */
  forceMode?: RetrievalMode;
  /** Hint appended to the query for additional_context. */
  additionalContext?: string;
  /** App-aware retrieval lane (for app-source records). */
  queryApps?: boolean;
  /** Override graph traversal for evaluation baselines. */
  graphContext?: boolean;
  /** Override forceful relation traversal for evaluation baselines. */
  queryForcefulRelations?: boolean;
}

export interface RetrievalMetrics {
  mode: RetrievalMode;
  latencyMs: number;
  hydraDbCalls: number;
  resultCount: number;
  topScore?: number;
  requestId?: string;
  /** Why the router chose this mode. */
  routingReason: string;
  estimatedCostUsd: number;
}

export interface RetrievalOutcome {
  chunks: HydraDbChunk[];
  raw: HydraDbQueryResult;
  metrics: RetrievalMetrics;
}

/**
 * Heuristic cost model for the benchmark. HydraDB free tier is unlimited,
 * but we estimate a notional cost so the submission has a cost column.
 * Thinking mode is ~5x the notional per-call cost of fast mode.
 */
const NOTIONAL_FAST_COST = 0.0002;
const NOTIONAL_THINKING_COST = 0.001;

/**
 * The router. Classifies a question to decide fast vs thinking.
 *
 * Fast mode is correct when:
 *  - The question is single-hop (one entity, one fact)
 *  - A metadata filter can pin the answer deterministically
 *  - It's a keyword/phrase lookup
 *
 * Thinking mode is needed when:
 *  - Multi-hop: answer requires chaining 2+ entities/relations
 *  - Temporal reasoning ("what changed since X")
 *  - Entity deduplication ("the same person across sources")
 *  - Third-party attribution ("who said X about Y")
 *  - Thread / conversation understanding
 *  - Cross-source synthesis
 */
export function classifyQuery(query: string, req: RetrievalRequest): {
  mode: RetrievalMode;
  reason: string;
} {
  if (req.forceMode) {
    return { mode: req.forceMode, reason: `forced by caller` };
  }

  const q = query.toLowerCase();

  // Multi-hop signals — require graph traversal.
  const multiHopSignals = [
    /\bwho .*(and|then|which|what).*(say|filed|worked|did|approved|spent)\b/,
    /\bwhich project.*(work|assigned|on)\b/,
    /\bwhat did .*(say|do|approve|spend)\b.*\bin\b/,
    /\bacross\b/,
    /\bsame (person|agent|vendor|user)\b/,
    /\bconnect(ed)?\b/,
    /\brelat(ed|ion)\b/,
  ];
  for (const re of multiHopSignals) {
    if (re.test(q)) {
      return { mode: "thinking", reason: "multi-hop / cross-source signal detected" };
    }
  }

  // Temporal reasoning.
  if (/\b(since|after|before|between|yesterday|last week|recently|changed|updated)\b/.test(q)) {
    return { mode: "thinking", reason: "temporal reasoning required" };
  }

  // Entity dedup / attribution.
  if (/\b(who (filed|said|approved|requested|initiated))\b/.test(q)) {
    return { mode: "thinking", reason: "actor attribution required" };
  }

  // Thread understanding.
  if (/\b(thread|conversation|reply|re:|in response)\b/.test(q)) {
    return { mode: "thinking", reason: "thread understanding required" };
  }

  // If a metadata filter is present AND the question is short/single-entity,
  // fast mode is sufficient — the filter does the heavy lifting.
  if (req.metadataFilters && q.split(/\s+/).length < 12) {
    return { mode: "fast", reason: "metadata-filtered single-entity lookup" };
  }

  // Default: fast for short factual questions, thinking for longer ones.
  if (q.split(/\s+/).length <= 8) {
    return { mode: "fast", reason: "short factual lookup" };
  }

  // Longer open-ended question — let thinking handle it.
  return { mode: "thinking", reason: "open-ended multi-clause question" };
}

export class HydraDbRetrievalService {
  private client: HydraDbClient | null = null;
  private database: string;
  private collection: string;
  private defaultMode: "fast" | "thinking" | "auto";

  constructor() {
    this.database = config.HYDRADB_DATABASE;
    this.collection = config.HYDRADB_COLLECTION;
    this.defaultMode = config.HYDRADB_DEFAULT_MODE;
  }

  private getClient(): HydraDbClient | null {
    if (!HydraDbClient.isEnabled()) return null;
    if (!this.client) this.client = new HydraDbClient();
    return this.client;
  }

  isEnabled(): boolean {
    return HydraDbClient.isEnabled();
  }

  /**
   * Retrieve with automatic mode routing. Returns chunks + metrics.
   * This is the primary entry point for the benchmark and the agent.
   */
  async retrieve(req: RetrievalRequest): Promise<RetrievalOutcome> {
    const client = this.getClient();
    const started = Date.now();

    if (!client) {
      return {
        chunks: [],
        raw: {},
        metrics: {
          mode: "fast",
          latencyMs: 0,
          hydraDbCalls: 0,
          resultCount: 0,
          routingReason: "hydradb disabled",
          estimatedCostUsd: 0,
        },
      };
    }

    const classification =
      this.defaultMode === "auto"
        ? classifyQuery(req.query, req)
        : { mode: this.defaultMode as RetrievalMode, reason: `default mode (${this.defaultMode})` };

    const mode = classification.mode;
    const calls = 1;

    try {
      const result = await client.query({
        database: this.database,
        collection: req.collection ?? this.collection,
        query: req.query,
        type: req.type ?? "knowledge",
        queryBy: "hybrid",
        mode,
        maxResults: req.maxResults ?? 10,
        graphContext: req.graphContext ?? mode === "thinking",
        queryForcefulRelations: req.queryForcefulRelations ?? mode === "thinking",
        additionalContext: req.additionalContext,
        metadataFilters: req.metadataFilters,
        queryApps: req.queryApps,
        alpha: mode === "thinking" ? "auto" : undefined,
      });

      const latencyMs = Date.now() - started;
      const chunks = result.chunks ?? [];
      const topScore = chunks[0]?.relevancy_score;

      return {
        chunks,
        raw: result,
        metrics: {
          mode,
          latencyMs,
          hydraDbCalls: calls,
          resultCount: chunks.length,
          topScore,
          requestId: result._meta?.request_id,
          routingReason: classification.reason,
          estimatedCostUsd:
            mode === "thinking" ? NOTIONAL_THINKING_COST : NOTIONAL_FAST_COST,
        },
      };
    } catch (err) {
      logger.warn(`[hydradb] retrieve failed (mode=${mode}): ${err}`);
      return {
        chunks: [],
        raw: {},
        metrics: {
          mode,
          latencyMs: Date.now() - started,
          hydraDbCalls: calls,
          resultCount: 0,
          routingReason: `error: ${err instanceof Error ? err.message : String(err)}`,
          estimatedCostUsd: 0,
        },
      };
    }
  }

  /**
   * Multi-hop retrieval: run a sequence of queries where each step's
   * results feed the next. Used for questions like "who filed BUG-123,
   * which project are they on, and what did they say in Slack".
   *
   * Each hop is a separate HydraDB call (counted in metrics). The first hop
   * is typically thinking (entity resolution); subsequent hops can be fast
   * once the entity is pinned via metadata filter.
   */
  async retrieveMultiHop(
    hops: Array<{ query: string; metadataFilters?: Record<string, unknown>; forceMode?: RetrievalMode }>,
    opts?: { collection?: string; maxResults?: number },
  ): Promise<{ chunks: HydraDbChunk[]; hops: RetrievalOutcome[]; totalMetrics: RetrievalMetrics }> {
    const client = this.getClient();
    if (!client) {
      return {
        chunks: [],
        hops: [],
        totalMetrics: {
          mode: "fast",
          latencyMs: 0,
          hydraDbCalls: 0,
          resultCount: 0,
          routingReason: "hydradb disabled",
          estimatedCostUsd: 0,
        },
      };
    }

    const outcomes: RetrievalOutcome[] = [];
    const allChunks: HydraDbChunk[] = [];
    let totalCost = 0;
    let totalLatency = 0;

    for (const hop of hops) {
      const outcome = await this.retrieve({
        query: hop.query,
        collection: opts?.collection,
        metadataFilters: hop.metadataFilters,
        forceMode: hop.forceMode ?? "thinking",
        maxResults: opts?.maxResults ?? 5,
      });
      outcomes.push(outcome);
      allChunks.push(...outcome.chunks);
      totalCost += outcome.metrics.estimatedCostUsd;
      totalLatency += outcome.metrics.latencyMs;
    }

    // Dedup chunks by chunk_uuid / id.
    const seen = new Set<string>();
    const deduped = allChunks.filter((c) => {
      const key = c.chunk_uuid ?? c.id ?? JSON.stringify(c).slice(0, 64);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      chunks: deduped,
      hops: outcomes,
      totalMetrics: {
        mode: "thinking",
        latencyMs: totalLatency,
        hydraDbCalls: outcomes.length,
        resultCount: deduped.length,
        routingReason: `multi-hop (${outcomes.length} queries)`,
        estimatedCostUsd: totalCost,
      },
    };
  }

  /**
   * Build a compact context string from retrieval chunks for LLM prompting.
   * Mirrors the SDK's buildString() helper but works on our typed chunks.
   */
  buildContextString(chunks: HydraDbChunk[]): string {
    if (chunks.length === 0) return "[no context retrieved]";
    return chunks
      .map((c, i) => {
        const parts = [
          `[${i + 1}] ${c.source_title ?? c.source_type ?? "source"}`,
          c.chunk_content ?? "",
        ];
        const meta = c.additional_metadata ?? {};
        if (meta.run_id || meta.agent_id || meta.vendor) {
          parts.push(
            `  meta: ${JSON.stringify({ run_id: meta.run_id, agent_id: meta.agent_id, vendor: meta.vendor })}`,
          );
        }
        return parts.join("\n");
      })
      .join("\n\n---\n\n");
  }
}

/** Singleton. */
export const hydraDbRetrieval = new HydraDbRetrievalService();
