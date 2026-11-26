"use client";

import { PlateFrame, PLATE_STROKES } from "./plate-frame";

/**
 * Empty policy plate: an open calibrated threshold rail with guard brackets
 * still floating unpinned above it.
 */
export function EmptyPolicyPlate({ className }: { className?: string }) {
  return (
    <PlateFrame title="Open policy threshold rail awaiting guard brackets" className={className}>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ruler bed */}
        <path d="M31 83h178" />
        <path d="M31 83v18h178V83" fill="var(--muted)" fillOpacity="0.32" />
        <path d="M40 83v8M52 83v5M64 83v8M76 83v5M88 83v8M100 83v5M112 83v8M124 83v5M136 83v8M148 83v5M160 83v8M172 83v5M184 83v8M196 83v5" />
        <path d="M31 101h178" opacity="0.55" />
      </g>

      {/* empty pin sockets on the rail */}
      <g
        fill="none"
        stroke={PLATE_STROKES.muted}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="3 4"
        opacity="0.8"
      >
        <path d="M75 72v11" />
        <path d="M121 72v11" />
        <path d="M168 72v11" />
      </g>

      {/* floating unpinned guard brackets */}
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M49 52v-13h18" opacity="0.8" />
        <path d="M49 52h14" opacity="0.8" />
        <path d="M164 39h18v13" opacity="0.8" />
        <path d="M168 52h14" opacity="0.8" />
        <path d="M94 30h52v20H94z" fill="var(--muted)" fillOpacity="0.32" strokeDasharray="4 4" />
      </g>

      {/* first threshold bracket — focal, hovering before it is pinned */}
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M107 55V40h26v15" />
        <path d="M120 40v-8" />
        <path d="M114 32h12" />
        <path d="M120 58v8" strokeDasharray="2 4" opacity="0.72" />
      </g>
      <circle cx="120" cy="83" r="3.5" fill="none" stroke={PLATE_STROKES.primary} strokeWidth="1.75" />
    </PlateFrame>
  );
}
