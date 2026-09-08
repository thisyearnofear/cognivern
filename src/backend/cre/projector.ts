import type { CreRun, CreRunEvent, CreRunStatus } from "./types.js";

/**
 * CreRunProjector — rebuild a run read model from an immutable event log.
 *
 * The inverse of `CreRunDecider`: given the persisted events (and an initial
 * skeleton), derive the status / metrics / approval state the API and audit
 * views need. Keeping projection here (not in the recorder) makes runs
 * concurrency-safe to rebuild and lets us verify the event log is a *sufficient*
 * record — a projector that cannot reproduce the recorder's status signals a
 * missing event.
 *
 * @see CreRunDecider — produces the events this consumes.
 */
export const CreRunProjector = {
  /** Fold the event log into the final run status, or undefined if unknown. */
  deriveStatus(events: CreRunEvent[]): CreRunStatus | undefined {
    let status: CreRunStatus | undefined;
    for (const e of events) {
      switch (e.type) {
        case "run_started":
          status = "running";
          break;
        case "run_paused_for_approval":
          status = "paused_for_approval";
          break;
        case "run_cancelled":
          status = "cancelled";
          break;
        case "run_finished":
          status = "completed";
          break;
        case "run_failed":
          status = "failed";
          break;
        default:
          break;
      }
    }
    return status;
  },

  /**
   * Pull latency / counts from the last terminal event payload. Returns
   * undefined if the run has not reached a state that records metrics.
   */
  deriveMetrics(
    events: CreRunEvent[],
  ): Pick<NonNullable<CreRun["metrics"]>, "latencyMs" | "stepCount" | "artifactCount"> | undefined {
    for (let i = events.length - 1; i >= 0; i--) {
      const p = events[i]?.payload;
      if (
        p &&
        typeof p === "object" &&
        "latencyMs" in p &&
        "stepCount" in p &&
        "artifactCount" in p
      ) {
        const m = p as { latencyMs: number; stepCount: number; artifactCount: number };
        return {
          latencyMs: m.latencyMs,
          stepCount: m.stepCount,
          artifactCount: m.artifactCount,
        };
      }
    }
    return undefined;
  },

  /**
   * Rebuild a CreRun read model from an initial skeleton + event log. The
   * skeleton carries identity (runId, workflow, startedAt, steps, artifacts);
   * status / metrics / approval come from the events. Used for audit rebuild
   * and for asserting the event log fully determines observable state.
   */
  rebuild(skeleton: CreRun, events: CreRunEvent[]): CreRun {
    const status = this.deriveStatus(events);
    const metrics = this.deriveMetrics(events);
    const paused = events.some((e) => e.type === "run_paused_for_approval");
    return {
      ...skeleton,
      events,
      status: status ?? skeleton.status,
      metrics: metrics ?? skeleton.metrics,
      approvalState: paused ? "pending" : skeleton.approvalState,
      requiresApproval: paused ? true : skeleton.requiresApproval,
    };
  },
};
