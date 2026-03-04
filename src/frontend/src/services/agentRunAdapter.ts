import { CreRun, CreRunEvent } from "./creApi";
import { ForensicEvent, EventType } from "../components/ui/ForensicTimeline";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "paused_for_approval"
  | "cancelled"
  | "completed"
  | "failed";

export interface AgentRunViewModel {
  runId: string;
  status: AgentRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationLabel: string;
  currentStepName?: string;
  controls: {
    canCancel: boolean;
    canRetry: boolean;
    canApprove: boolean;
  };
  metrics: {
    latencyMs?: number;
    stepCount: number;
    artifactCount: number;
    estimatedTokens?: number;
    estimatedCostUsd?: number;
  };
  provenance: {
    source: "cognivern" | "ingested";
    workflowVersion?: string;
    model?: string;
    citations: Array<{ label: string; value: string }>;
  };
}

const eventToTimelineType = (eventType: CreRunEvent["type"]): EventType => {
  switch (eventType) {
    case "tool_call_started":
    case "message_delta":
      return "action";
    case "run_paused_for_approval":
      return "validation";
    case "run_failed":
      return "error";
    case "run_cancel_requested":
    case "run_cancelled":
      return "block";
    default:
      return "observation";
  }
};

const humanTitle = (event: CreRunEvent): string => {
  switch (event.type) {
    case "run_started":
      return "Run Started";
    case "tool_call_started":
      return event.stepName ? `Tool Call: ${event.stepName}` : "Tool Call Started";
    case "tool_result":
      return event.stepName ? `Tool Result: ${event.stepName}` : "Tool Result";
    case "run_paused_for_approval":
      return "Paused For Approval";
    case "run_cancel_requested":
      return "Cancellation Requested";
    case "run_cancelled":
      return "Run Cancelled";
    case "run_retry_requested":
      return "Retry Requested";
    case "run_finished":
      return "Run Finished";
    case "run_failed":
      return "Run Failed";
    case "message_delta":
      return "Agent Message";
    default:
      return "Run Event";
  }
};

const humanDescription = (event: CreRunEvent): string => {
  const payload = event.payload || {};
  if (typeof payload.summary === "string" && payload.summary.trim()) {
    return payload.summary;
  }
  if (typeof payload.reason === "string" && payload.reason.trim()) {
    return payload.reason;
  }
  if (typeof payload.note === "string" && payload.note.trim()) {
    return payload.note;
  }
  if (event.stepName) {
    return `Execution step '${event.stepName}' emitted ${event.type}.`;
  }
  return `Run event: ${event.type}.`;
};

export const toAgentRunViewModel = (run: CreRun): AgentRunViewModel => {
  const status = run.status || (run.finishedAt ? (run.ok ? "completed" : "failed") : "running");
  const start = new Date(run.startedAt).getTime();
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
  const durationMs = Math.max(0, end - start);
  const durationLabel = run.finishedAt ? `${durationMs}ms` : "running";

  return {
    runId: run.runId,
    status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationLabel,
    currentStepName: run.currentStepName,
    controls: run.controls || {
      canCancel: status === "running" || status === "queued",
      canRetry: status === "failed" || status === "cancelled" || status === "completed",
      canApprove: status === "paused_for_approval" || run.requiresApproval === true,
    },
    metrics: {
      latencyMs: run.metrics?.latencyMs,
      stepCount: run.metrics?.stepCount ?? run.steps.length,
      artifactCount: run.metrics?.artifactCount ?? run.artifacts.length,
      estimatedTokens: run.metrics?.estimatedTokens,
      estimatedCostUsd: run.metrics?.estimatedCostUsd,
    },
    provenance: {
      source: run.provenance?.source || "cognivern",
      workflowVersion: run.provenance?.workflowVersion,
      model: run.provenance?.model,
      citations: run.provenance?.citations || [],
    },
  };
};

export const toForensicEvents = (
  run: CreRun,
  liveEvents: CreRunEvent[] = []
): ForensicEvent[] => {
  const sourceEvents = [...(run.events || []), ...liveEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sourceEvents.length) {
    return sourceEvents.map((event) => ({
      id: event.id,
      timestamp: new Date(event.timestamp).getTime(),
      type: eventToTimelineType(event.type),
      title: humanTitle(event),
      description: humanDescription(event),
      metadata: event.payload,
      status:
        event.type === "run_failed" || event.type === "run_cancelled"
          ? "error"
          : event.type === "run_paused_for_approval"
            ? "warning"
            : "success",
    }));
  }

  return run.steps.map((step, idx) => ({
    id: `step-${idx}`,
    timestamp: step.startedAt ? new Date(step.startedAt).getTime() : Date.now(),
    type: step.ok ? "action" : "error",
    title: step.name,
    description: step.summary || `Step ${step.kind} completed.`,
    metadata: step.details,
    status: step.ok ? "success" : "error",
  }));
};
