import { describe, expect, it } from "vitest";
import {
  boundaryPositionToValue,
  boundaryValueToPosition,
  normalizeBoundaryLimits,
  resolveBoundaryZone,
} from "@/lib/boundary-scale";

describe("boundary piecewise mapping", () => {
  it("places zone boundaries at the calibrated visual bands", () => {
    expect(boundaryValueToPosition(0, 100, 3000, 5000)).toBe(0);
    expect(boundaryValueToPosition(100, 100, 3000, 5000)).toBe(30);
    expect(boundaryValueToPosition(3000, 100, 3000, 5000)).toBe(70);
    expect(boundaryValueToPosition(5000, 100, 3000, 5000)).toBe(100);
  });

  it("gives the narrow approved zone readable visual width", () => {
    expect(boundaryValueToPosition(50, 100, 3000, 5000)).toBeCloseTo(15);
    expect(boundaryValueToPosition(1550, 100, 3000, 5000)).toBeCloseTo(50);
    expect(boundaryValueToPosition(4000, 100, 3000, 5000)).toBeCloseTo(85);
  });

  it("inverts positions inside each band", () => {
    expect(boundaryPositionToValue(15, 100, 3000, 5000)).toBeCloseTo(50);
    expect(boundaryPositionToValue(50, 100, 3000, 5000)).toBeCloseTo(1550);
    expect(boundaryPositionToValue(85, 100, 3000, 5000)).toBeCloseTo(4000);
  });

  it("round-trips representative values", () => {
    for (const value of [0, 50, 100, 500, 3000, 4000, 5000]) {
      const position = boundaryValueToPosition(value, 100, 3000, 5000);
      expect(boundaryPositionToValue(position, 100, 3000, 5000)).toBeCloseTo(value);
    }
  });

  it("clamps positions and values to the displayed scale", () => {
    expect(boundaryValueToPosition(-10, 100, 3000, 5000)).toBe(0);
    expect(boundaryValueToPosition(9000, 100, 3000, 5000)).toBe(100);
    expect(boundaryPositionToValue(-1, 100, 3000, 5000)).toBe(0);
    expect(boundaryPositionToValue(101, 100, 3000, 5000)).toBe(5000);
  });
});

describe("zone resolution", () => {
  it("uses product boundary ownership", () => {
    expect(resolveBoundaryZone(99.99, 100, 3000)).toBe("approved");
    expect(resolveBoundaryZone(100, 100, 3000)).toBe("held");
    expect(resolveBoundaryZone(3000, 100, 3000)).toBe("held");
    expect(resolveBoundaryZone(3000.01, 100, 3000)).toBe("denied");
  });
});

describe("limit normalization", () => {
  it("keeps the geometry increasing for incomplete inputs", () => {
    const normalized = normalizeBoundaryLimits(0, 0, 0);
    expect(normalized.approveLimit).toBeGreaterThan(0);
    expect(normalized.hardLimit).toBeGreaterThan(normalized.approveLimit);
    expect(normalized.maxDisplay).toBeGreaterThan(normalized.hardLimit);
  });
});
