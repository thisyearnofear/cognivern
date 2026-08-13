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
import { config } from "../../../config.js";
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
  /** HydraDB app-source shape; custom records use kind=custom and fields.body. */
  kind?: string;
  fields?: Record<string, unknown>;
  url?: string;
  timestamp: string;
  content: { text: string; markdown?: string };
  tenant_metadata: Record<string, string>;
  additional_metadata: Record<string, unknown>;
  relations?: { ids: string[]; cortex_source_ids?: string[] };
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
  async ingestCreRun(run: CreRun, collection = this.collection): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const intent = this.extractSpendIntent(run);
    const record = this.runToRecord(run, intent, collection);
    const ids = await this.ingestRecords([record], collection);
    return ids?.[0] ?? null;
  }

  /** Ingest many CRE runs at once (batch). */
  async ingestCreRuns(runs: CreRun[], collection = this.collection): Promise<string[] | null> {
    const client = this.getClient();
    if (!client) return null;

    const records: AppKnowledgeRecord[] = [];
    for (const run of runs) {
      const intent = this.extractSpendIntent(run);
      records.push(this.runToRecord(run, intent, collection));
    }
    return this.ingestRecords(records, collection);
  }

  /**
   * Ingest an arbitrary app-knowledge record (Slack message, GitHub issue,
   * Linear ticket, etc.). This is the generic connector entry point.
   */
  async ingestAppRecord(record: AppKnowledgeRecord, collection = this.collection): Promise<string | null> {
    const ids = await this.ingestRecords([record], collection);
    return ids?.[0] ?? null;
  }

  async ingestAppRecords(records: AppKnowledgeRecord[], collection = this.collection): Promise<string | null> {
    const ids = await this.ingestRecords(records, collection);
    return ids?.[0] ?? null;
  }

  /** Return every provider ingest id so callers can wait for all records in a batch. */
  async ingestAppRecordIds(records: AppKnowledgeRecord[], collection = this.collection): Promise<string[] | null> {
    return this.ingestRecords(records, collection);
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
    relations?: { ids: string[]; cortex_source_ids?: string[] };
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
    collection = this.collection,
  ): AppKnowledgeRecord {
    const attribution = run.artifacts?.find((a) => a.type === "capital_attribution")?.data as
      | Record<string, unknown>
      | undefined;
    const intentMetadata = intent?.metadata as Record<string, unknown> | undefined;
    const agentId =
      (intent?.agentId as string) ??
      (attribution?.agentId as string) ??
      "unknown-agent";
    const vendor =
      (intentMetadata?.vendor as string) ??
      (intent?.recipient as string) ??
      (attribution?.vendor as string) ??
      "unknown-vendor";
    const amount = (intent?.amount as string | undefined) ?? (attribution?.requestedAmount as string | undefined);
    const asset = (intent?.asset as string | undefined) ?? (attribution?.asset as string | undefined);
    const chain = (intentMetadata?.chain as string) ?? (attribution?.chain as string | undefined);
    const reason = (intent?.reason as string | undefined) ?? (attribution?.reason as string | undefined);
    const policyId = (intentMetadata?.policyId as string) ?? (attribution?.policyId as string | undefined);
    const mandateId =
      (intent?.mandateId as string) ??
      (intentMetadata?.mandateId as string) ??
      (attribution?.mandateId as string | undefined);
    const txHash =
      (attribution?.transactionHash as string | undefined) ??
      (run.artifacts?.find((a) => a.type === "attestation_result")?.data as
        | { txHash?: string }
        | undefined)?.txHash;
    const status =
      (attribution?.status as string | undefined) ??
      (run.artifacts?.find((a) => a.type === "attestation_result")?.data as
        | { status?: string }
        | undefined)?.status;
    const ts = run.startedAt;

    const text = [
      `Spend run ${run.runId} (${run.workflow}/${run.status ?? "unknown"})`,
      intent || attribution
        ? `Agent ${agentId} spent ${amount ?? "?"} ${asset ?? ""} to vendor ${vendor}${chain ? ` on ${chain}` : ""}.`
        : `Run ${run.runId} (${run.workflow}) ${run.status ?? "completed"}.`,
      mandateId ? `This spend run was produced by agent ${agentId} under mandate ${mandateId} and policy ${policyId ?? "unknown"}.` : "",
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
      collection,
      title: `Spend run ${run.runId} — ${agentId} → ${vendor}`,
      type: "audit",
      url: `https://cognivern.persidian.com/os/runs/${run.runId}`,
      timestamp: ts,
      content: { text },
      // No declared schema on free tier — all filterable fields go in
      // additional_metadata (queryable via metadata_filters.additional_metadata).
      tenant_metadata: {},
      additional_metadata: {
        workspace_id: run.projectId,
        run_id: run.runId,
        amount,
        asset,
        policy_id: policyId,
        mandate_id: mandateId,
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
        object_type: "run",
        record_id: run.runId,
        canonical_url: `/os/runs/${encodeURIComponent(run.runId)}`,
      },
      relations: {
        ids: [
          `cognivern_agent_${agentId}`,
          vendor ? `cognivern_vendor_${vendor}` : undefined,
          policyId ? `cognivern_policy_${policyId}` : undefined,
          mandateId ? `cognivern_mandate_${mandateId}` : undefined,
        ].filter((x): x is string => Boolean(x)),
      },
    };
  }

  private async ingestRecords(records: AppKnowledgeRecord[], collection = this.collection): Promise<string[] | null> {
    const client = this.getClient();
    if (!client || records.length === 0) return null;

    try {
      // HydraDB's app-aware lane expects tenant/sub-tenant identifiers and
      // typed fields. Keep Cognivern's legacy content payload too, but provide
      // the canonical shape so query_apps and relation traversal can inspect
      // these records as app sources rather than generic documents.
      const appKnowledge = records.map((record) => ({
        ...record,
        tenant_id: this.database,
        sub_tenant_id: collection,
        kind: record.kind ?? "custom",
        fields: record.fields ?? { body: record.content.text },
        ...(record.relations
          ? {
              relations: {
                ...record.relations,
                cortex_source_ids: record.relations.cortex_source_ids ?? record.relations.ids,
              },
            }
          : {}),
      }));
      const result = await client.ingest({
        type: "knowledge",
        database: this.database,
        collection,
        appKnowledge,
        upsert: true,
      });
      const ids = (result.results ?? [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      logger.info(`[hydradb] ingested ${records.length} record(s); ingest ids=${ids.join(",")}`);
      return ids.length > 0 ? ids : null;
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
  async waitForIndexing(ids: string[], timeoutMs = 120_000, collection = this.collection): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await client.getContextStatus({
          database: this.database,
          collection,
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
