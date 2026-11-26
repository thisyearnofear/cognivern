"use client";

import { useId } from "react";
import { PlateFrame, PlateSecurityHatch, PLATE_STROKES } from "./plate-frame";

function IsoEnvelope({
  id,
  points,
  flap,
}: {
  id: string;
  points: string;
  flap: string;
}) {
  return (
    <g
      stroke={PLATE_STROKES.structural}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points={points} fill="var(--muted)" fillOpacity="0.4" />
      <polygon points={points} fill={`url(#${id})`} opacity="0.58" />
      <path d={flap} fill="none" />
    </g>
  );
}

/**
 * Empty sealed-bid plate: three blind, isometric bid envelopes arranged around
 * the central shield lock that keeps them sealed until reveal.
 */
export function EmptySealedBidPlate({ className }: { className?: string }) {
  const rawId = useId().replace(/:/g, "");
  const hatchId = `sealed-bid-hatch-${rawId}`;

  return (
    <PlateFrame title="Three sealed bid envelopes around a locked shield" className={className}>
      <defs>
        <PlateSecurityHatch id={hatchId} />
      </defs>

      {/* orbit/conduit guides */}
      <g
        fill="none"
        stroke={PLATE_STROKES.muted}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="3 5"
        opacity="0.72"
      >
        <path d="M76 57C90 38 150 38 164 57" />
        <path d="M82 99c18 18 58 18 76 0" />
      </g>

      <IsoEnvelope
        id={hatchId}
        points="36,57 67,45 94,57 63,70"
        flap="M36 57l27 13 31-13M63 70l-8 15h52l-13-15"
      />
      <IsoEnvelope
        id={hatchId}
        points="146,57 177,45 204,57 173,70"
        flap="M146 57l27 13 31-13M173 70l-8 15h52l-13-15"
      />
      <IsoEnvelope
        id={hatchId}
        points="91,103 120,91 149,103 120,116"
        flap="M91 103l29 13 29-13M120 116l-9 12h42l-9-12"
      />

      {/* central shield lock */}
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M120 46l19 7v18c0 15-8 25-19 30-11-5-19-15-19-30V53l19-7Z"
          fill="var(--muted)"
          fillOpacity="0.38"
        />
        <rect x="111" y="66" width="18" height="15" rx="2.5" />
        <path d="M114 66v-5a6 6 0 0 1 12 0v5" />
        <path d="M120 71v5" />
      </g>
    </PlateFrame>
  );
}
