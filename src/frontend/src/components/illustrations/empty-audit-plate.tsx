"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_SPRING } from "@/lib/motion-tokens";
import { PlateFrame, PLATE_STROKES } from "./plate-frame";

function GhostChainLink({ x, y }: { x: number; y: number }) {
  return (
    <g
      fill="none"
      stroke={PLATE_STROKES.muted}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="4 4"
      opacity="0.68"
    >
      <rect x={x} y={y} width="30" height="16" rx="8" />
      <path d={`M${x + 8} ${y + 8}h14`} />
    </g>
  );
}

/**
 * Empty audit trail: three ghost evidence links wait upstream while the first
 * real link seats into the shield-shaped ledger socket.
 */
export function EmptyAuditPlate({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <PlateFrame title="Open evidence chain awaiting its first audit link" className={className}>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* shield socket */}
        <path
          d="M181 35h26l10 10v32c0 18-12 29-31 36-19-7-31-18-31-36V45l10-10Z"
          fill="var(--muted)"
          fillOpacity="0.34"
        />
        <path d="M186 62v28c0 9 6 15 16 19" opacity="0.65" />
        <path d="M202 42v22" opacity="0.5" />
        <path d="M172 70h-18" strokeDasharray="3 4" opacity="0.75" />
      </g>

      <GhostChainLink x={29} y={62} />
      <GhostChainLink x={67} y={62} />
      <GhostChainLink x={105} y={62} />

      {/* Link #1 — focal stroke snapping into the socket along the guide rail. */}
      <motion.g
        initial={{ x: reduceMotion ? 0 : -13, opacity: reduceMotion ? 1 : 0.72 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...MOTION_SPRING.instrument, duration: reduceMotion ? 0 : undefined }}
      >
        <g
          fill="none"
          stroke={PLATE_STROKES.primary}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="139" y="62" width="31" height="16" rx="8" fill="var(--muted)" fillOpacity="0.42" />
          <path d="M147 70h15" />
          <path d="M166 66l7 4-7 4" />
        </g>
      </motion.g>

      <g fill={PLATE_STROKES.muted} opacity="0.75">
        <circle cx="44" cy="91" r="1.4" />
        <circle cx="82" cy="91" r="1.4" />
        <circle cx="120" cy="91" r="1.4" />
      </g>
    </PlateFrame>
  );
}
