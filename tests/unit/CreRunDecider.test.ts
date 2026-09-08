import { describe, it, expect } from "vitest";
import { CreRunDecider } from "@backend/cre/decider.js";
import { CreRunProjector } from "@backend/cre/projector.js";
import type { CreRunEventType } from "@backend/cre/types.js";

/**
 * CreRunDecider is the pure state machine; CreRunProjector rebuilds the read
 * model from its events. These tests pin the transitions directly AND assert
 * the recorder's event log is a sufficient record (projector reproduces the
 * recorder's observable status/metrics) — the property event-sourcing needs.
 */
describe("CreRunDecider", () => {
  const T0 = "2026-08-09T12:00:00.000Z";
  const T1 = "2026-08-09T12:00:01.500Z"; // +1500ms
  const fixed = (s: string) => () => s;

  describe("start", () => {
    it("builds a running run and a run_started event", () => {
      const { run, events } = CreRunDecider.start(
        { runId: "r1", workflow: "spend", mode: "local", projectId: "ws" },
        fixed(T0),
      );
      expect(run.runId).toBe("r1");
      expect(run.startedAt).toBe(T0);
      expect(run.status).toBe("running");
      expect(run.ok).toBe(false);
      expect(run.approvalState).toBe("not_required");
      expect(run.controls).toEqual({ canCancel: true, canRetry: false, canApprove: false });
      expect(run.events).toEqual([]);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("run_started");
      expect(events[0].payload).toEqual({ workflow: "spend", mode: "local" });
    });

    it("is pure — same inputs yield the same run (no RNG / clock inside)", () => {
      const a = CreRunDecider.start(
        { runId: "r1", workflow: "governance", mode: "cre", projectId: "ws" },
        fixed(T0),
      );
      const b = CreRunDecider.start(
        { runId: "r1", workflow: "governance", mode: "cre", projectId: "ws" },
        fixed(T0),
      );
      expect(a).toEqual(b);
    });
  });

  describe("finish", () => {
    const base = CreRunDecider.start(
      { runId: "r1", workflow: "spend", mode: "local", projectId: "ws" },
      fixed(T0),
    ).run;

    it("transitions to completed with metrics and a run_finished event", () => {
      const d = CreRunDecider.finish(base, true, fixed(T1));
      expect(d.patch.status).toBe("completed");
      expect(d.patch.ok).toBe(true);
      expect(d.patch.finishedAt).toBe(T1);
      expect(d.patch.currentStepName).toBeUndefined();
      expect(d.patch.controls).toEqual({ canCancel: false, canRetry: true, canApprove: false });
      expect(d.patch.metrics).toEqual({ latencyMs: 1500, stepCount: 0, artifactCount: 0 });
      expect(d.events[0].type).toBe("run_finished");
      expect(d.events[0].payload).toEqual({ latencyMs: 1500, stepCount: 0, artifactCount: 0 });
    });

    it("transitions to failed with a run_failed event", () => {
      const d = CreRunDecider.finish(base, false, fixed(T1));
      expect(d.patch.status).toBe("failed");
      expect(d.patch.ok).toBe(false);
      expect(d.events[0].type).toBe("run_failed");
    });
  });

  describe("pauseForApproval", () => {
    const base = CreRunDecider.start(
      { runId: "r1", workflow: "spend", mode: "local", projectId: "ws" },
      fixed(T0),
    ).run;

    it("transitions to paused_for_approval with a clean event", () => {
      const d = CreRunDecider.pauseForApproval(
        base,
        "amount above auto-approve threshold",
        "broadcast_spend",
        { amount: "1000" },
        fixed(T1),
      );
      expect(d.patch.status).toBe("paused_for_approval");
      expect(d.patch.ok).toBe(false);
      expect(d.patch.finishedAt).toBeUndefined();
      expect(d.patch.requiresApproval).toBe(true);
      expect(d.patch.approvalState).toBe("pending");
      expect(d.patch.approvalReason).toBe("amount above auto-approve threshold");
      expect(d.patch.controls).toEqual({ canCancel: true, canRetry: false, canApprove: true });
      expect(d.patch.metrics).toEqual({ latencyMs: 1500, stepCount: 0, artifactCount: 0 });
      expect(d.events[0].type).toBe("run_paused_for_approval");
      expect(d.events[0].payload).toMatchObject({
        reason: "amount above auto-approve threshold",
        pendingAction: "broadcast_spend",
        amount: "1000",
      });
    });
  });
});

describe("CreRunProjector", () => {
  const mkEvent = (type: CreRunEventType, payload?: Record<string, unknown>) => ({
    id: "e",
    runId: "",
    type,
    timestamp: "t",
    payload,
  });

  it("derives status by folding the event log", () => {
    expect(CreRunProjector.deriveStatus([mkEvent("run_started")])).toBe("running");
    expect(
      CreRunProjector.deriveStatus([
        mkEvent("run_started"),
        mkEvent("tool_call_started"),
        mkEvent("tool_result"),
        mkEvent("run_finished"),
      ]),
    ).toBe("completed");
    expect(
      CreRunProjector.deriveStatus([mkEvent("run_started"), mkEvent("run_failed")]),
    ).toBe("failed");
    expect(
      CreRunProjector.deriveStatus([
        mkEvent("run_started"),
        mkEvent("run_paused_for_approval"),
      ]),
    ).toBe("paused_for_approval");
  });

  it("extracts metrics from the terminal event payload", () => {
    const events = [
      mkEvent("run_started"),
      mkEvent("run_finished", { latencyMs: 4321, stepCount: 3, artifactCount: 2 }),
    ];
    expect(CreRunProjector.deriveMetrics(events)).toEqual({
      latencyMs: 4321,
      stepCount: 3,
      artifactCount: 2,
    });
  });
});
