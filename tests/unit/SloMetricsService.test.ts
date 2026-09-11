import { describe, expect, it } from "vitest";
import { SloMetricsService } from "@backend/services/SloMetricsService.js";

describe("SloMetricsService operations", () => {
  it("exposes p50/p95/p99 and claim thresholds for policy_eval and ledger_verify", () => {
    const svc = new SloMetricsService({ windowMs: 60_000 });
    for (const ms of [12, 18, 25, 40, 90]) {
      svc.recordOperation("policy_eval", ms, true);
    }
    for (const ms of [30, 45, 80, 120]) {
      svc.recordOperation("ledger_verify", ms, true);
    }

    const snap = svc.snapshot();
    expect(snap.operations.policy_eval).toMatchObject({
      count: 5,
      claimP95Ms: 100,
      claimMet: true,
    });
    expect(snap.operations.policy_eval.p50Ms).toBeGreaterThan(0);
    expect(snap.operations.policy_eval.p99Ms).toBeGreaterThanOrEqual(
      snap.operations.policy_eval.p95Ms,
    );
    expect(snap.operations.ledger_verify).toMatchObject({
      count: 4,
      claimP95Ms: 500,
      claimMet: true,
    });
  });

  it("marks claimMet false when p95 exceeds the product claim", () => {
    const svc = new SloMetricsService({ windowMs: 60_000 });
    for (let i = 0; i < 20; i++) {
      svc.recordOperation("policy_eval", 150, true);
    }
    expect(svc.snapshot().operations.policy_eval.claimMet).toBe(false);
  });
});
