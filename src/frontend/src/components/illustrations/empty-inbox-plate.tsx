"use client";

import { PlateFrame, PLATE_STROKES } from "./plate-frame";

/**
 * Inbox-zero plate: a judgement gate beam sitting level, with both trays
 * cleared and the equilibrium point marked in emerald.
 */
export function EmptyInboxPlate({ className }: { className?: string }) {
  return (
    <PlateFrame title="Balanced approval gate with a clear inbox" className={className}>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* pivot and base */}
        <path d="M120 74v28" />
        <path d="M96 108h48M104 102l16-10 16 10" />
        <path d="M89 111h62" opacity="0.65" />

        {/* suspension wires */}
        <path d="M66 62L50 88M66 62l16 26" opacity="0.82" />
        <path d="M174 62l-16 26M174 62l16 26" opacity="0.82" />

        {/* cleared trays */}
        <path d="M36 89h60l-8 14H44l-8-14Z" fill="var(--muted)" fillOpacity="0.36" />
        <path d="M144 89h60l-8 14h-44l-8-14Z" fill="var(--muted)" fillOpacity="0.36" />
        <path d="M45 96h42M153 96h42" opacity="0.5" />

        {/* tray calibration ticks */}
        <path d="M57 108v5M74 108v5M91 108v5M149 108v5M166 108v5M183 108v5" opacity="0.55" />
      </g>

      {/* level beam — focal equilibrium mechanism */}
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M43 62h154" />
        <path d="M112 57l8-8 8 8" opacity="0.75" />
      </g>
      <circle cx="120" cy="62" r="4.2" className="fill-emerald-500" />
      <circle cx="120" cy="62" r="7.5" fill="none" className="stroke-emerald-500" strokeWidth="1.25" opacity="0.42" />
    </PlateFrame>
  );
}
