export type BoundaryZone = "approved" | "held" | "denied";

/** Fixed visual bands for the piecewise instrument: each decision zone is
 *  readable even when its raw numeric width is tiny. */
export const BOUNDARY_ZONE_BANDS: Record<BoundaryZone, readonly [number, number]> = {
  approved: [0, 30],
  held: [30, 70],
  denied: [70, 100],
} as const;

export interface BoundaryLimits {
  approveLimit: number;
  hardLimit: number;
  maxDisplay: number;
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Normalize incomplete or inverted inputs into a strictly increasing scale.
 *  The caller's policy values are preserved for display and zone resolution;
 *  this only makes the geometry total and monotonic. */
export function normalizeBoundaryLimits(
  approveLimit: number,
  hardLimit: number,
  maxDisplay?: number,
): BoundaryLimits {
  const approve = finitePositive(approveLimit, 1);
  const hard = Math.max(finitePositive(hardLimit, approve * 2), approve + 1);
  const max = Math.max(finitePositive(maxDisplay ?? hard * 1.5, hard * 1.5), hard + 1);
  return { approveLimit: approve, hardLimit: hard, maxDisplay: max };
}

/** Resolve an amount to the policy zone. Boundary ownership follows the
 *  product semantics: below approve is automatic, at/above approve is held,
 *  and only above the hard limit is denied. */
export function resolveBoundaryZone(
  value: number,
  approveLimit: number,
  hardLimit: number,
): BoundaryZone {
  if (value > hardLimit) return "denied";
  if (value >= approveLimit) return "held";
  return "approved";
}

function interpolate(value: number, domain: readonly [number, number], range: readonly [number, number]): number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 <= d0) return r1;
  const ratio = Math.min(1, Math.max(0, (value - d0) / (d1 - d0)));
  return r0 + ratio * (r1 - r0);
}

/** Map an amount to a 0–100 visual position. Each of the three policy zones
 *  owns a fixed visual band ([0–30], [30–70], [70–100]) and interpolation is
 *  linear only inside that band. */
export function boundaryValueToPosition(
  value: number,
  approveLimit: number,
  hardLimit: number,
  maxDisplay?: number,
): number {
  const limits = normalizeBoundaryLimits(approveLimit, hardLimit, maxDisplay);
  const amount = Math.min(Math.max(value, 0), limits.maxDisplay);
  if (amount <= limits.approveLimit) {
    return interpolate(
      amount,
      [0, limits.approveLimit],
      BOUNDARY_ZONE_BANDS.approved,
    );
  }
  if (amount <= limits.hardLimit) {
    return interpolate(
      amount,
      [limits.approveLimit, limits.hardLimit],
      BOUNDARY_ZONE_BANDS.held,
    );
  }
  return interpolate(
    amount,
    [limits.hardLimit, limits.maxDisplay],
    BOUNDARY_ZONE_BANDS.denied,
  );
}

/** Inverse of boundaryValueToPosition for the interactive control. The input
 *  position is 0–100 in the calibrated visual space, so dragging across the
 *  narrow automatic-approval band is as easy as crossing the other bands. */
export function boundaryPositionToValue(
  position: number,
  approveLimit: number,
  hardLimit: number,
  maxDisplay?: number,
): number {
  const limits = normalizeBoundaryLimits(approveLimit, hardLimit, maxDisplay);
  const pos = Math.min(100, Math.max(0, position));
  if (pos <= BOUNDARY_ZONE_BANDS.approved[1]) {
    return interpolate(pos, BOUNDARY_ZONE_BANDS.approved, [0, limits.approveLimit]);
  }
  if (pos <= BOUNDARY_ZONE_BANDS.held[1]) {
    return interpolate(pos, BOUNDARY_ZONE_BANDS.held, [limits.approveLimit, limits.hardLimit]);
  }
  return interpolate(pos, BOUNDARY_ZONE_BANDS.denied, [limits.hardLimit, limits.maxDisplay]);
}
