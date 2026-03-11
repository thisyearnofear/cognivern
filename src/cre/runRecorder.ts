import crypto from "node:crypto";
import {
  CreArtifact,
  CreRun,
  CreRunEventType,
  CreStepKind,
  CreStepLog,
} from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

export class CreRunRecorder {
  private run: CreRun;

  constructor(params: { workflow: CreRun["workflow"]; mode: CreRun["mode"] }) {
    this.run = {
      runId: crypto.randomUUID(),
      workflow: params.workflow,
      mode: params.mode,
      startedAt: nowIso(),
      ok: false,
      status: "running",
      retryCount: 0,
      approvalState: "not_required",
      controls: {
        canCancel: true,
        canRetry: false,
        canApprove: false,
      },
      provenance: {
        source: "cognivern",
      },
      events: [],
      steps: [],
      artifacts: [],
    };
    this.pushEvent("run_started", {
      workflow: params.workflow,
      mode: params.mode,
    });
  }

  private pushEvent(
    type: CreRunEventType,
    payload?: Record<string, unknown>,
    stepName?: string,
  ) {
    if (!this.run.events) this.run.events = [];
    this.run.events.push({
      id: crypto.randomUUID(),
      runId: this.run.runId,
      type,
      timestamp: nowIso(),
      stepName,
      payload,
    });
  }

  startStep(
    kind: CreStepKind,
    name: string,
    details?: Record<string, unknown>,
  ) {
    this.run.currentStepName = name;
    this.pushEvent("tool_call_started", { kind, details }, name);
    const step: CreStepLog = {
      kind,
      name,
      startedAt: nowIso(),
      ok: false,
      details,
    };
    this.run.steps.push(step);

    return {
      end: (params: {
        ok: boolean;
        summary?: string;
        details?: Record<string, unknown>;
      }) => {
        step.finishedAt = nowIso();
        step.ok = params.ok;
        step.summary = params.summary;
        step.details = { ...(step.details || {}), ...(params.details || {}) };
        this.pushEvent(
          "tool_result",
          { ok: params.ok, summary: params.summary, details: params.details },
          name,
        );
      },
    };
  }

  addArtifact(artifact: Omit<CreArtifact, "id" | "createdAt">): CreArtifact {
    const a: CreArtifact = {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      ...artifact,
    };
    this.run.artifacts.push(a);
    return a;
  }

  finish(ok: boolean) {
    this.run.finishedAt = nowIso();
    this.run.ok = ok;
    this.run.status = ok ? "completed" : "failed";
    this.run.currentStepName = undefined;
    this.run.controls = {
      canCancel: false,
      canRetry: true,
      canApprove: false,
    };
    const latencyMs =
      new Date(this.run.finishedAt).getTime() -
      new Date(this.run.startedAt).getTime();
    this.run.metrics = {
      latencyMs: Math.max(0, latencyMs),
      stepCount: this.run.steps.length,
      artifactCount: this.run.artifacts.length,
    };
    this.pushEvent(ok ? "run_finished" : "run_failed", {
      latencyMs: this.run.metrics.latencyMs,
      stepCount: this.run.metrics.stepCount,
      artifactCount: this.run.metrics.artifactCount,
    });
  }

  getRun(): CreRun {
    return this.run;
  }
}
