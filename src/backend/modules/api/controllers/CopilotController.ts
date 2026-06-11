import { Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  AgentRunEvent,
  runAgent,
} from "../../../../../agent/agent.js";

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

interface CopilotEvent {
  id: number;
  type: CopilotEventType;
  timestamp: string;
  name?: string;
  payload?: Record<string, unknown>;
}

interface CopilotRun {
  id: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  status: CopilotRunStatus;
  events: CopilotEvent[];
  summary?: string;
  error?: string;
  preview?: Record<string, unknown>;
  result?: {
    summary: string;
    decisionId?: string;
    attestationHash?: string;
    auditLogId?: string;
  };
}

const startRunSchema = z.object({
  goal: z.string().trim().min(10).max(2000),
  previewOnly: z.boolean().optional().default(true),
});

const confirmRunSchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

const runs = new Map<string, CopilotRun>();
let nextEventId = 1;

function publicRun(run: CopilotRun) {
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

function pushEvent(
  run: CopilotRun,
  type: CopilotEventType,
  payload?: Record<string, unknown>,
  name?: string,
) {
  const timestamp = new Date().toISOString();
  run.updatedAt = timestamp;
  run.events.push({
    id: nextEventId++,
    type,
    timestamp,
    name,
    payload,
  });
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

function translateAgentEvent(run: CopilotRun, event: AgentRunEvent) {
  switch (event.type) {
    case "model_tool_call":
      pushEvent(
        run,
        "model_tool_call",
        { args: event.args },
        event.name,
      );
      break;
    case "tool_result": {
      const payload = summarizeToolResult(event.result);
      pushEvent(run, "tool_result", payload, event.name);
      if (event.name === "cognivern_preview_spend") {
        run.preview = payload;
        run.status = "awaiting_confirmation";
        pushEvent(run, "preview_ready", payload, event.name);
        pushEvent(run, "confirmation_required", {
          reason: "Operator confirmation is required before execution.",
        });
      }
      break;
    }
    case "tool_error":
      pushEvent(run, "tool_error", { error: event.error }, event.name);
      break;
    case "hitl_denied":
      run.status = "awaiting_confirmation";
      pushEvent(run, "confirmation_required", { reason: event.reason }, event.name);
      break;
    case "preview_intercepted":
      run.status = "awaiting_confirmation";
      pushEvent(run, "execution_blocked", { reason: event.reason }, event.name);
      break;
    case "final":
      run.summary = event.summary;
      pushEvent(run, "final", { summary: event.summary });
      break;
  }
}

async function executeRun(run: CopilotRun, previewOnly: boolean) {
  run.status = "running";
  pushEvent(run, "run_started", {
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

    run.result = {
      summary: result.summary,
      decisionId: result.decisionId,
      attestationHash: result.attestationHash,
      auditLogId: result.auditLogId,
    };
    run.summary = result.summary;
    if (run.status === "running") {
      run.status = "completed";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    run.status = "failed";
    run.error = message;
    pushEvent(run, "run_failed", { error: message });
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
    const run: CopilotRun = {
      id: `copilot_${crypto.randomUUID()}`,
      goal: parse.data.goal,
      createdAt: now,
      updatedAt: now,
      status: "queued",
      events: [],
    };
    runs.set(run.id, run);

    void executeRun(run, parse.data.previewOnly);

    res.status(202).json({
      success: true,
      run: publicRun(run),
    });
  }

  async getRun(req: Request, res: Response): Promise<void> {
    const run = runs.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Copilot run not found" });
      return;
    }
    res.json({ success: true, run: publicRun(run) });
  }

  async confirmRun(req: Request, res: Response): Promise<void> {
    const run = runs.get(req.params.runId);
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

    if (!parse.data.approve) {
      run.status = "completed";
      pushEvent(run, "confirmation_recorded", {
        approved: false,
        reason: parse.data.reason || "Operator denied execution.",
      });
      res.json({ success: true, run: publicRun(run) });
      return;
    }

    run.status = "confirmed";
    pushEvent(run, "confirmation_recorded", {
      approved: true,
      reason: parse.data.reason || "Operator approved preview.",
    });
    pushEvent(run, "execution_blocked", {
      reason:
        "Execution remains disabled until a verified preview attestation is available for this hosted run.",
    });

    res.json({ success: true, run: publicRun(run) });
  }

  async streamRunEvents(req: Request, res: Response): Promise<void> {
    const run = runs.get(req.params.runId);
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
      const current = runs.get(run.id);
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
