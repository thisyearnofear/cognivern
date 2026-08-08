import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@backend/db/index.js";
import { FundedMandateService, type FundedMandate } from "./FundedMandateService.js";

export type OutcomeObservationKind = "observed" | "verified_external_state";
export type OutcomeObservationConfidence =
  | "self_reported"
  | "system_observed"
  | "independently_verified";
export type OutcomeEvidenceType =
  | "url"
  | "artifact"
  | "run"
  | "transaction"
  | "external_record";

export interface OutcomeEvidence {
  type: OutcomeEvidenceType;
  reference: string;
  hash?: string;
}

export interface OutcomeObservation {
  id: string;
  mandateId: string;
  workspaceId: string;
  metricId?: string;
  kind: OutcomeObservationKind;
  value: string;
  unit: string;
  observedAt: string;
  source: string;
  confidence: OutcomeObservationConfidence;
  evidence: OutcomeEvidence[];
  notes?: string;
  createdAt: string;
}

export interface CreateOutcomeObservationInput {
  metricId?: string;
  kind: OutcomeObservationKind;
  value: string;
  unit: string;
  observedAt: string;
  source: string;
  confidence: OutcomeObservationConfidence;
  evidence?: OutcomeEvidence[];
  notes?: string;
}

type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeEvidence(evidence: OutcomeEvidence[] | undefined): OutcomeEvidence[] {
  return (evidence || []).map((item) => ({
    type: item.type,
    reference: item.reference.trim(),
    ...(item.hash?.trim() ? { hash: item.hash.trim().toLowerCase() } : {}),
  }));
}

function normalizeInput(
  mandate: FundedMandate,
  input: CreateOutcomeObservationInput,
): CreateOutcomeObservationInput {
  const value = input.value.trim();
  const unit = input.unit.trim();
  const source = input.source.trim();
  if (!value || !unit || !source) {
    throw new Error("Outcome value, unit, and source are required");
  }

  const observedDate = new Date(input.observedAt);
  if (Number.isNaN(observedDate.getTime())) {
    throw new Error("Outcome observedAt must be a valid ISO-8601 timestamp");
  }

  const evidence = normalizeEvidence(input.evidence);
  if (evidence.some((item) => !item.reference)) {
    throw new Error("Every outcome evidence reference is required");
  }
  if (
    input.kind === "verified_external_state" &&
    (input.confidence !== "independently_verified" || evidence.length === 0)
  ) {
    throw new Error(
      "Verified external state requires independently verified confidence and at least one evidence reference",
    );
  }    if (input.metricId) {
      const metric = mandate.successMetrics.find((candidate) => candidate.id === input.metricId);
      if (!metric) {
        throw new Error("Outcome metric must belong to the funded mandate");
      }
      if (metric.unit.trim() !== unit) {
        throw new Error("Outcome unit must match the funded mandate metric unit");
      }
    }


  return {
    ...(input.metricId ? { metricId: input.metricId } : {}),
    kind: input.kind,
    value,
    unit,
    observedAt: observedDate.toISOString(),
    source,
    confidence: input.confidence,
    evidence,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
}

function payloadHash(input: CreateOutcomeObservationInput): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function rowToObservation(row: Row): OutcomeObservation {
  const metricId = typeof row.metric_id === "string" ? row.metric_id : undefined;
  const notes = typeof row.notes === "string" ? row.notes : undefined;
  return {
    id: row.id as string,
    mandateId: row.mandate_id as string,
    workspaceId: row.workspace_id as string,
    ...(metricId ? { metricId } : {}),
    kind: row.kind as OutcomeObservationKind,
    value: row.value as string,
    unit: row.unit as string,
    observedAt: row.observed_at as string,
    source: row.source as string,
    confidence: row.confidence as OutcomeObservationConfidence,
    evidence: parseJson(row.evidence, []),
    ...(notes ? { notes } : {}),
    createdAt: row.created_at as string,
  };
}

function findByIdempotencyKey(
  workspaceId: string,
  mandateId: string,
  idempotencyKey: string,
): Row | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM outcome_observations WHERE workspace_id = ? AND mandate_id = ? AND idempotency_key = ?",
    )
    .get(workspaceId, mandateId, idempotencyKey) as Row | undefined;
}

export const OutcomeObservationService = {
  list(workspaceId: string, mandateId: string): OutcomeObservation[] {
    if (!FundedMandateService.get(workspaceId, mandateId)) {
      throw new Error("Mandate not found");
    }
    const rows = getDb()
      .prepare(
        "SELECT * FROM outcome_observations WHERE workspace_id = ? AND mandate_id = ? ORDER BY observed_at DESC, created_at DESC",
      )
      .all(workspaceId, mandateId) as Row[];
    return rows.map(rowToObservation);
  },

  get(
    workspaceId: string,
    mandateId: string,
    observationId: string,
  ): OutcomeObservation | undefined {
    const row = getDb()
      .prepare(
        "SELECT * FROM outcome_observations WHERE id = ? AND workspace_id = ? AND mandate_id = ?",
      )
      .get(observationId, workspaceId, mandateId) as Row | undefined;
    return row ? rowToObservation(row) : undefined;
  },

  create(
    workspaceId: string,
    mandateId: string,
    input: CreateOutcomeObservationInput,
    idempotencyKey: string,
  ): { observation: OutcomeObservation; replayed: boolean } {
    if (!idempotencyKey.trim()) {
      throw new Error("Idempotency key is required");
    }
    const mandate = FundedMandateService.get(workspaceId, mandateId);
    if (!mandate) throw new Error("Mandate not found");

    const normalized = normalizeInput(mandate, input);
    const hash = payloadHash(normalized);
    const existing = findByIdempotencyKey(workspaceId, mandateId, idempotencyKey);
    if (existing) {
      if (existing.payload_hash !== hash) {
        throw new Error("Idempotency key was already used for a different observation");
      }
      return { observation: rowToObservation(existing), replayed: true };
    }

    const id = `outcome-${randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO outcome_observations
          (id, mandate_id, workspace_id, metric_id, kind, value, unit, observed_at, source, confidence, evidence, notes, idempotency_key, payload_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        mandateId,
        workspaceId,
        normalized.metricId || null,
        normalized.kind,
        normalized.value,
        normalized.unit,
        normalized.observedAt,
        normalized.source,
        normalized.confidence,
        JSON.stringify(normalized.evidence || []),
        normalized.notes || null,
        idempotencyKey,
        hash,
        now,
      );
    } catch (error) {
      // The composite unique index is the authoritative race-safe guard when
      // two retries arrive before either request has populated the response
      // cache. Replay the winner if its payload matches.
      const raced = findByIdempotencyKey(workspaceId, mandateId, idempotencyKey);
      if (raced) {
        if (raced.payload_hash === hash) {
          return { observation: rowToObservation(raced), replayed: true };
        }
        throw new Error("Idempotency key was already used for a different observation");
      }
      throw error;
    }

    const created = OutcomeObservationService.get(workspaceId, mandateId, id);
    if (!created) throw new Error("Outcome observation could not be persisted");
    return { observation: created, replayed: false };
  },
};
