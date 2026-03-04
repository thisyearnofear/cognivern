import { Request, Response } from "express";
import crypto from "node:crypto";
import { runForecastingWorkflow } from "../../../cre/workflows/forecasting.js";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";
import { CreRun } from "../../../cre/types.js";

function estimateTokenAndCost(stepCount: number, artifactCount: number) {
  const estimatedTokens = stepCount * 180 + artifactCount * 60;
  const estimatedCostUsd = Number((estimatedTokens * 0.0000025).toFixed(6));
  return { estimatedTokens, estimatedCostUsd };
}

function normalizeRun(run: CreRun): CreRun {
  const status =
    run.status || (run.finishedAt ? (run.ok ? "completed" : "failed") : "running");
  const retryCount = run.retryCount ?? 0;
  const approvalState = run.approvalState || "not_required";
  const stepCount = run.steps.length;
  const artifactCount = run.artifacts.length;
  const latencyMs =
    run.metrics?.latencyMs ??
    (run.finishedAt
      ? Math.max(
          0,
          new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
        )
      : undefined);
  const estimate = estimateTokenAndCost(stepCount, artifactCount);
  const defaultPlan = {
    version: 1,
    updatedAt: new Date().toISOString(),
    summary: "Execution plan generated from workflow steps.",
    steps: run.steps.map((step, idx) => ({
      id: `plan-${idx + 1}`,
      title: step.name,
      description: step.summary || `${step.kind} step`,
      enabled: true,
      status: step.ok ? ("approved" as const) : ("pending" as const),
    })),
  };

  return {
    ...run,
    status,
    retryCount,
    approvalState,
    plan: run.plan || defaultPlan,
    controls: {
      canCancel: status === "running" || status === "queued",
      canRetry:
        status === "failed" || status === "cancelled" || status === "completed",
      canApprove: status === "paused_for_approval" || run.requiresApproval === true,
    },
    metrics: {
      latencyMs,
      stepCount,
      artifactCount,
      estimatedTokens: run.metrics?.estimatedTokens ?? estimate.estimatedTokens,
      estimatedCostUsd: run.metrics?.estimatedCostUsd ?? estimate.estimatedCostUsd,
    },
    provenance: {
      source: run.provenance?.source || "cognivern",
      workflowVersion: run.provenance?.workflowVersion || "v1",
      model: run.provenance?.model || "unknown",
      citations: run.provenance?.citations || [],
    },
    events: run.events || [],
  };
}

function pushRunEvent(
  run: CreRun,
  event: {
    type:
      | "run_cancel_requested"
      | "run_cancelled"
      | "run_retry_requested"
      | "run_paused_for_approval"
      | "run_finished"
      | "run_failed";
    payload?: Record<string, unknown>;
    stepName?: string;
  }
) {
  const events = run.events || [];
  events.push({
    id: crypto.randomUUID(),
    runId: run.runId,
    type: event.type,
    timestamp: new Date().toISOString(),
    stepName: event.stepName,
    payload: event.payload,
  });
  run.events = events;
}

export class CreController {
  async listRuns(req: Request, res: Response) {
    const projectId = (req.query.projectId as string) || "default";
    const runs = await creRunStore.list();
    res.json({
      success: true,
      projectId,
      runs: runs
        .filter((r) => (r as any).projectId === projectId)
        .map((r) => normalizeRun(r)),
    });
  }

  async getRun(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    res.json({ success: true, run: normalizeRun(run) });
  }

  async getRunEvents(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const since = req.query.since ? Number(req.query.since) : undefined;
    const normalized = normalizeRun(run);
    const events = (normalized.events || []).filter((event) => {
      if (!since || Number.isNaN(since)) return true;
      return new Date(event.timestamp).getTime() > since;
    });
    res.json({
      success: true,
      runId: run.runId,
      events,
      cursor: events.length
        ? new Date(events[events.length - 1].timestamp).getTime()
        : since || Date.now(),
    });
  }

  async triggerForecast(req: Request, res: Response) {
    const writeAttestation = Boolean(req.body?.writeAttestation);
    const requireApproval = Boolean(req.body?.requireApproval);

    const run = await runForecastingWorkflow({
      mode: "local",
      // If approval is required, hold before any attestation side effects.
      writeAttestation: requireApproval ? false : writeAttestation,
      arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    });

    const normalized = normalizeRun(run);
    if (requireApproval) {
      normalized.status = "paused_for_approval";
      normalized.requiresApproval = true;
      normalized.approvalState = "pending";
      normalized.ok = false;
      normalized.finishedAt = undefined;
      normalized.controls = { canCancel: true, canRetry: false, canApprove: true };
      pushRunEvent(normalized, {
        type: "run_paused_for_approval",
        payload: {
          reason: "manual_approval_required",
          pendingAction: writeAttestation ? "attestation" : "run_finalize",
        },
      });
    }
    await creRunStore.add(normalized);

    res.json({
      success: normalized.ok,
      runId: normalized.runId,
      run: normalized,
    });
  }

  async cancelRun(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const normalized = normalizeRun(run);
    if (!(normalized.status === "running" || normalized.status === "queued")) {
      res.status(409).json({
        success: false,
        error: `Run cannot be cancelled from status '${normalized.status}'`,
      });
      return;
    }

    pushRunEvent(normalized, {
      type: "run_cancel_requested",
      payload: { requestedBy: "user" },
    });
    normalized.status = "cancelled";
    normalized.finishedAt = new Date().toISOString();
    normalized.ok = false;
    normalized.controls = { canCancel: false, canRetry: true, canApprove: false };
    pushRunEvent(normalized, { type: "run_cancelled", payload: { source: "api" } });

    await creRunStore.replace(normalized);
    res.json({ success: true, run: normalized });
  }

  async retryRun(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const original = normalizeRun(run);
    const fromStep =
      typeof req.body?.fromStep === "number" && req.body.fromStep >= 0
        ? req.body.fromStep
        : 0;
    pushRunEvent(original, { type: "run_retry_requested", payload: { requestedBy: "user" } });
    await creRunStore.replace(original);

    const writeAttestation = Boolean(req.body?.writeAttestation);
    const newRun = normalizeRun(
      await runForecastingWorkflow({
        mode: "local",
        writeAttestation,
        arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
      })
    );
    newRun.parentRunId = original.runId;
    newRun.retryCount = (original.retryCount || 0) + 1;
    if (fromStep > 0) {
      newRun.provenance = {
        ...(newRun.provenance || { source: "cognivern" }),
        citations: [
          ...((newRun.provenance?.citations || []) as Array<{ label: string; value: string }>),
          { label: "retry_from_step", value: String(fromStep) },
        ],
      };
      pushRunEvent(newRun, {
        type: "run_retry_requested",
        payload: { retriedFromRunId: original.runId, fromStep },
      });
    }
    await creRunStore.add(newRun);
    res.json({ success: true, runId: newRun.runId, run: newRun, retriedFrom: original.runId });
  }

  async submitApproval(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const approve = Boolean(req.body?.approve);
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    const normalized = normalizeRun(run);

    normalized.approvalState = approve ? "approved" : "rejected";
    normalized.approvalReason = reason || undefined;
    normalized.requiresApproval = false;

    if (approve && normalized.status === "paused_for_approval") {
      normalized.status = "completed";
      normalized.ok = true;
      normalized.finishedAt = new Date().toISOString();
      if (normalized.plan) {
        normalized.plan.steps = normalized.plan.steps.map((step) => ({
          ...step,
          status: step.enabled ? "approved" : "rejected",
        }));
      }
      pushRunEvent(normalized, {
        type: "run_finished",
        payload: {
          reason: "approval_granted",
          note: reason || null,
        },
      });
    }
    if (!approve) {
      normalized.status = "failed";
      normalized.ok = false;
      normalized.finishedAt = normalized.finishedAt || new Date().toISOString();
      if (normalized.plan) {
        normalized.plan.steps = normalized.plan.steps.map((step) => ({
          ...step,
          status: "rejected",
        }));
      }
      pushRunEvent(normalized, {
        type: "run_failed",
        payload: { reason: "approval_rejected", note: reason || null },
      });
    }

    normalized.controls = {
      canCancel: normalized.status === "running",
      canRetry: normalized.status === "failed" || normalized.status === "cancelled",
      canApprove: false,
    };

    await creRunStore.replace(normalized);
    res.json({ success: true, run: normalized });
  }

  async updateRunPlan(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const normalized = normalizeRun(run);
    const payload = req.body?.plan;
    if (!payload || !Array.isArray(payload.steps)) {
      res.status(400).json({ success: false, error: "Invalid plan payload" });
      return;
    }

    normalized.plan = {
      version: Number(payload.version || (normalized.plan?.version || 1) + 1),
      updatedAt: new Date().toISOString(),
      summary:
        typeof payload.summary === "string"
          ? payload.summary.slice(0, 500)
          : normalized.plan?.summary,
      steps: payload.steps.map((step: any, idx: number) => ({
        id: typeof step.id === "string" ? step.id : `plan-${idx + 1}`,
        title: String(step.title || `Step ${idx + 1}`).slice(0, 120),
        description:
          typeof step.description === "string"
            ? step.description.slice(0, 500)
            : undefined,
        enabled: Boolean(step.enabled),
        status:
          step.status === "approved" || step.status === "rejected"
            ? step.status
            : "pending",
      })),
    };

    if (normalized.status === "running") {
      normalized.status = "paused_for_approval";
      normalized.requiresApproval = true;
      normalized.approvalState = "pending";
      normalized.controls = { canCancel: true, canRetry: false, canApprove: true };
      pushRunEvent(normalized, {
        type: "run_paused_for_approval",
        payload: { reason: "plan_updated_requires_approval" },
      });
    }

    await creRunStore.replace(normalized);
    res.json({ success: true, run: normalized });
  }
}
