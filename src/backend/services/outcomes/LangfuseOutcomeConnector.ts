/**
 * LangfuseOutcomeConnector
 *
 * Ingests Langfuse scores or completed traces as mandate outcome
 * observations. This is the governance-layer integration described in
 * `docs/LANGFUSE_LESSONS.md`: we do not replicate Langfuse's eval/tracing
 * product — we treat their API as an external attestor that a score/trace
 * exists, then decide whether the spend was allowed and whether to fund again.
 *
 * Trust model: the Langfuse API attests that the record exists (anyone with
 * the project keys can re-fetch it). Score *values* are model- or
 * human-judged, so confidence is `system_observed` with kind `observed` —
 * never `independently_verified` / `verified_external_state` (that combo is
 * reserved for GitHub merge/commit attestation).
 *
 * Idempotency:
 *  - scores: `langfuse:{project}:{traceOrSubject}:{scoreId}`
 *  - traces: `langfuse:{project}:trace:{traceId}`
 *
 * Auth: `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` (HTTP Basic). Keys are
 * read from the environment, never stored on the mandate. Project keys are
 * typically project-scoped; v1 assumes one Langfuse project per deployment.
 *
 * v1 bounds: operator-triggered, one page (100 items) per source per sync,
 * bounded by `source.since` or the mandate measurement window start. Scores
 * mode only ingests NUMERIC values (BOOLEAN → 0/1); categorical/text skipped.
 */
import logger from "@backend/utils/logger.js";
import type { FundedMandate } from "../governance/FundedMandateService.js";
import {
  OutcomeObservationService,
  type CreateOutcomeObservationInput,
} from "../governance/OutcomeObservationService.js";
import type { LangfuseOutcomeSource } from "./outcomeSourceConfig.js";
import type { OutcomeSourceSyncReport } from "./outcomeSyncTypes.js";

const PAGE_SIZE = 100;
const DEFAULT_UNIT = "deliverables";

// ── Langfuse API shapes (only the fields we use) ────────────────────────────

interface LangfuseScoreV3 {
  id: string;
  projectId?: string;
  name: string;
  dataType: string;
  value: number | boolean | string;
  timestamp: string;
  subject?: { kind?: string; id?: string; traceId?: string } | null;
}

interface LangfuseScoresV3Response {
  data: LangfuseScoreV3[];
  meta?: { cursor?: string | null; limit?: number };
}

interface LangfuseTrace {
  id: string;
  timestamp: string;
  name?: string | null;
  htmlPath?: string;
  totalCost?: number;
  latency?: number | null;
}

interface LangfuseTracesResponse {
  data: LangfuseTrace[];
}

// ── Auth + fetch ────────────────────────────────────────────────────────────

function langfuseAuthHeader(): string {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    throw new Error(
      "LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are required for Langfuse outcome sync",
    );
  }
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}

async function langfuseFetch<T>(baseUrl: string, pathAndQuery: string): Promise<T> {
  const url = `${baseUrl}${pathAndQuery}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: langfuseAuthHeader(),
      "User-Agent": "cognivern-outcome-connector",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Langfuse API ${res.status} for ${pathAndQuery}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sinceFor(source: LangfuseOutcomeSource, mandate: FundedMandate): string | undefined {
  if (source.since) return source.since;
  return mandate.measurementWindow?.startsAt;
}

function unitFor(source: LangfuseOutcomeSource, mandate: FundedMandate): string {
  if (!source.metricId) return DEFAULT_UNIT;
  const metric = mandate.successMetrics.find((m) => m.id === source.metricId);
  return metric?.unit.trim() || DEFAULT_UNIT;
}

function firstLine(text: string | undefined, maxLength: number): string {
  const line = (text || "").split("\n")[0]?.trim() || "";
  return line.length > maxLength ? `${line.slice(0, maxLength)}…` : line;
}

function scoreSubjectKey(score: LangfuseScoreV3): string {
  const subject = score.subject;
  if (subject?.kind === "observation" && subject.traceId) {
    return subject.traceId;
  }
  if (subject?.id) return subject.id;
  return "nosubject";
}

function numericScoreValue(score: LangfuseScoreV3): string | undefined {
  if (score.dataType === "NUMERIC" && typeof score.value === "number" && Number.isFinite(score.value)) {
    return String(score.value);
  }
  if (score.dataType === "BOOLEAN") {
    if (typeof score.value === "boolean") return score.value ? "1" : "0";
    if (score.value === 1 || score.value === 0) return String(score.value);
    if (score.value === "true" || score.value === "false") {
      return score.value === "true" ? "1" : "0";
    }
  }
  return undefined;
}

function traceUiUrl(baseUrl: string, trace: LangfuseTrace): string {
  if (trace.htmlPath?.startsWith("http")) return trace.htmlPath;
  if (trace.htmlPath?.startsWith("/")) return `${baseUrl}${trace.htmlPath}`;
  return `${baseUrl}/trace/${trace.id}`;
}

function emptyReport(
  source: LangfuseOutcomeSource,
  partial: Partial<OutcomeSourceSyncReport> = {},
): OutcomeSourceSyncReport {
  return {
    sourceType: "langfuse",
    scope: source.project,
    mode: source.mode,
    fetched: 0,
    ingested: 0,
    replayed: 0,
    skipped: 0,
    ...partial,
  };
}

// ── Per-mode sync ───────────────────────────────────────────────────────────

async function syncScoresSource(
  workspaceId: string,
  mandate: FundedMandate,
  source: LangfuseOutcomeSource,
): Promise<OutcomeSourceSyncReport> {
  const since = sinceFor(source, mandate);
  const unit = unitFor(source, mandate);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    fields: "subject",
  });
  if (since) params.set("fromTimestamp", since);
  if (source.scoreNames && source.scoreNames.length > 0) {
    params.set("name", source.scoreNames.join(","));
  }

  const response = await langfuseFetch<LangfuseScoresV3Response>(
    source.baseUrl,
    `/api/public/v3/scores?${params.toString()}`,
  );
  const scores = Array.isArray(response.data) ? response.data : [];

  const report = emptyReport(source, { fetched: scores.length });

  for (const score of scores) {
    const value = numericScoreValue(score);
    if (!value) {
      report.skipped += 1;
      continue;
    }
    if (!score.id || !score.timestamp) {
      report.skipped += 1;
      continue;
    }

    const subjectKey = scoreSubjectKey(score);
    const input: CreateOutcomeObservationInput = {
      ...(source.metricId ? { metricId: source.metricId } : {}),
      kind: "observed",
      value,
      unit,
      observedAt: new Date(score.timestamp).toISOString(),
      source: `langfuse:${source.project}`,
      confidence: "system_observed",
      evidence: [
        {
          type: "url",
          reference: `${source.baseUrl}/project/${score.projectId || source.project}/scores/${score.id}`,
        },
        { type: "external_record", reference: score.id },
      ],
      notes: `score ${score.name}: ${firstLine(String(score.value), 120)}`,
    };
    const idempotencyKey = `langfuse:${source.project}:${subjectKey}:${score.id}`.slice(0, 160);

    const result = OutcomeObservationService.create(workspaceId, mandate.id, input, idempotencyKey);
    if (result.replayed) report.replayed += 1;
    else report.ingested += 1;
  }

  return report;
}

async function syncTracesSource(
  workspaceId: string,
  mandate: FundedMandate,
  source: LangfuseOutcomeSource,
): Promise<OutcomeSourceSyncReport> {
  const since = sinceFor(source, mandate);
  const unit = unitFor(source, mandate);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    orderBy: "timestamp.desc",
    fields: "core,metrics",
  });
  if (since) params.set("fromTimestamp", since);

  const response = await langfuseFetch<LangfuseTracesResponse>(
    source.baseUrl,
    `/api/public/traces?${params.toString()}`,
  );
  const traces = Array.isArray(response.data) ? response.data : [];

  const report = emptyReport(source, { fetched: traces.length });

  for (const trace of traces) {
    if (!trace.id || !trace.timestamp) {
      report.skipped += 1;
      continue;
    }

    const costNote =
      typeof trace.totalCost === "number" && Number.isFinite(trace.totalCost)
        ? `, cost=${trace.totalCost}`
        : "";
    const input: CreateOutcomeObservationInput = {
      ...(source.metricId ? { metricId: source.metricId } : {}),
      kind: "observed",
      value: "1",
      unit,
      observedAt: new Date(trace.timestamp).toISOString(),
      source: `langfuse:${source.project}`,
      confidence: "system_observed",
      evidence: [
        { type: "url", reference: traceUiUrl(source.baseUrl, trace) },
        { type: "external_record", reference: trace.id },
      ],
      notes: `trace ${trace.id.slice(0, 12)}: ${firstLine(trace.name || "unnamed", 200)}${costNote}`,
    };
    const idempotencyKey = `langfuse:${source.project}:trace:${trace.id}`.slice(0, 160);

    const result = OutcomeObservationService.create(workspaceId, mandate.id, input, idempotencyKey);
    if (result.replayed) report.replayed += 1;
    else report.ingested += 1;
  }

  return report;
}

/**
 * Sync a single Langfuse outcome source. Caller owns multi-source fan-out
 * and HydraDB side effects (see `syncMandateOutcomes`).
 */
export async function syncLangfuseSource(
  workspaceId: string,
  mandate: FundedMandate,
  source: LangfuseOutcomeSource,
): Promise<OutcomeSourceSyncReport> {
  logger.info("Langfuse outcome sync starting", {
    mandateId: mandate.id,
    project: source.project,
    mode: source.mode,
  });
  return source.mode === "scores"
    ? syncScoresSource(workspaceId, mandate, source)
    : syncTracesSource(workspaceId, mandate, source);
}
