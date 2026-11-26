// Proposed: src/frontend/src/lib/motion-tokens.ts
export const MOTION_EASE = {
  /** Crisp deceleration for utility chrome (accordions, drawers, reveals). Never overshoots. */
  out: [0.22, 1, 0.36, 1] as const,
  /** Symmetric curve for SVG path travel and continuous scrub interpolation. */
  inOut: [0.4, 0, 0.2, 1] as const,
} as const;

export const MOTION_SPRING = {
  /** Shared-element pills (layoutId), segmented controls, filter tabs. Zero bounce. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } as const,
  /** BoundaryBar pin glide, MandateReservoir fill shifts, envelope sliding. Crisp settle. */
  instrument: { type: "spring", stiffness: 360, damping: 30, mass: 0.85 } as const,
  /** Semantic Decision Stamp & Wax/Shield Seal ONLY. Controlled physical weight. */
  stamp: { type: "spring", stiffness: 460, damping: 24, mass: 0.75 } as const,
} as const;

export const MOTION_DURATION = {
  micro: 0.12,     // hover/press/route settle
  fast: 0.18,      // tab swap, tooltip, chip toggle
  medium: 0.28,    // card expand, envelope redact/unseal
  flow: 0.55,      // SVG packet traversal between two gate nodes
} as const;
