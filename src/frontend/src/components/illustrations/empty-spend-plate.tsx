"use client";

import { PlateFrame, PLATE_STROKES } from "./plate-frame";

/**
 * Empty governed-spend plate: an unfunded mandate reservoir connected by a
 * dotted settlement conduit to the agent node that will draw against it.
 */
export function EmptySpendPlate({ className }: { className?: string }) {
  return (
    <PlateFrame title="Unfunded mandate reservoir connected to an agent node" className={className}>
      {/* reservoir vessel */}
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M52 42v58c0 10 19 18 43 18s43-8 43-18V42" fill="var(--muted)" fillOpacity="0.35" />
        <ellipse cx="95" cy="42" rx="43" ry="14" fill="var(--muted)" fillOpacity="0.42" />
        <ellipse cx="95" cy="42" rx="28" ry="8" opacity="0.58" />
        <path d="M52 72c12 7 74 7 86 0M52 96c12 7 74 7 86 0" opacity="0.52" />
        <path d="M64 52v45M126 52v45" opacity="0.48" />
      </g>

      {/* unfilled capacity calibration */}
      <g
        stroke={PLATE_STROKES.muted}
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M41 55h-8M41 70h-8M41 85h-8M41 100h-8" />
        <path d="M33 55v45" opacity="0.55" />
      </g>

      {/* dotted conduit to the agent node — focal because funding has not crossed it yet */}
      <path
        d="M138 74h24c10 0 15 4 19 10"
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 6"
      />
      <path
        d="M176 78l8 8-8 8"
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* agent node */}
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M192 65l18 10v20l-18 10-18-10V75l18-10Z" fill="var(--muted)" fillOpacity="0.35" />
        <circle cx="192" cy="85" r="8" />
        <path d="M192 77v-8M202 90l7 4M182 90l-7 4" opacity="0.65" />
      </g>
      <circle cx="192" cy="85" r="3" fill="none" stroke={PLATE_STROKES.primary} strokeWidth="1.75" />
    </PlateFrame>
  );
}
