import { describe, expect, it } from "vitest";
import {
  computeReservoirSegments,
  softCapPosition,
} from "@/components/primitives/mandate-reservoir";

describe("computeReservoirSegments", () => {
  it("proportions a simple consumed/pending/remaining stack", () => {
    const s = computeReservoirSegments({
      capacity: 10_000,
      consumed: 6_200,
      pendingOther: 800,
    });
    expect(s.consumedPct).toBeCloseTo(62);
    expect(s.pendingPct).toBeCloseTo(8);
    expect(s.proposedPct).toBe(0);
    expect(s.remainingPct).toBeCloseTo(30);
    expect(s.overflow).toBe(false);
    expect(s.beforeRatio).toBeCloseTo(0.7);
    expect(s.afterRatio).toBeCloseTo(0.7);
  });

  it("stacks the proposed delta after pending and reflects it in afterRatio", () => {
    const s = computeReservoirSegments({
      capacity: 10_000,
      consumed: 5_000,
      pendingOther: 1_000,
      proposedDelta: 2_000,
    });
    expect(s.consumedPct).toBeCloseTo(50);
    expect(s.pendingPct).toBeCloseTo(10);
    expect(s.proposedPct).toBeCloseTo(20);
    expect(s.remainingPct).toBeCloseTo(20);
    expect(s.beforeRatio).toBeCloseTo(0.6);
    expect(s.afterRatio).toBeCloseTo(0.8);
  });

  it("clamps the visual stack at 100% when usage overshoots capacity", () => {
    const s = computeReservoirSegments({
      capacity: 1_000,
      consumed: 900,
      pendingOther: 400,
      proposedDelta: 500,
    });
    const total = s.consumedPct + s.pendingPct + s.proposedPct + s.remainingPct;
    expect(total).toBeCloseTo(100);
    expect(s.remainingPct).toBe(0);
    expect(s.overflow).toBe(true);
  });

  it("handles exact capacity usage with zero remaining", () => {
    const s = computeReservoirSegments({ capacity: 500, consumed: 500 });
    expect(s.consumedPct).toBeCloseTo(100);
    expect(s.remainingPct).toBe(0);
    expect(s.overflow).toBe(false);
  });

  it("collapses to an empty track when capacity is zero", () => {
    const s = computeReservoirSegments({
      capacity: 0,
      consumed: 100,
      pendingOther: 50,
    });
    expect(s.consumedPct).toBe(0);
    expect(s.pendingPct).toBe(0);
    expect(s.remainingPct).toBe(100);
    expect(s.overflow).toBe(true);
  });

  it("treats negative and non-finite inputs as zero", () => {
    const s = computeReservoirSegments({
      capacity: 1_000,
      consumed: -50,
      pendingOther: Number.NaN,
      proposedDelta: Number.POSITIVE_INFINITY,
    });
    expect(s.consumedPct).toBe(0);
    expect(s.pendingPct).toBe(0);
    expect(s.proposedPct).toBe(0);
    expect(s.remainingPct).toBe(100);
    expect(s.overflow).toBe(false);
  });

  it("never produces negative widths for tiny dust amounts", () => {
    const s = computeReservoirSegments({
      capacity: 1_000_000,
      consumed: 1,
      pendingOther: 1,
      proposedDelta: 1,
    });
    expect(s.consumedPct).toBeGreaterThanOrEqual(0);
    expect(s.remainingPct).toBeCloseTo(100, 3);
  });
});

describe("softCapPosition", () => {
  it("positions the tick proportionally inside the track", () => {
    expect(softCapPosition(500, 1_000)).toBeCloseTo(50);
  });

  it("clamps a soft cap beyond capacity at the track end", () => {
    expect(softCapPosition(1_500, 1_000)).toBe(100);
  });

  it("returns null when there is no renderable cap", () => {
    expect(softCapPosition(undefined, 1_000)).toBeNull();
    expect(softCapPosition(100, 0)).toBeNull();
    expect(softCapPosition(Number.NaN, 1_000)).toBeNull();
    expect(softCapPosition(-5, 1_000)).toBeNull();
  });
});
