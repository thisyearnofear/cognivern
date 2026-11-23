/**
 * TelegraphRunRecorder
 *
 * Persists governed Telegraph miner calls as CRE runs so intelligence
 * consumption is auditable, attributable, and resolvable:
 *
 *   approved → run completes with the telegraph.signal artifact attached
 *   held     → run pauses for operator approval (surfaces in the escalation
 *              inbox; approve releases the signal, reject quarantines it)
 *   failed   → run fails with the error recorded
 *
 * Without a projectId (workspace) the call still returns its result but no
 * run is persisted — standalone scripts opt in via TELEGRAPH_CRE_PROJECT_ID.
 */

import { CreRunRecorder } from "@backend/cre/runRecorder.js";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";
import type { TelegraphGovernedCallResult } from "./TelegraphGovernanceHelper.js";

export interface RecordTelegraphCallParams {
  result: TelegraphGovernedCallResult;
  /** Workspace id the run belongs to. Runs are only persisted when set. */
  projectId?: string | null;
  agentId?: string;
  description?: string;
  /** Pre-generated id for callers that need to embed the run id in evidence. */
  runId?: string;
  /** Pre-generated artifact id for evidence bundles. */
  artifactId?: string;
  /** Extra fields merged into the telegraph.signal artifact before signing. */
  artifactExtras?: Record<string, unknown>;
}

export async function recordTelegraphGovernedCall(
  params: RecordTelegraphCallParams,
): Promise<CreRun | null> {
  const { result, projectId } = params;
  if (!projectId) return null;

  const recorder = new CreRunRecorder({
    workflow: "governance",
    mode: "cre",
    projectId,
    runId: params.runId,
  });

  const miner = result.response?.metadata;
  const step = recorder.startStep("http", "telegraph.miner_call", {
    minerId: miner?.minerId,
    minerName: miner?.minerName,
    intent: miner?.intent,
    agentId: params.agentId,
  });
  step.end({
    ok: result.success,
    summary: result.success
      ? `Telegraph call ${result.status} (confidence ${miner?.confidence ?? "unknown"})`
      : `Telegraph call failed: ${result.error ?? "unknown error"}`,
    details: {
      status: result.status,
      confidence: miner?.confidence ?? null,
      costUsd: miner?.costUsd,
      latencyMs: miner?.latencyMs,
    },
  });

  const artifactData =
    result.artifact?.data &&
    typeof result.artifact.data === "object" &&
    !Array.isArray(result.artifact.data)
      ? (result.artifact.data as Record<string, unknown>)
      : ({
          agentId: params.agentId,
          description: params.description,
          miner: { id: miner?.minerId, name: miner?.minerName },
          signal: { confidence: miner?.confidence ?? null },
          cost: { usd: miner?.costUsd ?? "0", paymentMethod: "x402" },
          error: result.error,
        } as Record<string, unknown>);
  if (params.artifactExtras) {
    Object.assign(artifactData, params.artifactExtras);
  }

  await recorder.addArtifact({
    id: params.artifactId ?? result.artifact?.id,
    type: "telegraph.signal",
    data: artifactData,
  });

  if (result.status === "held") {
    await recorder.pauseForApproval(
      result.decision?.reason ?? "Telegraph confidence below threshold — held for review",
      "release_telegraph_signal",
      {
        confidence: result.decision?.actualConfidence ?? null,
        threshold: result.decision?.threshold,
        minerId: miner?.minerId,
        costUsd: miner?.costUsd,
      },
    );
  } else {
    await recorder.finish(result.status === "approved");
  }

  const run = recorder.getRun();
  await creRunStore.add(run);
  return run;
}

export interface RecordTelegraphGateParams {
  projectId?: string | null;
  agentId?: string;
  mandateId?: string;
  description?: string;
  /** Pre-generated id for callers that need to embed the run id in evidence. */
  runId?: string;
  /** Pre-generated artifact id for evidence bundles. */
  artifactId?: string;
  /** Artifact timestamp used to make the precomputed artifact hash match. */
  timestamp?: string;
  /** What stopped the purchase, e.g. "compliance". */
  gate: string;
  reason: string;
  /** Screening run/artifact this decision links back to. */
  compliance?: Record<string, unknown>;
  intendedCall?: Record<string, unknown>;
  /** Shareable payment-attempt receipt attached before artifact signing. */
  evidenceBundle?: Record<string, unknown>;
  /** Pause the gate decision in the operator inbox instead of closing it failed. */
  holdForReview?: {
    pendingAction?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Persist a purchase that governance stopped before any paid call settled —
 * e.g. a compliance screen returned a hit. The run fails with the gate
 * decision in its artifact so blocked spend is auditable, not silent.
 */
export async function recordTelegraphGateDecision(
  params: RecordTelegraphGateParams,
): Promise<CreRun | null> {
  const { projectId } = params;
  if (!projectId) return null;

  const recorder = new CreRunRecorder({
    workflow: "governance",
    mode: "cre",
    projectId,
    runId: params.runId,
  });

  const step = recorder.startStep("http", "telegraph.gate_decision", {
    gate: params.gate,
    agentId: params.agentId,
  });
  step.end({ ok: false, summary: `Purchase blocked by ${params.gate}: ${params.reason}` });

  await recorder.addArtifact({
    id: params.artifactId,
    type: "telegraph.signal",
    data: {
      agentId: params.agentId,
      mandateId: params.mandateId,
      description: params.description,
      gate: {
        name: params.gate,
        decision: "blocked",
        reason: params.reason,
        reviewRequired: Boolean(params.holdForReview),
      },
      compliance: params.compliance,
      intendedCall: params.intendedCall,
      evidenceBundle: params.evidenceBundle,
      cost: { usd: "0", paymentMethod: "x402", paid: false },
      timestamp: params.timestamp ?? new Date().toISOString(),
    },
  });

  if (params.holdForReview) {
    await recorder.pauseForApproval(
      params.reason,
      params.holdForReview.pendingAction ?? "review_telegraph_gate",
      params.holdForReview.details,
    );
  } else {
    await recorder.finish(false);
  }

  const run = recorder.getRun();
  await creRunStore.add(run);
  return run;
}
