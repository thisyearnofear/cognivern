import { Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  AgentRunEvent,
  runAgent,
} from "../../../../../agent/agent.js";
import {
  copilotRunStore,
  type PersistedCopilotEvent,
  type PersistedCopilotRun,
} from "../storage/CopilotRunStore.js";

type CopilotRunStatus =
  | "queued"
  | "running"
  | "awaiting_confirmation"
  | "confirmed"
  | "completed"
  | "failed";

type CopilotEventType =
  | "run_started"
  | "model_tool_call"
  | "tool_result"
  | "tool_error"
  | "preview_ready"
  | "confirmation_required"
  | "confirmation_recorded"
  | "execution_blocked"
  | "final"
  | "run_failed";

interface AgentEventResult {
  id: number;
  type: CopilotEventType;
  timestamp: string;
  name?: string;
  payload?: Record<string, unknown>;
}

function publicRun(run: PersistedCopilotRun) {
  return {
    id: run.id,
    goal: run.goal,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    status: run.status,
    summary: run.summary,
    error: run.error,
    preview: run.preview,
    result: run.result,
    events: run.events,
  };
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function summarizeToolResult(result: unknown): Record<string, unknown> {
  const record = toRecord(result);
  if (!record) return { result };

  const keys = [
    "id",
    "status",
    "decision",
    "reason",
    "attestationHash",
    "decisionId",
    "auditLogId",
    "simulation",
    "contractAudit",
  ];
  const summary: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in record) summary[key] = record[key];
  }
  return Object.keys(summary).length ? summary : record;
}

const startRunSchema = z.object({
  goal: z.string().trim().min(10).max(2000),
  previewOnly: z.boolean().optional().default(true),
});

const confirmRunSchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

// Monotonic event id counter (process-local; event ids only need to be
// unique within a run, and we ORDER BY id ASC on read).
let nextEventId = 1;

function translateAgentEvent(run: PersistedCopilotRun, event: AgentRunEvent) {
  switch (event.type) {
    case "model_tool_call":
      appendEvent(run, "model_tool_call", { args: event.args }, event.name);
      break;
    case "tool_result": {
      const payload = summarizeToolResult(event.result);
      appendEvent(run, "tool_result", payload, event.name);
      if (event.name === "cognivern_preview_spend") {
        copilotRunStore.updatePreview(run.id, payload, new Date().toISOString());
        run.preview = payload;
        copilotRunStore.updateStatus(run.id, "awaiting_confirmation", new Date().toISOString());
        run.status = "awaiting_confirmation";
        appendEvent(run, "preview_ready", payload, event.name);
        appendEvent(run, "confirmation_required", {
          reason: "Operator confirmation is required before execution.",
        });
      }
      break;
    }
    case "tool_error":
      appendEvent(run, "tool_error", { error: event.error }, event.name);
      break;
    case "hitl_denied":
      copilotRunStore.updateStatus(run.id, "awaiting_confirmation", new Date().toISOString());
      run.status = "awaiting_confirmation";
      appendEvent(run, "confirmation_required", { reason: event.reason }, event.name);
      break;
    case "preview_intercepted":
      copilotRunStore.updateStatus(run.id, "awaiting_confirmation", new Date().toISOString());
      run.status = "awaiting_confirmation";
      appendEvent(run, "execution_blocked", { reason: event.reason }, event.name);
      break;
    case "final":
      copilotRunStore.updateSummary(run.id, event.summary, new Date().toISOString());
      run.summary = event.summary;
      appendEvent(run, "final", { summary: event.summary });
      break;
  }
}

function appendEvent(
  run: PersistedCopilotRun,
  type: CopilotEventType,
  payload?: Record<string, unknown>,
  name?: string,
) {
  const persisted: PersistedCopilotEvent = {
    id: nextEventId++,
    type,
    timestamp: new Date().toISOString(),
    name,
    payload,
  };
  copilotRunStore.appendEvent(run.id, persisted);
  run.events.push(persisted);
  run.updatedAt = persisted.timestamp;
}

async function executeRun(run: PersistedCopilotRun, previewOnly: boolean) {
  copilotRunStore.updateStatus(run.id, "running", new Date().toISOString());
  run.status = "running";
  appendEvent(run, "run_started", {
    runtime: "vertex-ai",
    model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  });

  try {
    const result = await runAgent({
      goal: run.goal,
      cognivernApiKey: process.env.COGNIVERN_API_KEY || "development-api-key",
      cognivernBaseUrl:
        process.env.COGNIVERN_BASE_URL || "https://cognivern.thisyearnofear.com",
      mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017",
      mongodbDatabase: process.env.MONGODB_DB_NAME || "cognivern",
      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
      googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
      vertexLocation: process.env.VERTEX_LOCATION || "global",
      previewOnly,
      onEvent(event) {
        translateAgentEvent(run, event);
      },
    });

    const now = new Date().toISOString();
    copilotRunStore.updateResult(
      run.id,
      {
        summary: result.summary,
        decisionId: result.decisionId,
        attestationHash: result.attestationHash,
        auditLogId: result.auditLogId,
      },
      now,
    );
    run.result = {
      summary: result.summary,
      decisionId: result.decisionId,
      attestationHash: result.attestationHash,
      auditLogId: result.auditLogId,
    };
    copilotRunStore.updateSummary(run.id, result.summary, now);
    run.summary = result.summary;
    if (run.status === "running") {
      copilotRunStore.updateStatus(run.id, "completed", now);
      run.status = "completed";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();
    copilotRunStore.updateStatus(run.id, "failed", now);
    run.status = "failed";
    copilotRunStore.updateError(run.id, message, now);
    run.error = message;
    appendEvent(run, "run_failed", { error: message });
  }
}

export class CopilotController {
  async startRun(req: Request, res: Response): Promise<void> {
    const parse = startRunSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: "Invalid copilot run payload",
        details: parse.error.format(),
      });
      return;
    }

    const now = new Date().toISOString();
    const runId = `copilot_${crypto.randomUUID()}`;

    copilotRunStore.create({
      id: runId,
      goal: parse.data.goal,
      createdAt: now,
      status: "queued",
    });

    const persisted = copilotRunStore.get(runId);
    if (!persisted) {
      res.status(500).json({ success: false, error: "Failed to persist run" });
      return;
    }

    // Fire-and-forget; SSE + GET will surface progress to the client.
    void executeRun(persisted, parse.data.previewOnly);

    res.status(202).json({
      success: true,
      run: publicRun(persisted),
    });
  }

  async getRun(req: Request, res: Response): Promise<void> {
    const run = copilotRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Copilot run not found" });
      return;
    }
    res.json({ success: true, run: publicRun(run) });
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const limitParsed = req.query.limit ? Number(req.query.limit) : undefined;
    const limit =
      typeof limitParsed === "number" && !Number.isNaN(limitParsed)
        ? Math.min(Math.max(limitParsed, 1), 50)
        : 10;
    const runs = copilotRunStore.listRecent(limit);
    res.json({ success: true, runs: runs.map(publicRun) });
  }

  async confirmRun(req: Request, res: Response): Promise<void> {
    const run = copilotRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Copilot run not found" });
      return;
    }

    const parse = confirmRunSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: "Invalid confirmation payload",
        details: parse.error.format(),
      });
      return;
    }

    const now = new Date().toISOString();

    if (!parse.data.approve) {
      copilotRunStore.updateStatus(run.id, "completed", now);
      run.status = "completed";
      appendEvent(run, "confirmation_recorded", {
        approved: false,
        reason: parse.data.reason || "Operator denied execution.",
      });
      res.json({ success: true, run: publicRun(copilotRunStore.get(run.id)!) });
      return;
    }

    copilotRunStore.updateStatus(run.id, "confirmed", now);
    run.status = "confirmed";
    appendEvent(run, "confirmation_recorded", {
      approved: true,
      reason: parse.data.reason || "Operator approved preview.",
    });
    appendEvent(run, "execution_blocked", {
      reason:
        "Execution remains disabled until a verified preview attestation is available for this hosted run.",
    });

    res.json({ success: true, run: publicRun(copilotRunStore.get(run.id)!) });
  }

  async streamRunEvents(req: Request, res: Response): Promise<void> {
    const run = copilotRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Copilot run not found" });
      return;
    }

    const sinceParsed = req.query.since ? Number(req.query.since) : undefined;
    const lastEventIdParsed = req.header("Last-Event-ID")
      ? Number(req.header("Last-Event-ID"))
      : undefined;
    let cursor =
      typeof lastEventIdParsed === "number" && !Number.isNaN(lastEventIdParsed)
        ? lastEventIdParsed
        : typeof sinceParsed === "number" && !Number.isNaN(sinceParsed)
          ? sinceParsed
          : 0;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (eventName: string, payload: Record<string, unknown>, id?: number) => {
      if (id) res.write(`id: ${id}\n`);
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send("ready", {
      runId: run.id,
      status: run.status,
      timestamp: new Date().toISOString(),
    });

    const sendNewEvents = () => {
      const current = copilotRunStore.get(run.id);
      if (!current) {
        send("error", { message: "Copilot run not found" });
        return;
      }

      const next = current.events.filter((event) => event.id > cursor);
      for (const event of next) {
        send("run_event", event as unknown as Record<string, unknown>, event.id);
        cursor = event.id;
      }

      if (!next.length) {
        res.write(": heartbeat\n\n");
      }
    };

    sendNewEvents();
    const interval = setInterval(sendNewEvents, 750);

    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });
  }
}
