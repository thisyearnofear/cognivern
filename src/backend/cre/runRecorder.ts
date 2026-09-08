import crypto from "node:crypto";
import { ethers } from "ethers";
import {
  CreArtifact,
  CreRun,
  CreRunEventType,
  CreStepKind,
  CreStepLog,
} from "./types.js";
import { CreRunDecider } from "./decider.js";

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
    projectId: string;
    signer?: ethers.Signer;
  }) {
    this.signer = params.signer ?? getDefaultEvidenceSigner();
    // The run shape + the run_started event are owned by the (pure) decider;
    // the recorder generates the runId (RNG) and injects the clock.
    const { run, events } = CreRunDecider.start(
      {
        runId: crypto.randomUUID(),
        workflow: params.workflow,
        mode: params.mode,
        projectId: params.projectId,
      },
      nowIso,
    );
    this.run = run;
    for (const spec of events) this.pushEvent(spec.type, spec.payload, spec.stepName);
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
    // Pure transition: the decider decides the terminal status, controls,
    // metrics, and the run_finished / run_failed event. The recorder applies
    // the patch, appends the event, and performs the signing side effect.
    const decision = CreRunDecider.finish(this.run, ok, nowIso);
    for (const spec of decision.events) this.pushEvent(spec.type, spec.payload, spec.stepName);
    Object.assign(this.run, decision.patch);

    // Sign the summary of the run
    const summaryToSign = {
      runId: this.run.runId,
      ok: this.run.ok,
      status: this.run.status,
      metrics: this.run.metrics,
      artifactHashes: this.run.artifacts.map((a) => a.evidence?.hash),
    };

    this.run.evidence = await this.signEvidence(summaryToSign);
  }

  async pauseForApproval(
    reason: string,
    pendingAction?: string,
    details?: Record<string, unknown>,
  ) {
    // Pure transition: the decider decides the paused status, approval state,
    // metrics, and the run_paused_for_approval event. The recorder applies the
    // patch, appends the event, and signs the evidence.
    const decision = CreRunDecider.pauseForApproval(
      this.run,
      reason,
      pendingAction,
      details,
      nowIso,
    );
    for (const spec of decision.events) this.pushEvent(spec.type, spec.payload, spec.stepName);
    Object.assign(this.run, decision.patch);

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
  }

  getRun(): CreRun {
    return this.run;
  }
}
