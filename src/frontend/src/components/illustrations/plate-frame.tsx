"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION_EASE } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export const PLATE_STROKES = {
  structural: "var(--border)",
  muted: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
  primary: "var(--primary)",
} as const;

const FRAME_PATH = "M18 10 H222 V130 H18 Z";

export interface PlateFrameProps {
  children: ReactNode;
  title: string;
  className?: string;
  /** Draw the registration border once on mount. Content itself stays still. */
  drawIn?: boolean;
}

/**
 * Shared blueprint canvas for architectural empty-state plates. The canvas is
 * intentionally transparent so the same inline SVG sits on `.app-surface`,
 * cards, and dashed empty-state panels in either theme.
 */
export function PlateFrame({
  children,
  title,
  className,
  drawIn = true,
}: PlateFrameProps) {
  const reduceMotion = useReducedMotion();
  const animateDraw = drawIn && !reduceMotion;

  return (
    <svg
      viewBox="0 0 240 140"
      role="img"
      aria-label={title}
      focusable="false"
      className={cn("block h-auto w-full max-w-[320px]", className)}
    >
      <title>{title}</title>
      <g>{children}</g>

      {/* Blueprint registration plate. Faint, static corner ticks plus a
          one-shot perimeter draw-in; nothing loops or continuously repaints. */}
      <motion.path
        d={FRAME_PATH}
        fill="none"
        stroke={PLATE_STROKES.muted}
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.42"
        initial={{ pathLength: animateDraw ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: MOTION_EASE.inOut }}
      />

      <g
        stroke={PLATE_STROKES.muted}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.55"
      >
        <path d="M10 18h8M18 10v8" />
        <path d="M230 18h-8M222 10v8" />
        <path d="M10 122h8M18 130v-8" />
        <path d="M230 122h-8M222 130v-8" />
        <path d="M120 8v5M120 127v5M10 70h5M225 70h5" opacity="0.45" />
      </g>
    </svg>
  );
}

/** Diagonal security hatch for sealed, escrowed, or withheld surfaces. */
export function PlateSecurityHatch({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      width="4"
      height="4"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="4"
        stroke="var(--muted-foreground)"
        strokeWidth="1"
        opacity="0.42"
      />
    </pattern>
  );
}
