/**
 * HydraDbIngestionService — maps cognivern domain objects to HydraDB
 * app-knowledge records and ingests them.
 *
 * The core insight: cognivern's CRE run ledger is rich, entity-bearing data
 * (agentId, recipient/vendor, amount, asset, policyId, walletId, chain,
 * txHash, status). Ingesting it as HydraDB `app_knowledge` with stable IDs
 * and `tenant_metadata` hot-filters lets the retrieval layer answer
 * cross-source questions like "what did agent X spend on vendor Y, and what
 * did the team say about it in Slack" — the multi-hop / actor-based queries
 * the HydraDB challenge is built around.
 *
 * All methods no-op when HydraDB is disabled (HYDRADB_ENABLED=false).
 */

import logger from "@backend/utils/logger.js";
import { config } from "@/config.js";
import { HydraDbClient } from "./HydraDbClient.js";
import type { CreRun } from "@backend/cre/types.js";

/**
 * Database metadata schema — hot-filterable fields declared at creation.
 *
 * NOTE: HydraDB's free tier enforces a tight metadata-index limit ("Index
 * limit exceeded" even with 3 enable_match fields). We therefore create the
 * database with NO declared schema and put all filterable fields in
 * `additional_metadata` instead. They remain queryable via
 * `metadata_filters.additional_metadata` — just not pre-indexed. This is the
 * correct tradeoff for the free tier; revisit if we upgrade.
 */
export const COGNIVERN_DB_SCHEMA: never[] = [];

export interface AppKnowledgeRecord {
  id: string;
  database?: string;
  collection?: string;
  title: string;
  type: string; // "audit" | "run" | "slack" | "github" | "linear" | ...
  url?: string;
  timestamp: string;
  content: { text: string; markdown?: string };
  tenant_metadata: Record<string, string>;
  additional_metadata: Record<string, unknown>;
  relations?: { ids: string[]; properties?: Record<string, unknown> };
}

export class HydraDbIngestionService {
  private client: HydraDbClient | null = null;
  private database: string;
  private collection: string;

  constructor() {
    this.database = config.HYDRADB_DATABASE;
    this.collection = config.HYDRADB_COLLECTION;
  }

  private getClient(): HydraDbClient | null {
    if (!HydraDbClient.isEnabled()) {
      return null;
    }
    if (!this.client) {
      this.client = new HydraDbClient();
    }
    return this.client;
  }

  /** True when ingestion will actually write to HydraDB. */
  isEnabled(): boolean {
    return HydraDbClient.isEnabled();
  }

  /**
   * Ensure the database exists and is ready for ingestion. Idempotent —
   * safe to call on every boot. Creates with the cognivern schema if missing.
   */
  async ensureDatabase(): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      await client.createDatabase({
        database: this.database,
        // No schema on free tier (index limit). All filters via additional_metadata.
        database_metadata_schema: undefined,
      });
      logger.info(`[hydradb] database '${this.database}' created`);
    } catch (err) {
      // 409 DATABASE_ALREADY_EXISTS is expected on subsequent boots.
      if (err instanceof Error && /already exists/i.test(err.message)) {
        logger.debug(`[hydradb] database '${this.database}' already exists`);
      } else {
        logger.warn(`[hydradb] createDatabase failed (will continue if it exists): ${err}`);
      }
    }

    // Poll readiness.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const status = await client.getDatabaseStatus(this.database);
        if (status.infra?.ready_for_ingestion) {
          logger.info(`[hydradb] database '${this.database}' ready for ingestion`);
          return true;
        }
      } catch (err) {
        logger.debug(`[hydradb] status poll error: ${err}`);
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    logger.warn(`[hydradb] database not ready after 60s — ingestion may fail`);
    return false;
  }

  /**
   * Ingest a CRE run as app-knowledge. Extracts the spend intent + attestation
   * into a searchable record keyed on agentId + vendor + runId.
   */
  async ingestCreRun(run: CreRun): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const intent = this.extractSpendIntent(run);
    if (!intent) {
      // Non-spend runs (forecasting, registration) — still ingest as a run record.
      const record = this.runToRecord(run, null);
      return this.ingestRecords([record]);
    }

    const record = this.runToRecord(run, intent);
    return this.ingestRecords([record]);
  }

  /** Ingest many CRE runs at once (batch). */
  async ingestCreRuns(runs: CreRun[]): Promise<string[] | null> {
    const client = this.getClient();
    if (!client) return null;

    const records: AppKnowledgeRecord[] = [];
    for (const run of runs) {
      const intent = this.extractSpendIntent(run);
      records.push(this.runToRecord(run, intent));
    }
    const id = await this.ingestRecords(records);
    return id ? [id] : null;
  }

  /**
   * Ingest an arbitrary app-knowledge record (Slack message, GitHub issue,
   * Linear ticket, etc.). This is the generic connector entry point.
   */
  async ingestAppRecord(record: AppKnowledgeRecord): Promise<string | null> {
    return this.ingestRecords([record]);
  }

  async ingestAppRecords(records: AppKnowledgeRecord[]): Promise<string | null> {
    return this.ingestRecords(records);
  }

  /** Ingest a memory (user/agent-scoped preference or decision context). */
  async ingestMemory(params: {
    collection: string; // agent_id or user_id
    id: string;
    text: string;
    title?: string;
    infer?: boolean;
    userName?: string;
    additionalMetadata?: Record<string, unknown>;
    relations?: { ids: string[] };
  }): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const result = await client.ingest({
        type: "memory",
        database: this.database,
        collection: params.collection,
        memories: [
          {
            id: params.id,
            title: params.title ?? "Cognivern memory",
            text: params.text,
            infer: params.infer ?? true,
            user_name: params.userName,
            additional_metadata: params.additionalMetadata,
            relations: params.relations,
          },
        ],
      });
      const id = result.results?.[0]?.id;
      logger.debug(`[hydradb] ingested memory ${id} into ${params.collection}`);
      return id ?? null;
    } catch (err) {
      logger.warn(`[hydradb] memory ingest failed: ${err}`);
      return null;
    }
  }

  // ── Internal mappers ────────────────────────────────────────────────────

  private extractSpendIntent(run: CreRun): Record<string, unknown> | null {
    const spendArtifact = run.artifacts?.find((a) => a.type === "spend_intent");
    if (spendArtifact?.data) return spendArtifact.data as Record<string, unknown>;
    // Fallback: scan events for a tool_call_started with intent details.
    for (const ev of run.events ?? []) {
      const details = ev.payload?.details as Record<string, unknown> | undefined;
      const intent = details?.intent as Record<string, unknown> | undefined;
      if (intent) return intent;
    }
    return null;
  }

  private runToRecord(
    run: CreRun,
    intent: Record<string, unknown> | null,
  ): AppKnowledgeRecord {
    const agentId = (intent?.agentId as string) ?? "unknown-agent";
    const vendor =
      ((intent?.metadata as Record<string, unknown>)?.vendor as string) ??
      (intent?.recipient as string) ??
      "unknown-vendor";
    const amount = intent?.amount as string | undefined;
    const asset = intent?.asset as string | undefined;
    const chain = ((intent?.metadata as Record<string, unknown>)?.chain as string) ?? undefined;
    const reason = intent?.reason as string | undefined;
    const policyId = ((intent?.metadata as Record<string, unknown>)?.policyId as string) ?? undefined;
    const txHash = (run.artifacts?.find((a) => a.type === "attestation_result")?.data as
      | { txHash?: string }
      | undefined)?.txHash;
    const status = (run.artifacts?.find((a) => a.type === "attestation_result")?.data as
      | { status?: string }
      | undefined)?.status;
    const ts = run.startedAt;

    const text = [
      `Spend run ${run.runId} (${run.workflow}/${run.status ?? "unknown"})`,
      intent
        ? `Agent ${agentId} spent ${amount ?? "?"} ${asset ?? ""} to vendor ${vendor}${chain ? ` on ${chain}` : ""}.`
        : `Run ${run.runId} (${run.workflow}) ${run.status ?? "completed"}.`,
      reason ? `Reason: ${reason}` : "",
      policyId ? `Policy: ${policyId}` : "",
      txHash ? `Tx: ${txHash}` : "",
      status ? `Decision: ${status}` : "",
      run.metrics?.latencyMs ? `Latency: ${run.metrics.latencyMs}ms` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      id: `cognivern_run_${run.runId}`,
      database: this.database,
      collection: this.collection,
      title: `Spend run ${run.runId} — ${agentId} → ${vendor}`,
      type: "audit",
      url: `https://cognivern.persidian.com/os/runs/${run.runId}`,
      timestamp: ts,
      content: { text },
      // No declared schema on free tier — all filterable fields go in
      // additional_metadata (queryable via metadata_filters.additional_metadata).
      tenant_metadata: {},
      additional_metadata: {
        run_id: run.runId,
        amount,
        asset,
        policy_id: policyId,
        tx_hash: txHash,
        reason,
        ok: run.ok,
        latency_ms: run.metrics?.latencyMs,
        decision: status ?? run.status ?? "unknown",
        workflow: run.workflow,
        chain: chain ?? "unknown",
        ts: ts.slice(0, 10),
        // Entity fields for cross-source dedup + filtering.
        // NOTE: "source_type" is reserved by HydraDB; use "origin" instead.
        agent_id: agentId,
        vendor,
        origin: "cognivern_audit",
      },
      relations: {
        ids: [
          `cognivern_agent_${agentId}`,
          vendor ? `cognivern_vendor_${vendor}` : undefined,
          policyId ? `cognivern_policy_${policyId}` : undefined,
        ].filter((x): x is string => Boolean(x)),
        properties: { relation: "same_run" },
      },
    };
  }

  private async ingestRecords(records: AppKnowledgeRecord[]): Promise<string | null> {
    const client = this.getClient();
    if (!client || records.length === 0) return null;

    try {
      const result = await client.ingest({
        type: "knowledge",
        database: this.database,
        collection: this.collection,
        appKnowledge: records,
        upsert: true,
      });
      const id = result.results?.[0]?.id;
      logger.info(`[hydradb] ingested ${records.length} record(s); ingest id=${id}`);
      return id ?? null;
    } catch (err) {
      logger.warn(`[hydradb] app-knowledge ingest failed: ${err}`);
      return null;
    }
  }

  /**
   * Poll indexing status for ingested ids until searchable.
   * Returns when status is graph_creation or completed (searchable),
   * or throws on errored/failed.
   */
  async waitForIndexing(ids: string[], timeoutMs = 120_000): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await client.getContextStatus({
          database: this.database,
          collection: this.collection,
          ids,
        });
        const statuses = res.statuses ?? [];
        const allSearchable = statuses.every((s) =>
          ["graph_creation", "completed"].includes(s.indexing_status),
        );
        const anyFailed = statuses.some((s) =>
          ["errored", "failed"].includes(s.indexing_status),
        );
        if (anyFailed) {
          const failed = statuses.find((s) =>
            ["errored", "failed"].includes(s.indexing_status),
          );
          throw new Error(
            `HydraDB indexing failed: ${failed?.error_message ?? failed?.message ?? "unknown"}`,
          );
        }
        if (allSearchable && statuses.length === ids.length) {
          return true;
        }
      } catch (err) {
        logger.debug(`[hydradb] indexing poll error: ${err}`);
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }
    logger.warn(`[hydradb] indexing not complete after ${timeoutMs}ms (may still be searchable)`);
    return false;
  }
}

/** Singleton — import this everywhere. No-ops when disabled. */
export const hydraDbIngestion = new HydraDbIngestionService();
