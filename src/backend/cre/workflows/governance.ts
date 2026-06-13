/**
 * Governance Workflow — Async FHE Evaluation
 *
 * Runs confidential policy evaluations as CreRun workflows so the frontend
 * can stream progress via SSE (GET /api/cre/runs/:runId/events/stream).
 *
 * Lifecycle steps tracked as CreRun events:
 *   1. load_policy         — Load the active policy from the store
 *   2. encrypt_params      — Encrypt spend parameters via CoFHE SDK
 *   3. submit_to_fhenix    — Submit encrypted values to Fhenix contract
 *   4. record_audit        — Persist the decision to the audit log
 */

import { CreRunRecorder } from "../runRecorder.js";
import { CreRun } from "../types.js";
import { creRunStore } from "../storage/CreRunStore.js";
import { PolicyEnforcementService } from "../../services/PolicyEnforcementService.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import type { AgentAction } from "../../types/Agent.js";
import type { PolicyCheck } from "../../types/Agent.js";
import logger from "../../utils/logger.js";

export interface GovernanceWorkflowParams {
  agentId: string;
  normalizedAction: AgentAction;
  policyId: string;
  policyEnforcementService: PolicyEnforcementService;
  auditLogService: AuditLogService;
}

export interface GovernanceWorkflowResult {
  allowed: boolean;
  reason: string;
  reasoning?: string; // alias for frontend GovernanceEvaluation interface
  policyChecks: PolicyCheck[];
  confidential: Record<string, unknown>;
  timestamp: string;
  auditLogId?: string;
  suspicion?: {
    composite: number;
    label: string;
    dimensions: Record<string, number>;
    escalated: boolean;
    reasoning: string[];
  };
}

/**
 * Start an async governance evaluation and return immediately with the runId.
 * The actual evaluation runs in the background, persisting each step to
 * CreRunStore so the SSE stream endpoint can serve progress events.
 */
export async function startGovernanceEvaluation(
  params: GovernanceWorkflowParams,
): Promise<{ runId: string }> {
  const recorder = new CreRunRecorder({
    workflow: "governance",
    mode: "local",
  });

  const initialRun = recorder.getRun();
  await creRunStore.add(initialRun);

  // Fire background execution — do not await
  runAndPersist(recorder, params).catch((err) => {
    logger.error("Background FHE evaluation failed", {
      runId: recorder.getRun().runId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return { runId: initialRun.runId };
}

async function runAndPersist(
  recorder: CreRunRecorder,
  params: GovernanceWorkflowParams,
): Promise<void> {
  try {
    // ── Step 1: Load policy ──────────────────────────────────────────
    const s1 = recorder.startStep("compute", "load_policy", {
      policyId: params.policyId,
    });
    await params.policyEnforcementService.loadPolicy(params.policyId);
    s1.end({
      ok: true,
      summary: `Policy ${params.policyId} loaded for evaluation`,
    });
    await creRunStore.replace(recorder.getRun());

    // ── Step 2: Encrypt & evaluate (CoFHE SDK + Fhenix contract) ─────
    const s2 = recorder.startStep("confidential_http", "encrypt_and_evaluate", {
      agentId: params.agentId,
      actionType: params.normalizedAction.type,
    });
    const decision = await params.policyEnforcementService.evaluateDecision(
      params.normalizedAction,
    );
    const outcomeLabel = decision.allowed ? "approved" : "denied";
    const failedChecks = decision.policyChecks.filter((c) => !c.result);
    const reason = failedChecks.length
      ? failedChecks.map((c) => c.reason || c.policyId).join("; ")
      : `Action approved under policy ${params.policyId}`;
    s2.end({
      ok: true,
      summary: `FHE evaluation complete — outcome: ${outcomeLabel}`,
    });
    await creRunStore.replace(recorder.getRun());

    // Attach suspicion to evidence if Control Evaluation Mode is active
    if (decision.suspicion) {
      const run = recorder.getRun();
      if (run.evidence) {
        run.evidence.suspicion = {
          composite: decision.suspicion.composite,
          label: decision.suspicion.label,
          dimensions: decision.suspicion.dimensions as unknown as Record<string, number>,
          escalated: decision.suspicion.escalated,
          reasoning: decision.suspicion.reasoning,
        };
      }
      await creRunStore.replace(run);
    }

    // ── Step 3: Record audit log ─────────────────────────────────────
    const s3 = recorder.startStep("compute", "record_audit");
    const auditLogId = await params.auditLogService.logAction(
      params.normalizedAction,
      decision.policyChecks,
      decision.allowed,
    );
    s3.end({
      ok: true,
      summary: `Decision logged to audit trail (id: ${auditLogId})`,
    });
    await creRunStore.replace(recorder.getRun());

    // ── Complete ─────────────────────────────────────────────────────
    await recorder.finish(true);
    const run = recorder.getRun();

    // Embed the evaluation result into the final run_finished event
    // so the frontend can read it from the SSE stream.
    const resultPayload: GovernanceWorkflowResult = {
      allowed: decision.allowed,
      reason,
      reasoning: reason, // alias for frontend GovernanceEvaluation interface
      policyChecks: decision.policyChecks,
      confidential: {
        fheEvaluated: true,
        chain:
          process.env.FHENIX_CHAIN_ID === "84532"
            ? "fhenix-base-sepolia"
            : "fhenix-arbitrum-sepolia",
        decisionIds: decision.policyChecks
          .filter((c) => c.metadata?.decisionId)
          .map((c) => c.metadata?.decisionId as string),
      },
      timestamp: new Date().toISOString(),
      auditLogId,
      suspicion: decision.suspicion ? {
        composite: decision.suspicion.composite,
        label: decision.suspicion.label,
        dimensions: decision.suspicion.dimensions as unknown as Record<string, number>,
        escalated: decision.suspicion.escalated,
        reasoning: decision.suspicion.reasoning,
      } : undefined,
    };

    const lastEvents = run.events;
    if (lastEvents && lastEvents.length > 0) {
      const lastEvent = lastEvents[lastEvents.length - 1];
      if (lastEvent.type === "run_finished") {
        lastEvent.payload = {
          ...(lastEvent.payload || {}),
          result: resultPayload,
        };
      }
    }

    await creRunStore.replace(run);
    logger.info(`FHE governance evaluation complete`, {
      runId: run.runId,
      allowed: decision.allowed,
      policyId: params.policyId,
    });
  } catch (error: any) {
    // ── Error ─────────────────────────────────────────────────────────
    await recorder.addArtifact({
      type: "error",
      data: {
        message: error?.message || String(error),
        stack: error?.stack,
        policyId: params.policyId,
      },
    });
    await recorder.finish(false);
    await creRunStore.replace(recorder.getRun());

    logger.error("FHE governance evaluation failed", {
      runId: recorder.getRun().runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
