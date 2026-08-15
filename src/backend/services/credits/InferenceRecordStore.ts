/**
 * InferenceRecordStore — persistence and projections for per-call records.
 *
 * Two projections exist over the same stored row:
 *
 *   projectForParticipant  — everything we hold about that participant's call.
 *   projectForSponsor      — what an organiser or judge is allowed to see,
 *                            derived from the tier recorded ON THE ROW.
 *
 * The tier is snapshotted per record rather than read from the participant. If
 * someone runs 200 calls at `private` and later opts into `open` for the bigger
 * budget, the earlier 200 calls stay private — a tier change grants visibility
 * going forward, it is not retroactive consent.
 *
 * Because storage is already tier-gated at write time (see
 * `disclosure.fieldsPersistedAt`), the sponsor projection is mostly a
 * belt-and-braces filter: for a `private` record the content columns are NULL
 * on disk anyway. Keeping the filter explicit means a future writer bug can't
 * quietly widen disclosure.
 */

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";
import { nanoToUsd } from "./money.js";
import { tierAtLeast, type DisclosureTier } from "./disclosure.js";

export interface NewInferenceRecordInput {
  programId: string;
  participantId: string;
  workspaceId: string;
  disclosureTier: DisclosureTier;
  backend: string;
  provider?: string | null;
  model: string;
  status: "ok" | "upstream_error" | "denied";
  deniedReason?: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costNano: number;
  rawCostNative?: string | null;
  pricingSource?: string | null;
  latencyMs: number;
  streamed: boolean;
  trustTier?: string | null;
  teeVerified?: boolean;
  upstreamRequestId?: string | null;
  promptDigest?: string | null;
  responseDigest?: string | null;
  redactionCount: number;
  redactionCategories: string[];
  taskClass?: string | null;
  projectTag?: string | null;
  promptExcerpt?: string | null;
  responseExcerpt?: string | null;
  auditRunId?: string | null;
}

export interface InferenceRecordRow {
  id: string;
  programId: string;
  participantId: string;
  disclosureTier: DisclosureTier;
  backend: string;
  provider: string | null;
  model: string;
  status: string;
  deniedReason: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costNano: number;
  costUsd: number;
  rawCostNative: string | null;
  pricingSource: string | null;
  latencyMs: number;
  streamed: boolean;
  trustTier: string | null;
  teeVerified: boolean;
  upstreamRequestId: string | null;
  promptDigest: string | null;
  responseDigest: string | null;
  redactionCount: number;
  redactionCategories: string[];
  taskClass: string | null;
  projectTag: string | null;
  promptExcerpt: string | null;
  responseExcerpt: string | null;
  auditRunId: string | null;
  createdAt: string;
}

export class InferenceRecordStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  insert(input: NewInferenceRecordInput): string {
    const id = `inf_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO inference_records
           (id, program_id, participant_id, workspace_id, disclosure_tier, backend,
            provider, model, status, denied_reason, input_tokens, output_tokens,
            cached_tokens, cost_nano, raw_cost_native, pricing_source, latency_ms,
            streamed, trust_tier, tee_verified, upstream_request_id, prompt_digest,
            response_digest, redaction_count, redaction_categories, task_class,
            project_tag, prompt_excerpt, response_excerpt, audit_run_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.programId,
        input.participantId,
        input.workspaceId,
        input.disclosureTier,
        input.backend,
        input.provider ?? null,
        input.model,
        input.status,
        input.deniedReason ?? null,
        input.inputTokens,
        input.outputTokens,
        input.cachedTokens,
        input.costNano,
        input.rawCostNative ?? null,
        input.pricingSource ?? null,
        input.latencyMs,
        input.streamed ? 1 : 0,
        input.trustTier ?? null,
        input.teeVerified ? 1 : 0,
        input.upstreamRequestId ?? null,
        input.promptDigest ?? null,
        input.responseDigest ?? null,
        input.redactionCount,
        JSON.stringify(input.redactionCategories ?? []),
        input.taskClass ?? null,
        input.projectTag ?? null,
        input.promptExcerpt ?? null,
        input.responseExcerpt ?? null,
        input.auditRunId ?? null,
        new Date().toISOString(),
      );
    return id;
  }

  /** Attach the audit run id once `logAction` has returned. */
  setAuditRunId(recordId: string, auditRunId: string): void {
    this.db
      .prepare(`UPDATE inference_records SET audit_run_id = ? WHERE id = ?`)
      .run(auditRunId, recordId);
  }

  listForParticipant(
    participantId: string,
    options: { limit?: number; offset?: number } = {},
  ): InferenceRecordRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM inference_records
         WHERE participant_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(participantId, clampLimit(options.limit), clampOffset(options.offset)) as Array<
      Record<string, unknown>
    >;
    return rows.map(mapRow);
  }

  listForProgram(
    programId: string,
    options: { limit?: number; offset?: number; participantId?: string; model?: string } = {},
  ): InferenceRecordRow[] {
    const clauses = ["program_id = ?"];
    const values: unknown[] = [programId];

    if (options.participantId) {
      clauses.push("participant_id = ?");
      values.push(options.participantId);
    }
    if (options.model) {
      clauses.push("model = ?");
      values.push(options.model);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM inference_records
         WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, clampLimit(options.limit), clampOffset(options.offset)) as Array<
      Record<string, unknown>
    >;
    return rows.map(mapRow);
  }

  /**
   * Per-participant aggregate. Always safe to show a sponsor at any tier —
   * totals are what even `private` participants agreed to share.
   */
  participantSummary(participantId: string): {
    requestCount: number;
    okCount: number;
    deniedCount: number;
    errorCount: number;
    inputTokens: number;
    outputTokens: number;
    costNano: number;
    costUsd: number;
    firstActivityAt: string | null;
    lastActivityAt: string | null;
  } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS requests,
                COALESCE(SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END), 0) AS ok_count,
                COALESCE(SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END), 0) AS denied_count,
                COALESCE(SUM(CASE WHEN status = 'upstream_error' THEN 1 ELSE 0 END), 0) AS error_count,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(SUM(cost_nano), 0) AS cost_nano,
                MIN(created_at) AS first_at,
                MAX(created_at) AS last_at
         FROM inference_records WHERE participant_id = ?`,
      )
      .get(participantId) as Record<string, unknown>;

    const costNano = Number(row.cost_nano ?? 0);
    return {
      requestCount: Number(row.requests ?? 0),
      okCount: Number(row.ok_count ?? 0),
      deniedCount: Number(row.denied_count ?? 0),
      errorCount: Number(row.error_count ?? 0),
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      costNano,
      costUsd: nanoToUsd(costNano),
      firstActivityAt: (row.first_at as string | null) ?? null,
      lastActivityAt: (row.last_at as string | null) ?? null,
    };
  }

  /** Spend grouped by model across a program. Aggregates only — no per-call detail. */
  programModelBreakdown(programId: string): Array<{
    model: string;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    costNano: number;
    costUsd: number;
  }> {
    const rows = this.db
      .prepare(
        `SELECT model,
                COUNT(*) AS requests,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(SUM(cost_nano), 0) AS cost_nano
         FROM inference_records
         WHERE program_id = ? AND status = 'ok'
         GROUP BY model
         ORDER BY cost_nano DESC`,
      )
      .all(programId) as Array<Record<string, unknown>>;

    return rows.map((r) => {
      const costNano = Number(r.cost_nano ?? 0);
      return {
        model: String(r.model),
        requestCount: Number(r.requests ?? 0),
        inputTokens: Number(r.input_tokens ?? 0),
        outputTokens: Number(r.output_tokens ?? 0),
        costNano,
        costUsd: nanoToUsd(costNano),
      };
    });
  }

  /**
   * Task-class breakdown, restricted to records whose tier permits it.
   * Records below `detailed` are reported as an explicit `undisclosed` bucket
   * rather than dropped, so a sponsor can see how much of the picture is hidden
   * instead of mistaking a partial view for the whole.
   */
  programTaskClassBreakdown(programId: string): Array<{
    taskClass: string;
    requestCount: number;
    costNano: number;
    costUsd: number;
  }> {
    const rows = this.db
      .prepare(
        `SELECT COALESCE(task_class, 'undisclosed') AS task_class,
                COUNT(*) AS requests,
                COALESCE(SUM(cost_nano), 0) AS cost_nano
         FROM inference_records
         WHERE program_id = ? AND status = 'ok'
         GROUP BY COALESCE(task_class, 'undisclosed')
         ORDER BY cost_nano DESC`,
      )
      .all(programId) as Array<Record<string, unknown>>;

    return rows.map((r) => {
      const costNano = Number(r.cost_nano ?? 0);
      return {
        taskClass: String(r.task_class),
        requestCount: Number(r.requests ?? 0),
        costNano,
        costUsd: nanoToUsd(costNano),
      };
    });
  }
}

// ── Projections ────────────────────────────────────────────────────────────

/** Everything held about the call. The participant's own view. */
export function projectForParticipant(row: InferenceRecordRow): Record<string, unknown> {
  return {
    id: row.id,
    createdAt: row.createdAt,
    model: row.model,
    provider: row.provider,
    backend: row.backend,
    status: row.status,
    deniedReason: row.deniedReason,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cachedTokens: row.cachedTokens,
    costUsd: row.costUsd,
    pricingSource: row.pricingSource,
    rawCostNative: row.rawCostNative,
    latencyMs: row.latencyMs,
    streamed: row.streamed,
    trustTier: row.trustTier,
    teeVerified: row.teeVerified,
    upstreamRequestId: row.upstreamRequestId,
    promptDigest: row.promptDigest,
    responseDigest: row.responseDigest,
    // Surfaced so a participant can confirm scrubbing actually happened.
    redactionCount: row.redactionCount,
    redactionCategories: row.redactionCategories,
    taskClass: row.taskClass,
    projectTag: row.projectTag,
    promptExcerpt: row.promptExcerpt,
    responseExcerpt: row.responseExcerpt,
    auditRunId: row.auditRunId,
    disclosureTierAtCall: row.disclosureTier,
  };
}

/**
 * What an organiser or judge sees, gated by the tier recorded on the call.
 *
 * At `private` a per-call row is withheld entirely — the sponsor gets that
 * participant's aggregate totals and nothing more. Returning null (rather than
 * a stub) is what lets the sponsor endpoint honestly report how many calls it
 * is not showing.
 */
export function projectForSponsor(row: InferenceRecordRow): Record<string, unknown> | null {
  if (!tierAtLeast(row.disclosureTier, "standard")) return null;

  const projected: Record<string, unknown> = {
    id: row.id,
    createdAt: row.createdAt,
    model: row.model,
    provider: row.provider,
    status: row.status,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cachedTokens: row.cachedTokens,
    costUsd: row.costUsd,
    latencyMs: row.latencyMs,
    streamed: row.streamed,
    trustTier: row.trustTier,
    teeVerified: row.teeVerified,
    promptDigest: row.promptDigest,
    responseDigest: row.responseDigest,
    disclosureTierAtCall: row.disclosureTier,
  };

  if (tierAtLeast(row.disclosureTier, "detailed")) {
    projected.taskClass = row.taskClass;
    projected.projectTag = row.projectTag;
  }

  if (tierAtLeast(row.disclosureTier, "open")) {
    projected.promptExcerpt = row.promptExcerpt;
    projected.responseExcerpt = row.responseExcerpt;
    projected.redactionCount = row.redactionCount;
  }

  return projected;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): InferenceRecordRow {
  const costNano = Number(row.cost_nano ?? 0);
  return {
    id: String(row.id),
    programId: String(row.program_id),
    participantId: String(row.participant_id),
    disclosureTier: String(row.disclosure_tier) as DisclosureTier,
    backend: String(row.backend),
    provider: (row.provider as string | null) ?? null,
    model: String(row.model),
    status: String(row.status),
    deniedReason: (row.denied_reason as string | null) ?? null,
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
    cachedTokens: Number(row.cached_tokens ?? 0),
    costNano,
    costUsd: nanoToUsd(costNano),
    rawCostNative: (row.raw_cost_native as string | null) ?? null,
    pricingSource: (row.pricing_source as string | null) ?? null,
    latencyMs: Number(row.latency_ms ?? 0),
    streamed: Number(row.streamed ?? 0) === 1,
    trustTier: (row.trust_tier as string | null) ?? null,
    teeVerified: Number(row.tee_verified ?? 0) === 1,
    upstreamRequestId: (row.upstream_request_id as string | null) ?? null,
    promptDigest: (row.prompt_digest as string | null) ?? null,
    responseDigest: (row.response_digest as string | null) ?? null,
    redactionCount: Number(row.redaction_count ?? 0),
    redactionCategories: parseArray(row.redaction_categories),
    taskClass: (row.task_class as string | null) ?? null,
    projectTag: (row.project_tag as string | null) ?? null,
    promptExcerpt: (row.prompt_excerpt as string | null) ?? null,
    responseExcerpt: (row.response_excerpt as string | null) ?? null,
    auditRunId: (row.audit_run_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function parseArray(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) return 100;
  return Math.min(500, Math.max(1, Math.floor(limit as number)));
}

function clampOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset ?? NaN)) return 0;
  return Math.max(0, Math.floor(offset as number));
}

let shared: InferenceRecordStore | null = null;
export function sharedInferenceRecordStore(): InferenceRecordStore {
  if (!shared) shared = new InferenceRecordStore();
  return shared;
}
