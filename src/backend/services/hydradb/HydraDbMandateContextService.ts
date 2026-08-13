import { randomUUID } from "node:crypto";
import logger from "@backend/utils/logger.js";
import { getDb } from "@backend/db/index.js";
import type { HydraDbChunk, HydraDbGraphContext, HydraDbSource } from "./HydraDbClient.js";
import { hydraDbIngestion } from "./HydraDbIngestionService.js";
import { hydraDbRetrieval, type RetrievalMetrics } from "./HydraDbRetrievalService.js";
import {
  collectionForWorkspace,
  mandateToHydraRecord,
  outcomeToHydraRecord,
  recommendationToHydraRecord,
  statementToHydraRecord,
} from "./HydraDbMandateContextRecords.js";
import { FundedMandateService } from "@backend/services/governance/FundedMandateService.js";
import { OutcomeObservationService } from "@backend/services/governance/OutcomeObservationService.js";
import { StatementService } from "@backend/services/governance/StatementService.js";
import { AllocationRecommendationService, type AllocationRecommendation } from "@backend/services/governance/AllocationRecommendationService.js";
import { getRunSpendAttribution } from "@backend/services/governance/SpendAttributionService.js";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";
import type { FundedMandateStatement } from "@backend/services/governance/StatementService.js";
import type { AppKnowledgeRecord } from "./HydraDbIngestionService.js";

export type MandateContextSyncStatus = "disabled" | "queued" | "pending" | "synced" | "failed";
export type MandateContextSyncTrigger = "manual" | "mandate_created" | "mandate_updated" | "outcome_created";

export interface MandateContextSyncResult {
  enabled: boolean;
  mandateId: string;
  collection: string;
  syncedAt: string;
  /** Last sync that reached a searchable state in this process, if any. */
  lastSyncedAt?: string;
  syncStatus: MandateContextSyncStatus;
  syncTrigger?: MandateContextSyncTrigger;
  ingested: {
    mandate: number;
    outcomes: number;
    statements: number;
    recommendations: number;
    runs: number;
  };
  warning?: string;
  syncJob?: MandateContextSyncJobStatus;
}

export interface MandateEvidenceProvenance {
  recordId?: string;
  kind: string;
  label: string;
  url?: string;
  timestamp?: string;
  workspaceId: string;
  mandateId: string;
}

export interface MandateContextSyncJobStatus {
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  lastSyncedAt?: string;
  updatedAt: string;
}

interface HydraContextSyncJobRow {
  id: string;
  workspace_id: string;
  mandate_id: string;
  trigger: MandateContextSyncTrigger;
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MandateContextResult extends MandateContextSyncResult {
  query: string;
  chunks: HydraDbChunk[];
  sources: HydraDbSource[];
  provenance: MandateEvidenceProvenance[];
  graphContext?: HydraDbGraphContext;
  metrics: RetrievalMetrics;
}

function mandateRuns(workspaceId: string, mandateId: string, runs: CreRun[]): CreRun[] {
  return runs.filter((run) => {
    if (run.projectId !== workspaceId) return false;
    const attribution = getRunSpendAttribution(run);
    return attribution?.workspaceId === workspaceId && attribution.mandateId === mandateId;
  });
}

function syncJobStatus(workspaceId: string, mandateId: string): MandateContextSyncJobStatus | undefined {
  try {
    const row = getDb().prepare(
      `SELECT status, attempts, next_attempt_at, last_error, last_synced_at, updated_at
       FROM hydra_context_sync_jobs
       WHERE workspace_id = ? AND mandate_id = ?
       ORDER BY updated_at DESC LIMIT 1`,
    ).get(workspaceId, mandateId) as Pick<HydraContextSyncJobRow, "status" | "attempts" | "next_attempt_at" | "last_error" | "last_synced_at" | "updated_at"> | undefined;
    if (!row) return undefined;
    return {
      status: row.status,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      ...(row.last_error ? { lastError: row.last_error } : {}),
      ...(row.last_synced_at ? { lastSyncedAt: row.last_synced_at } : {}),
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.debug(`[hydradb] sync job status unavailable: ${error}`);
    return undefined;
  }
}

function emptyMetrics(reason: string): RetrievalMetrics {
  return {
    mode: "thinking",
    latencyMs: 0,
    hydraDbCalls: 0,
    resultCount: 0,
    routingReason: reason,
    estimatedCostUsd: 0,
  };
}

function mergedMetadata(chunk: HydraDbChunk): Record<string, unknown> {
  return { ...(chunk.metadata ?? {}), ...(chunk.additional_metadata ?? {}) };
}

export function chunkBelongsToMandate(chunk: HydraDbChunk, mandateId: string): boolean {
  const metadata = mergedMetadata(chunk);
  if (metadata.mandate_id === mandateId) return true;
  return Boolean(chunk.id && [
    `cognivern_mandate_${mandateId}`,
    `cognivern_statement_`,
    `cognivern_recommendation_${mandateId}`,
    `cognivern_outcome_`,
    `cognivern_run_`,
  ].some((prefix) => chunk.id!.startsWith(prefix)) && metadata.mandate_id === mandateId);
}

function graphItemMentionsScope(item: unknown, mandateId: string, mandateName: string): boolean {
  const text = JSON.stringify(item).toLowerCase();
  return text.includes(mandateId.toLowerCase()) || text.includes(mandateName.toLowerCase());
}

function graphItemInScope(item: unknown, chunkIds: Set<string>, mandateId: string, mandateName: string): boolean {
  if (typeof item !== "object" || item === null) return false;
  const sourceChunkIds = (item as { source_chunk_ids?: unknown }).source_chunk_ids;
  // A relation with explicit source chunks must be anchored to a retained
  // chunk. Do not let a free-text mandate mention override that tenant check.
  if (Array.isArray(sourceChunkIds)) {
    return sourceChunkIds.some((id) => typeof id === "string" && chunkIds.has(id));
  }
  return graphItemMentionsScope(item, mandateId, mandateName);
}

export function scopeGraphContext(
  graphContext: HydraDbGraphContext | undefined,
  chunks: HydraDbChunk[],
  mandateId: string,
  mandateName: string,
): HydraDbGraphContext | undefined {
  if (!graphContext) return undefined;
  const chunkIds = new Set(
    chunks.flatMap((chunk) => [
      chunk.id,
      chunk.chunk_uuid,
      chunk.id ? `${chunk.id}_chunk_0000` : undefined,
    ].filter((id): id is string => Boolean(id))),
  );
  const queryPaths = (graphContext.query_paths ?? []).filter(
    (item) => graphItemInScope(item, chunkIds, mandateId, mandateName),
  );
  const chunkRelations = (graphContext.chunk_relations ?? []).filter(
    (item) => graphItemInScope(item, chunkIds, mandateId, mandateName),
  );
  const chunkIdToGroupIds = Object.fromEntries(
    Object.entries(graphContext.chunk_id_to_group_ids ?? {}).filter(([chunkId]) => chunkIds.has(chunkId)),
  );
  return { query_paths: queryPaths, chunk_relations: chunkRelations, chunk_id_to_group_ids: chunkIdToGroupIds };
}

function provenanceFor(
  chunks: HydraDbChunk[],
  sources: HydraDbSource[],
  workspaceId: string,
  mandateId: string,
): MandateEvidenceProvenance[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return chunks.map((chunk) => {
    const metadata = mergedMetadata(chunk);
    const source =
      (chunk.id ? sourceById.get(chunk.id) : undefined) ??
      (chunk.chunk_uuid ? sourceById.get(chunk.chunk_uuid) : undefined) ??
      sources.find((candidate) => candidate.title && candidate.title === chunk.source_title);
    const kind = String(metadata.object_type ?? chunk.source_type ?? source?.type ?? "evidence");
    const recordId = typeof metadata.record_id === "string" ? metadata.record_id : undefined;
    // Prefer Cognivern's canonical record link over HydraDB's internal
    // storage URL; operators should never be sent to a derived-store object.
    // Do not fall back to HydraDB's derived-store URL. Mandate context links
    // must resolve to an operator-facing Cognivern route or remain absent.
    const url = typeof metadata.canonical_url === "string" ? metadata.canonical_url : undefined;
    return {
      ...(recordId ? { recordId } : {}),
      kind,
      label: chunk.source_title ?? source?.title ?? `${kind} evidence`,
      ...(url ? { url } : {}),
      ...(source?.timestamp || chunk.source_last_updated_time
        ? { timestamp: source?.timestamp ?? chunk.source_last_updated_time }
        : {}),
      workspaceId,
      mandateId,
    };
  });
}

export class HydraDbMandateContextService {
  private readonly ingestion = hydraDbIngestion;
  private readonly retrieval = hydraDbRetrieval;
  private readonly queuedSyncs = new Map<string, Promise<MandateContextSyncResult>>();
  private readonly lastSuccessfulSyncs = new Map<string, string>();
  private backgroundSyncTimer: ReturnType<typeof setInterval> | null = null;
  private backgroundSyncRunning = false;

  private syncKey(workspaceId: string, mandateId: string): string {
    return `${workspaceId}:${mandateId}`;
  }

  private withLastSyncedAt(result: MandateContextSyncResult, workspaceId: string): MandateContextSyncResult {
    const lastSyncedAt = this.lastSuccessfulSyncs.get(this.syncKey(workspaceId, result.mandateId));
    return lastSyncedAt ? { ...result, lastSyncedAt } : result;
  }

  private enqueueSyncJob(
    workspaceId: string,
    mandateId: string,
    syncTrigger: Exclude<MandateContextSyncTrigger, "manual">,
  ): string {
    const db = getDb();
    const now = new Date().toISOString();
    const queued = db.prepare(
      `SELECT id FROM hydra_context_sync_jobs
       WHERE workspace_id = ? AND mandate_id = ? AND status = 'queued'
       ORDER BY created_at DESC LIMIT 1`,
    ).get(workspaceId, mandateId) as { id: string } | undefined;
    if (queued) {
      db.prepare("UPDATE hydra_context_sync_jobs SET trigger = ?, updated_at = ?, next_attempt_at = ? WHERE id = ?")
        .run(syncTrigger, now, now, queued.id);
      return queued.id;
    }

    const id = `hydra-sync-${randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO hydra_context_sync_jobs
        (id, workspace_id, mandate_id, trigger, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?)`,
    ).run(id, workspaceId, mandateId, syncTrigger, now, now, now);
    return id;
  }

  private claimSyncJob(jobId: string): HydraContextSyncJobRow | undefined {
    const db = getDb();
    const now = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 120_000).toISOString();
    const claimed = db.prepare(
      `UPDATE hydra_context_sync_jobs
       SET status = 'processing', attempts = attempts + 1, updated_at = ?
       WHERE id = ? AND (
         status = 'queued' OR
         (status = 'processing' AND updated_at < ?)
       )`,
    ).run(now, jobId, staleBefore);
    if (claimed.changes === 0) return undefined;
    return db.prepare("SELECT * FROM hydra_context_sync_jobs WHERE id = ?").get(jobId) as HydraContextSyncJobRow | undefined;
  }

  private finishSyncJob(job: HydraContextSyncJobRow, result: MandateContextSyncResult): void {
    const db = getDb();
    const now = new Date().toISOString();
    if (result.syncStatus !== "failed") {
      db.prepare(
        `UPDATE hydra_context_sync_jobs
         SET status = 'completed', last_error = ?, last_synced_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(result.warning ?? null, result.syncStatus === "synced" ? result.syncedAt : null, now, job.id);
      return;
    }

    const terminal = job.attempts >= 5;
    const nextAttemptAt = new Date(Date.now() + Math.min(900_000, 30_000 * 2 ** Math.max(0, job.attempts - 1))).toISOString();
    db.prepare(
      `UPDATE hydra_context_sync_jobs
       SET status = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(terminal ? "failed" : "queued", result.warning ?? "HydraDB sync failed", nextAttemptAt, now, job.id);
  }

  private async processSyncJob(
    jobId: string,
    workspaceId: string,
    mandateId: string,
    syncTrigger: MandateContextSyncTrigger,
  ): Promise<MandateContextSyncResult | undefined> {
    const job = this.claimSyncJob(jobId);
    if (!job) return undefined;
    try {
      const result = await this.syncWithRetry(workspaceId, mandateId, syncTrigger);
      this.finishSyncJob(job, result);
      return result;
    } catch (error) {
      const result: MandateContextSyncResult = {
        enabled: this.ingestion.isEnabled(),
        mandateId,
        collection: collectionForWorkspace(workspaceId),
        syncedAt: new Date().toISOString(),
        syncStatus: "failed",
        syncTrigger,
        ingested: { mandate: 0, outcomes: 0, statements: 0, recommendations: 0, runs: 0 },
        warning: error instanceof Error ? error.message : "Durable HydraDB sync failed",
      };
      this.finishSyncJob(job, result);
      return result;
    }
  }

  private async processDueSyncJob(): Promise<void> {
    if (this.backgroundSyncRunning) return;
    this.backgroundSyncRunning = true;
    try {
      const now = new Date().toISOString();
      const staleBefore = new Date(Date.now() - 120_000).toISOString();
      const job = getDb().prepare(
        `SELECT * FROM hydra_context_sync_jobs
         WHERE (status = 'queued' AND next_attempt_at <= ?)
            OR (status = 'processing' AND updated_at < ?)
         ORDER BY next_attempt_at ASC LIMIT 1`,
      ).get(now, staleBefore) as HydraContextSyncJobRow | undefined;
      if (job) await this.processSyncJob(job.id, job.workspace_id, job.mandate_id, job.trigger);
    } finally {
      this.backgroundSyncRunning = false;
    }
  }

  /** Start the durable SQLite-backed recovery worker. Safe to call once per process. */
  startBackgroundSyncWorker(intervalMs = 5_000): void {
    if (this.backgroundSyncTimer || !this.ingestion.isEnabled()) return;
    this.backgroundSyncTimer = setInterval(() => {
      void this.processDueSyncJob();
    }, intervalMs);
    void this.processDueSyncJob();
  }

  stopBackgroundSyncWorker(): void {
    if (this.backgroundSyncTimer) clearInterval(this.backgroundSyncTimer);
    this.backgroundSyncTimer = null;
  }

  private async syncWithRetry(
    workspaceId: string,
    mandateId: string,
    syncTrigger: MandateContextSyncTrigger,
  ): Promise<MandateContextSyncResult> {
    let result = await this.syncMandate(workspaceId, mandateId, syncTrigger);
    // Retries are deliberately bounded and happen only in the detached
    // best-effort path; manual context requests remain predictable.
    for (let attempt = 1; attempt < 3 && result.enabled && result.syncStatus === "failed"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      result = await this.syncMandate(workspaceId, mandateId, syncTrigger);
    }
    return result;
  }

  async syncMandate(
    workspaceId: string,
    mandateId: string,
    syncTrigger: MandateContextSyncTrigger = "manual",
  ): Promise<MandateContextSyncResult> {
    const mandate = FundedMandateService.get(workspaceId, mandateId);
    if (!mandate) throw new Error("Mandate not found");

    const collection = collectionForWorkspace(workspaceId);
    const syncKey = this.syncKey(workspaceId, mandateId);
    const syncedAt = new Date().toISOString();
    const emptyIngested = { mandate: 0, outcomes: 0, statements: 0, recommendations: 0, runs: 0 };
    if (!this.ingestion.isEnabled()) {
      return {
        enabled: false,
        mandateId,
        collection,
        syncedAt,
        syncStatus: "disabled",
        syncTrigger,
        ingested: emptyIngested,
        warning: "HydraDB is disabled. Cognivern remains fully operational; enable HydraDB only for derived evidence context.",
      };
    }

    try {
      const observations = OutcomeObservationService.list(workspaceId, mandateId);
      const records: AppKnowledgeRecord[] = [mandateToHydraRecord(mandate), ...observations.map(outcomeToHydraRecord)];
      let statement: FundedMandateStatement | undefined;
      try {
        statement = await StatementService.generateCandidate(workspaceId, mandateId);
        records.push(statementToHydraRecord(statement));
      } catch {
        // A partial context graph is useful when a statement is blocked by
        // incomplete evidence; statement generation remains fail-closed.
      }

      let recommendation: AllocationRecommendation | undefined;
      try {
        recommendation = await AllocationRecommendationService.generate(workspaceId, mandateId);
        records.push(recommendationToHydraRecord(recommendation));
      } catch {
        // Recommendations remain available through the authoritative service;
        // the derived graph may be built without one when evidence is incomplete.
      }

      const runs = mandateRuns(workspaceId, mandateId, await creRunStore.list());
      const ready = await this.ingestion.ensureDatabase();
      if (!ready) {
        return {
          enabled: true,
          mandateId,
          collection,
          syncedAt,
          syncStatus: "failed",
          syncTrigger,
          ingested: emptyIngested,
          warning: "HydraDB is configured but its database is not ready. The authoritative Cognivern ledger was not affected.",
        };
      }

      const appIngestIds = await this.ingestion.ingestAppRecordIds(records, collection);
      const runIngestIds = await this.ingestion.ingestCreRuns(runs, collection);
      const ingestIds = [...new Set([...(appIngestIds ?? []), ...(runIngestIds ?? [])].filter((id): id is string => Boolean(id)))];
      if (!appIngestIds || appIngestIds.length === 0) {
        return {
          enabled: true,
          mandateId,
          collection,
          syncedAt,
          syncStatus: "failed",
          syncTrigger,
          ingested: emptyIngested,
          warning: "HydraDB did not accept the mandate context. The authoritative Cognivern ledger was not affected.",
        };
      }

      const indexed = ingestIds.length === 0 || await this.ingestion.waitForIndexing(ingestIds, 30_000, collection);
      if (indexed) this.lastSuccessfulSyncs.set(syncKey, syncedAt);
      return this.withLastSyncedAt({
        enabled: true,
        mandateId,
        collection,
        syncedAt,
        syncStatus: indexed ? "synced" : "pending",
        syncTrigger,
        ingested: {
          mandate: 1,
          outcomes: observations.length,
          statements: statement ? 1 : 0,
          recommendations: recommendation ? 1 : 0,
          runs: runs.length,
        },
        ...(indexed ? {} : { warning: "HydraDB accepted the context, but indexing is still in progress. Refresh after it becomes searchable." }),
      }, workspaceId);
    } catch (error) {
      logger.warn(`[hydradb] mandate context sync failed for ${workspaceId}/${mandateId}: ${error}`);
      return {
        enabled: true,
        mandateId,
        collection,
        syncedAt,
        syncStatus: "failed",
        syncTrigger,
        ingested: emptyIngested,
        warning: "Evidence context could not be refreshed. Cognivern's ledger, policy engine, and statements remain authoritative.",
      };
    }
  }

  syncMandateBestEffort(
    workspaceId: string,
    mandateId: string,
    syncTrigger: Exclude<MandateContextSyncTrigger, "manual">,
  ): Promise<MandateContextSyncResult> {
    if (!this.ingestion.isEnabled()) return this.syncMandate(workspaceId, mandateId, syncTrigger);

    const key = this.syncKey(workspaceId, mandateId);
    const jobId = this.enqueueSyncJob(workspaceId, mandateId, syncTrigger);
    const previous = this.queuedSyncs.get(key);
    const next = (previous ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const result = await this.processSyncJob(jobId, workspaceId, mandateId, syncTrigger);
        return result ?? {
          enabled: true,
          mandateId,
          collection: collectionForWorkspace(workspaceId),
          syncedAt: new Date().toISOString(),
          syncStatus: "queued" as const,
          syncTrigger,
          ingested: { mandate: 0, outcomes: 0, statements: 0, recommendations: 0, runs: 0 },
          warning: "Evidence sync is already being processed or is queued for retry.",
        };
      })
      .catch((error) => {
        logger.warn(`[hydradb] best-effort mandate sync skipped for ${workspaceId}/${mandateId}: ${error}`);
        return {
          enabled: true,
          mandateId,
          collection: collectionForWorkspace(workspaceId),
          syncedAt: new Date().toISOString(),
          syncStatus: "failed" as const,
          syncTrigger,
          ingested: { mandate: 0, outcomes: 0, statements: 0, recommendations: 0, runs: 0 },
          warning: "Best-effort evidence sync failed; the durable job remains available for retry.",
        };
      });
    let tracked: Promise<MandateContextSyncResult>;
    tracked = next.finally(() => {
      if (this.queuedSyncs.get(key) === tracked) this.queuedSyncs.delete(key);
    });
    this.queuedSyncs.set(key, tracked);
    return tracked;
  }

  async getContext(workspaceId: string, mandateId: string): Promise<MandateContextResult> {
    const mandate = FundedMandateService.get(workspaceId, mandateId);
    if (!mandate) throw new Error("Mandate not found");

    const sync = await this.syncMandate(workspaceId, mandateId, "manual");
    const job = syncJobStatus(workspaceId, mandateId);
    const query = `What evidence explains the current capital and governance state of funded mandate ${mandate.name} (mandate id ${mandate.id})? Include authorized objective, policy, agent runs, governed spend, vendors, outcomes, transactions, known unknowns, and what changed over time.`;
    if (!sync.enabled || sync.syncStatus === "failed") {
      return {
        ...sync,
        ...(job ? { syncJob: job } : {}),
        query,
        chunks: [],
        sources: [],
        provenance: [],
        metrics: emptyMetrics(sync.warning ?? "HydraDB unavailable"),
      };
    }

    // HydraDB's additional_metadata filters narrow chunks but currently omit
    // graph_context. The collection is already workspace-isolated; query with
    // the exact mandate identity, then enforce mandate scoping on the returned
    // chunks and graph groups before exposing anything to the operator.
    const outcome = await this.retrieval.retrieve({
      query,
      collection: sync.collection,
      type: "knowledge",
      maxResults: 12,
      forceMode: "thinking",
      queryApps: true,
    });
    const chunks = outcome.chunks.filter((chunk) => chunkBelongsToMandate(chunk, mandateId));
    const retainedIds = new Set(chunks.map((chunk) => chunk.id).filter((id): id is string => Boolean(id)));
    const sources = (outcome.raw.sources ?? []).filter((source) => retainedIds.has(source.id));
    return {
      ...sync,
      ...(job ? { syncJob: job } : {}),
      query,
      chunks,
      sources,
      provenance: provenanceFor(chunks, sources, workspaceId, mandateId),
      graphContext: scopeGraphContext(outcome.raw.graph_context, chunks, mandateId, mandate.name),
      metrics: { ...outcome.metrics, resultCount: chunks.length },
    };
  }
}

export const hydraDbMandateContext = new HydraDbMandateContextService();

export {
  collectionForWorkspace,
  mandateToHydraRecord,
  outcomeToHydraRecord,
  recommendationToHydraRecord,
  statementToHydraRecord,
} from "./HydraDbMandateContextRecords.js";
