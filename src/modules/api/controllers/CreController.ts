import { Request, Response } from "express";
import crypto from "node:crypto";
import { ethers } from "ethers";
import { enrichCreRunEvidence } from "../../../shared/utils/evidence.js";
import { z } from "zod";
import { runForecastingWorkflow } from "../../../cre/workflows/forecasting.js";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";
import { CreRun } from "../../../cre/types.js";
import { translateCreEventToAgUi } from "../../../cre/agUiTranslation.js";
import {
  IdempotencyRecord,
  idempotencyStore,
} from "../storage/IdempotencyStore.js";

const triggerForecastSchema = z.object({
  writeAttestation: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

const retryRunSchema = z.object({
  writeAttestation: z.boolean().optional(),
  fromStep: z.number().int().min(0).max(1000).optional(),
});

const submitApprovalSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(500).optional(),
});

const updatePlanSchema = z.object({
  plan: z.object({
    version: z.number().int().positive(),
    summary: z.string().max(500).optional(),
    steps: z.array(
      z.object({
        id: z.string().min(1).max(120),
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        enabled: z.boolean(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
      }),
    ),
  }),
});

// Helper to get a signer for CRE evidence
function getCreSigner(): ethers.Signer | undefined {
  const pk = process.env.FILECOIN_PRIVATE_KEY;
  if (!pk) return undefined;
  return new ethers.Wallet(pk);
}

// Helper to sign an event during manual transitions (cancel, approve, etc)
async function signManualEvent(runId: string, data: any) {
  const signer = getCreSigner();
  if (!signer) return undefined;
  const json = JSON.stringify(data);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(json));
  const signature = await signer.signMessage(hash);
  const signerAddress = await signer.getAddress();
  return { hash, signature, signer: signerAddress };
}

function estimateTokenAndCost(stepCount: number, artifactCount: number) {
  const estimatedTokens = stepCount * 180 + artifactCount * 60;
  const estimatedCostUsd = Number((estimatedTokens * 0.0000025).toFixed(6));
  return { estimatedTokens, estimatedCostUsd };
}

function normalizeRun(run: CreRun): CreRun {
  const status =
    run.status ||
    (run.finishedAt ? (run.ok ? "completed" : "failed") : "running");
  const retryCount = run.retryCount ?? 0;
  const approvalState = run.approvalState || "not_required";
  const stepCount = run.steps.length;
  const artifactCount = run.artifacts.length;
  const latencyMs =
    run.metrics?.latencyMs ??
    (run.finishedAt
      ? Math.max(
          0,
          new Date(run.finishedAt).getTime() -
            new Date(run.startedAt).getTime(),
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

  return enrichCreRunEvidence({
    ...run,
    status,
    retryCount,
    approvalState,
    plan: run.plan || defaultPlan,
    controls: {
      canCancel: status === "running" || status === "queued",
      canRetry:
        status === "failed" || status === "cancelled" || status === "completed",
      canApprove:
        status === "paused_for_approval" || run.requiresApproval === true,
    },
    metrics: {
      latencyMs,
      stepCount,
      artifactCount,
      estimatedTokens: run.metrics?.estimatedTokens ?? estimate.estimatedTokens,
      estimatedCostUsd:
        run.metrics?.estimatedCostUsd ?? estimate.estimatedCostUsd,
    },
    provenance: {
      source: run.provenance?.source || "cognivern",
      workflowVersion: run.provenance?.workflowVersion || "v1",
      model: run.provenance?.model || "unknown",
      citations: run.provenance?.citations || [],
    },
    events: run.events || [],
  });
}

async function pushRunEvent(
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
  },
) {
  const events = run.events || [];
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const eventData = {
    id: eventId,
    runId: run.runId,
    type: event.type,
    timestamp,
    payload: event.payload,
  };

  const evidence = await signManualEvent(run.runId, eventData);

  events.push({
    ...eventData,
    stepName: event.stepName,
    evidence,
  });

  const enriched = enrichCreRunEvidence({
    ...run,
    events,
  });
  run.events = enriched.events;
  run.artifacts = enriched.artifacts;
  run.evidence = enriched.evidence;
}

export class CreController {
  private static readonly IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

  private makeIdempotencyKey(req: Request, scope: string): string | null {
    const rawHeader =
      req.header("Idempotency-Key") || req.header("X-Idempotency-Key");
    if (!rawHeader) return null;
    const header = rawHeader.trim().slice(0, 120);
    if (!header) return null;
    return `${scope}:${header}`;
  }

  private async cleanupIdempotencyStore() {
    // BaseStore now handles TTL cleanup automatically via cleanupExpired()
    await idempotencyStore.cleanupExpired();
  }

  private async getCachedIdempotentResponse(
    key: string,
  ): Promise<IdempotencyRecord | null> {
    return await idempotencyStore.getRecord(key);
  }

  private async setCachedIdempotentResponse(
    key: string,
    statusCode: number,
    body: Record<string, unknown>,
  ) {
    await idempotencyStore.setRecord(key, {
      statusCode,
      body,
      createdAtMs: Date.now(),
    });
  }

  async listRuns(req: Request, res: Response) {
    const projectIdRaw = (req.query.projectId as string) || "default";
    const projectId = projectIdRaw.slice(0, 120);
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
    const normalized = normalizeRun(run);
    normalized.events = (normalized.events || []).map(translateCreEventToAgUi);
    res.json({ success: true, run: normalized });
  }

  async getRunEvents(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const sinceParsed = req.query.since ? Number(req.query.since) : undefined;
    const since =
      typeof sinceParsed === "number" && !Number.isNaN(sinceParsed)
        ? sinceParsed
        : undefined;
    const normalized = normalizeRun(run);
    const events = (normalized.events || [])
      .filter((event) => {
        if (!since) return true;
        return new Date(event.timestamp).getTime() > since;
      })
      .map(translateCreEventToAgUi);
    res.json({
      success: true,
      runId: run.runId,
      events,
      cursor: events.length
        ? new Date(events[events.length - 1].timestamp).getTime()
        : since || Date.now(),
    });
  }

  async streamRunEvents(req: Request, res: Response) {
    const runId = req.params.runId;
    const run = await creRunStore.get(runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }

    const sinceParsed = req.query.since ? Number(req.query.since) : undefined;
    const lastEventIdHeader = req.header("Last-Event-ID");
    const lastEventIdParsed = lastEventIdHeader
      ? Number(lastEventIdHeader)
      : undefined;
    let cursor = 0;
    if (
      typeof lastEventIdParsed === "number" &&
      !Number.isNaN(lastEventIdParsed)
    ) {
      cursor = lastEventIdParsed;
    } else if (typeof sinceParsed === "number" && !Number.isNaN(sinceParsed)) {
      cursor = sinceParsed;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendEvent = (
      eventName: string,
      payload: Record<string, unknown>,
      id?: string,
    ) => {
      if (id) {
        res.write(`id: ${id}\n`);
      }
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent("ready", { runId, cursor, timestamp: new Date().toISOString() });

    const sendNewEvents = async () => {
      const currentRun = await creRunStore.get(runId);
      if (!currentRun) {
        sendEvent("error", { message: "Run not found" });
        return;
      }
      const normalized = normalizeRun(currentRun);
      const newEvents = (normalized.events || []).filter(
        (event) => new Date(event.timestamp).getTime() > cursor,
      );

      for (const event of newEvents) {
        const ts = new Date(event.timestamp).getTime();
        const eventIdForResume = Number.isNaN(ts) ? undefined : String(ts);
        sendEvent(
          "run_event",
          translateCreEventToAgUi(event) as unknown as Record<string, unknown>,
          eventIdForResume,
        );
        if (!Number.isNaN(ts)) {
          cursor = ts;
        }
      }

      if (!newEvents.length) {
        res.write(": heartbeat\n\n");
      }
    };

    // Send initial batch immediately.
    await sendNewEvents();

    const intervalId = setInterval(() => {
      void sendNewEvents();
    }, 2000);

    req.on("close", () => {
      clearInterval(intervalId);
      res.end();
    });
  }

  async triggerForecast(req: Request, res: Response) {
    const parse = triggerForecastSchema.safeParse(req.body || {});
    if (!parse.success) {
      res
        .status(400)
        .json({ success: false, error: "Invalid trigger payload" });
      return;
    }
    const { writeAttestation = false, requireApproval = false } = parse.data;

    const idemKey = this.makeIdempotencyKey(req, "cre:triggerForecast");
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    const run = await runForecastingWorkflow({
      mode: "local",
      // If approval is required, hold before any attestation side effects.
      writeAttestation: requireApproval ? false : writeAttestation,
      arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
      signer: getCreSigner(),
    });

    const normalized = normalizeRun(run);
    if (requireApproval) {
      normalized.status = "paused_for_approval";
      normalized.requiresApproval = true;
      normalized.approvalState = "pending";
      normalized.ok = false;
      normalized.finishedAt = undefined;
      normalized.controls = {
        canCancel: true,
        canRetry: false,
        canApprove: true,
      };
      await pushRunEvent(normalized, {
        type: "run_paused_for_approval",
        payload: {
          reason: "manual_approval_required",
          pendingAction: writeAttestation ? "attestation" : "run_finalize",
        },
      });
    }
    const storedRun = normalizeRun(normalized);
    await creRunStore.add(storedRun);

    const responseBody = {
      success: storedRun.ok,
      runId: storedRun.runId,
      run: storedRun,
    };
    if (idemKey) {
      await this.setCachedIdempotentResponse(
        idemKey,
        200,
        responseBody as Record<string, unknown>,
      );
    }
    res.json(responseBody);
  }

  async cancelRun(req: Request, res: Response) {
    const idemKey = this.makeIdempotencyKey(
      req,
      `cre:cancelRun:${req.params.runId}`,
    );
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

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

    await pushRunEvent(normalized, {
      type: "run_cancel_requested",
      payload: { requestedBy: "user" },
    });
    normalized.status = "cancelled";
    normalized.finishedAt = new Date().toISOString();
    normalized.ok = false;
    normalized.controls = {
      canCancel: false,
      canRetry: true,
      canApprove: false,
    };
    await pushRunEvent(normalized, {
      type: "run_cancelled",
      payload: { source: "api" },
    });

    const storedRun = normalizeRun(normalized);
    await creRunStore.replace(storedRun);
    const responseBody = { success: true, run: storedRun };
    if (idemKey) {
      await this.setCachedIdempotentResponse(
        idemKey,
        200,
        responseBody as Record<string, unknown>,
      );
    }
    res.json(responseBody);
  }

  async retryRun(req: Request, res: Response) {
    const parse = retryRunSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({ success: false, error: "Invalid retry payload" });
      return;
    }
    const { writeAttestation = false, fromStep = 0 } = parse.data;

    const idemKey = this.makeIdempotencyKey(
      req,
      `cre:retryRun:${req.params.runId}`,
    );
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const original = normalizeRun(run);
    await pushRunEvent(original, {
      type: "run_retry_requested",
      payload: { requestedBy: "user" },
    });
    await creRunStore.replace(normalizeRun(original));

    const newRun = normalizeRun(
      await runForecastingWorkflow({
        mode: "local",
        writeAttestation,
        arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
        signer: getCreSigner(),
      }),
    );
    newRun.parentRunId = original.runId;
    newRun.retryCount = (original.retryCount || 0) + 1;
    if (fromStep > 0) {
      newRun.provenance = {
        ...(newRun.provenance || { source: "cognivern" }),
        citations: [
          ...((newRun.provenance?.citations || []) as Array<{
            label: string;
            value: string;
          }>),
          { label: "retry_from_step", value: String(fromStep) },
        ],
      };
      await pushRunEvent(newRun, {
        type: "run_retry_requested",
        payload: { retriedFromRunId: original.runId, fromStep },
      });
    }
    const storedRun = normalizeRun(newRun);
    await creRunStore.add(storedRun);
    const responseBody = {
      success: true,
      runId: newRun.runId,
      run: storedRun,
      retriedFrom: original.runId,
    };
    if (idemKey) {
      await this.setCachedIdempotentResponse(
        idemKey,
        200,
        responseBody as Record<string, unknown>,
      );
    }
    res.json(responseBody);
  }

  async submitApproval(req: Request, res: Response) {
    const parse = submitApprovalSchema.safeParse(req.body || {});
    if (!parse.success) {
      res
        .status(400)
        .json({ success: false, error: "Invalid approval payload" });
      return;
    }
    const { approve, reason = "" } = parse.data;

    const idemKey = this.makeIdempotencyKey(
      req,
      `cre:submitApproval:${req.params.runId}`,
    );
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const normalized = normalizeRun(run);
    const safeReason = reason.trim().slice(0, 500);

    normalized.approvalState = approve ? "approved" : "rejected";
    normalized.approvalReason = safeReason || undefined;
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
      await pushRunEvent(normalized, {
        type: "run_finished",
        payload: {
          reason: "approval_granted",
          note: safeReason || null,
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
      await pushRunEvent(normalized, {
        type: "run_failed",
        payload: { reason: "approval_rejected", note: safeReason || null },
      });
    }

    normalized.controls = {
      canCancel: normalized.status === "running",
      canRetry:
        normalized.status === "failed" || normalized.status === "cancelled",
      canApprove: false,
    };

    const storedRun = normalizeRun(normalized);
    await creRunStore.replace(storedRun);
    const responseBody = { success: true, run: storedRun };
    if (idemKey) {
      await this.setCachedIdempotentResponse(
        idemKey,
        200,
        responseBody as Record<string, unknown>,
      );
    }
    res.json(responseBody);
  }

  async updateRunPlan(req: Request, res: Response) {
    const parse = updatePlanSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({ success: false, error: "Invalid plan payload" });
      return;
    }
    const { plan } = parse.data;

    const idemKey = this.makeIdempotencyKey(
      req,
      `cre:updateRunPlan:${req.params.runId}`,
    );
    if (idemKey) {
      const cached = await this.getCachedIdempotentResponse(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }

    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    const normalized = normalizeRun(run);

    normalized.plan = {
      version: plan.version,
      updatedAt: new Date().toISOString(),
      summary: plan.summary,
      steps: plan.steps.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        enabled: step.enabled,
        status: step.status || "pending",
      })),
    };

    if (normalized.status === "running") {
      normalized.status = "paused_for_approval";
      normalized.requiresApproval = true;
      normalized.approvalState = "pending";
      normalized.controls = {
        canCancel: true,
        canRetry: false,
        canApprove: true,
      };
      await pushRunEvent(normalized, {
        type: "run_paused_for_approval",
        payload: { reason: "plan_updated_requires_approval" },
      });
    }

    const storedRun = normalizeRun(normalized);
    await creRunStore.replace(storedRun);
    const responseBody = { success: true, run: storedRun };
    if (idemKey) {
      await this.setCachedIdempotentResponse(
        idemKey,
        200,
        responseBody as Record<string, unknown>,
      );
    }
    res.json(responseBody);
  }
}
