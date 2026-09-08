import type { CreRun, CreRunEventType } from "./types.js";

/**
 * CreRunDecider — the pure state machine behind the run recorder.
 *
 * T3-style decider: a pure function of (current state, command) => events to
 * append + a patch to apply. NO side effects, NO signing, NO clock, NO RNG —
 * `now` is injected so the decider is deterministic and unit-testable in
 * isolation. `CreRunRecorder` is the side-effecting shell (signing, persistence)
 * that delegates every lifecycle transition here.
 *
 * @see CreRunProjector — the inverse: rebuild a read model from the event log.
 */
export type NowFn = () => string;

/** An event the recorder should append; it stamps id / runId / timestamp. */
export interface CreEventSpec {
  type: CreRunEventType;
  payload?: Record<string, unknown>;
  stepName?: string;
}

/** Result of a decision: events to append + fields to merge onto the run. */
export interface CreDecision {
  events: CreEventSpec[];
  patch: Partial<CreRun>;
}

export interface CreStartParams {
  runId: string;
  workflow: CreRun["workflow"];
  mode: CreRun["mode"];
  projectId: string;
}

function latencyMs(startedAt: string, now: string): number {
  return Math.max(0, new Date(now).getTime() - new Date(startedAt).getTime());
}

function stepMetrics(run: CreRun, now: string) {
  return {
    latencyMs: latencyMs(run.startedAt, now),
    stepCount: run.steps.length,
    artifactCount: run.artifacts.length,
  };
}

export const CreRunDecider = {
  /**
   * Build the initial run and the `run_started` event. The recorder generates
   * the `runId` (RNG) and injects `now`; the decider otherwise owns the shape.
   */
  start(params: CreStartParams, now: NowFn): { run: CreRun; events: CreEventSpec[] } {
    const run: CreRun = {
      runId: params.runId,
      workflow: params.workflow,
      mode: params.mode,
      projectId: params.projectId,
      startedAt: now(),
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
    const events: CreEventSpec[] = [
      { type: "run_started", payload: { workflow: params.workflow, mode: params.mode } },
    ];
    return { run, events };
  },

  /** Terminal transition: run succeeded or failed. */
  finish(run: CreRun, ok: boolean, now: NowFn): CreDecision {
    const finishedAt = now();
    const metrics = stepMetrics(run, finishedAt);
    return {
      events: [
        {
          type: ok ? "run_finished" : "run_failed",
          payload: {
            latencyMs: metrics.latencyMs,
            stepCount: metrics.stepCount,
            artifactCount: metrics.artifactCount,
          },
        },
      ],
      patch: {
        finishedAt,
        ok,
        status: ok ? "completed" : "failed",
        currentStepName: undefined,
        controls: { canCancel: false, canRetry: true, canApprove: false },
        metrics,
      },
    };
  },

  /**
   * Pause for operator approval. This is the decider transition the recorder
   * previously performed imperatively: it produces a clean `run_paused_for_
   * approval` event plus the exact patch, instead of mutating fields inline.
   * The run is left open (`finishedAt: undefined`).
   */
  pauseForApproval(
    run: CreRun,
    reason: string,
    pendingAction?: string,
    details?: Record<string, unknown>,
    now: NowFn = () => new Date().toISOString(),
  ): CreDecision {
    const n = now();
    const metrics = stepMetrics(run, n);
    return {
      events: [
        {
          type: "run_paused_for_approval",
          payload: { reason, pendingAction, ...details },
        },
      ],
      patch: {
        finishedAt: undefined,
        ok: false,
        status: "paused_for_approval",
        requiresApproval: true,
        approvalState: "pending",
        approvalReason: reason,
        currentStepName: undefined,
        controls: { canCancel: true, canRetry: false, canApprove: true },
        metrics,
      },
    };
  },
};
