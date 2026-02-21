import crypto from "node:crypto";
import { CreArtifact, CreRun, CreStepKind, CreStepLog } from "./types.js";

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
      steps: [],
      artifacts: [],
    };
  }

  startStep(kind: CreStepKind, name: string, details?: Record<string, unknown>) {
    const step: CreStepLog = {
      kind,
      name,
      startedAt: nowIso(),
      ok: false,
      details,
    };
    this.run.steps.push(step);

    return {
      end: (params: { ok: boolean; summary?: string; details?: Record<string, unknown> }) => {
        step.finishedAt = nowIso();
        step.ok = params.ok;
        step.summary = params.summary;
        step.details = { ...(step.details || {}), ...(params.details || {}) };
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
  }

  getRun(): CreRun {
    return this.run;
  }
}
