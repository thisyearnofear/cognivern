import crypto from "node:crypto";
import { ethers } from "ethers";
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

// Shared default signer so recorder-created runs are signed even when the
// call site doesn't wire one explicitly. Same key AuditLogService uses.
let defaultSignerCache: ethers.Signer | null | undefined;
function getDefaultEvidenceSigner(): ethers.Signer | undefined {
  if (defaultSignerCache === undefined) {
    const pk =
      process.env.EVIDENCE_SIGNING_KEY || process.env.FILECOIN_PRIVATE_KEY;
    defaultSignerCache = pk ? new ethers.Wallet(pk) : null;
  }
  return defaultSignerCache ?? undefined;
}

export class CreRunRecorder {
  private run: CreRun;
  private signer?: ethers.Signer;

  constructor(params: {
    workflow: CreRun["workflow"];
    mode: CreRun["mode"];
    signer?: ethers.Signer;
  }) {
    this.signer = params.signer ?? getDefaultEvidenceSigner();
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

  private computeHash(data: unknown): string {
    const json = JSON.stringify(data);
    return ethers.keccak256(ethers.toUtf8Bytes(json));
  }

  private async signEvidence(data: unknown) {
    const hash = this.computeHash(data);
    if (!this.signer) return { hash };
    const signature = await this.signer.signMessage(hash);
    const signerAddress = await this.signer.getAddress();
    return { hash, signature, signer: signerAddress };
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

  async addArtifact(
    artifact: Omit<CreArtifact, "id" | "createdAt" | "evidence">,
  ): Promise<CreArtifact> {
    const id = crypto.randomUUID();
    const createdAt = nowIso();

    const evidence = await this.signEvidence({
      id,
      type: artifact.type,
      data: artifact.data,
      createdAt,
    });

    const a: CreArtifact = {
      id,
      createdAt,
      ...artifact,
      evidence,
    };

    this.run.artifacts.push(a);
    return a;
  }

  async finish(ok: boolean) {
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

    // Sign the summary of the run
    const summaryToSign = {
      runId: this.run.runId,
      ok: this.run.ok,
      status: this.run.status,
      metrics: this.run.metrics,
      artifactHashes: this.run.artifacts.map((a) => a.evidence?.hash),
    };

    this.run.evidence = await this.signEvidence(summaryToSign);

    this.pushEvent(ok ? "run_finished" : "run_failed", {
      latencyMs: this.run.metrics.latencyMs,
      stepCount: this.run.metrics.stepCount,
      artifactCount: this.run.metrics.artifactCount,
    });
  }

  async pauseForApproval(
    reason: string,
    pendingAction?: string,
    details?: Record<string, unknown>,
  ) {
    this.run.finishedAt = undefined;
    this.run.ok = false;
    this.run.status = "paused_for_approval";
    this.run.requiresApproval = true;
    this.run.approvalState = "pending";
    this.run.approvalReason = reason;
    this.run.currentStepName = undefined;
    this.run.controls = {
      canCancel: true,
      canRetry: false,
      canApprove: true,
    };
    this.run.metrics = {
      latencyMs: Math.max(
        0,
        Date.now() - new Date(this.run.startedAt).getTime(),
      ),
      stepCount: this.run.steps.length,
      artifactCount: this.run.artifacts.length,
    };

    const summaryToSign = {
      runId: this.run.runId,
      ok: this.run.ok,
      status: this.run.status,
      approvalState: this.run.approvalState,
      approvalReason: reason,
      metrics: this.run.metrics,
      artifactHashes: this.run.artifacts.map(
        (artifact) => artifact.evidence?.hash,
      ),
    };

    this.run.evidence = await this.signEvidence(summaryToSign);

    this.pushEvent("run_paused_for_approval", {
      reason,
      pendingAction,
      ...details,
    });
  }

  getRun(): CreRun {
    return this.run;
  }
}
