"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import {
  boundaryPositionToValue,
  boundaryValueToPosition,
  normalizeBoundaryLimits,
  resolveBoundaryZone,
  type BoundaryZone,
} from "@/lib/boundary-scale";
import { MOTION_SPRING } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export interface BoundaryBarProps {
  approveLimit: number;
  hardLimit: number;
  maxDisplay?: number;
  value?: number;              // current spend or marker position
  unit?: string;               // default "$"
  interactive?: boolean;
  onChange?: (value: number) => void;
  onZoneChange?: (zone: BoundaryZone) => void;
  confidential?: boolean;      // renders frosted/hatched FHE lock overlay on thresholds
  compact?: boolean;           // slim bar for policy cards & inline rows
  className?: string;
}

const ZONE_FILL: Record<BoundaryZone, string> = {
  approved: "bg-emerald-500/75",
  held: "bg-amber-500/75",
  denied: "bg-red-500/75",
};

const ZONE_TEXT: Record<BoundaryZone, string> = {
  approved: "approved zone",
  held: "held zone",
  denied: "denied zone",
};

function formatAmount(value: number, unit: string): string {
  const formatted = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit === "$" ? `$${formatted}` : `${formatted} ${unit}`;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function ThresholdLabel({
  value,
  unit,
  confidential,
}: {
  value: number;
  unit: string;
  confidential?: boolean;
}) {
  const rawId = useId().replace(/:/g, "");
  if (!confidential) {
    return <span className="tabular-nums">{formatAmount(value, unit)}</span>;
  }
  return (
    <span className="relative inline-flex items-center gap-1 overflow-hidden rounded border border-amber-400/50 bg-amber-100/70 px-1 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
      <Lock className="h-2.5 w-2.5" aria-hidden />
      <span className="tabular-nums tracking-wider" aria-label="protected threshold">
        ████
      </span>
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-35">
        <defs>
          <pattern id={`boundary-hatch-${rawId}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#boundary-hatch-${rawId})`} />
      </svg>
    </span>
  );
}

/**
 * Calibrated three-zone policy instrument. The visual scale is piecewise:
 * approved/held/denied own fixed bands so narrow automatic-approval ranges
 * remain explorable. In interactive mode the invisible range input operates
 * in that calibrated position space; the pin itself is spring-driven.
 */
export function BoundaryBar({
  approveLimit,
  hardLimit,
  maxDisplay,
  value,
  unit = "$",
  interactive = false,
  onChange,
  onZoneChange,
  confidential = false,
  compact = false,
  className,
}: BoundaryBarProps) {
  const limits = normalizeBoundaryLimits(approveLimit, hardLimit, maxDisplay);
  const markerValue = value ?? 0;
  const position = boundaryValueToPosition(
    markerValue,
    limits.approveLimit,
    limits.hardLimit,
    limits.maxDisplay,
  );
  const zone = resolveBoundaryZone(markerValue, limits.approveLimit, limits.hardLimit);
  const reduceMotion = useReducedMotion();
  const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>();
  const previousZoneRef = useRef(zone);
  const pulseControls = useAnimationControls();

  useEffect(() => {
    if (previousZoneRef.current === zone) return;
    previousZoneRef.current = zone;
    onZoneChange?.(zone);
    if (!reduceMotion) {
      void pulseControls.start({
        opacity: [0.7, 0],
        scale: [0.8, 2.2],
        transition: { duration: 0.45 },
      });
    }
  }, [zone, onZoneChange, reduceMotion, pulseControls]);

  const heightClass = compact ? "h-2" : "h-4";
  const pinSize = compact ? "h-3 w-1.5" : "h-6 w-2";
  const pinX = Math.max(0, trackWidth - 8) * (position / 100);
  const sliderPosition = Math.round(position * 10);
  // While dragging or using arrow keys, keep the native control in calibrated
  // position space even when the emitted currency amount rounds to the same
  // dollar. Without this draft state the controlled input would snap back and
  // fine keyboard steps inside the narrow automatic-approval band could stall.
  const [draftPosition, setDraftPosition] = useState<number | null>(null);

  const pin = value !== undefined && (
    <motion.div
      aria-hidden
      initial={false}
      animate={{ x: pinX }}
      transition={reduceMotion ? { duration: 0 } : MOTION_SPRING.instrument}
      className="absolute left-0 top-1/2 z-10"
    >
      <div
        className={cn(
          "relative -translate-y-1/2 rounded-full border border-background bg-foreground shadow-md",
          pinSize,
        )}
      >
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={pulseControls}
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-primary"
        />
      </div>
    </motion.div>
  );

  return (
    <div className={cn("min-w-0", compact ? "space-y-0" : "space-y-1.5", className)}>
      {!compact && (
        <div className="relative h-4 text-[11px] text-muted-foreground">
          <span className="absolute left-0 tabular-nums">{formatAmount(0, unit)}</span>
          <span className="absolute left-[30%] -translate-x-1/2">
            <ThresholdLabel value={limits.approveLimit} unit={unit} confidential={confidential} />
          </span>
          <span className="absolute left-[70%] -translate-x-1/2">
            <ThresholdLabel value={limits.hardLimit} unit={unit} confidential={confidential} />
          </span>
          <span className="absolute right-0 tabular-nums">{formatAmount(limits.maxDisplay, unit)}</span>
        </div>
      )}

      <div className="relative rounded-full has-focus-visible:ring-2 has-focus-visible:ring-ring">
        <div
          ref={trackRef}
          className={cn(
            "relative rounded-full border border-border bg-muted",
            heightClass,
          )}
          aria-hidden
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className={cn("absolute inset-y-0 left-0 w-[30%]", ZONE_FILL.approved)} />
            <div className={cn("absolute inset-y-0 left-[30%] w-[40%]", ZONE_FILL.held)} />
            <div className={cn("absolute inset-y-0 left-[70%] w-[30%]", ZONE_FILL.denied)} />
            {[0, 30, 70, 100].map((tick) => (
              <span
                key={tick}
                className={cn(
                  "absolute top-0 h-full w-px bg-background/90",
                  tick === 0 && "left-0",
                  tick === 30 && "left-[30%]",
                  tick === 70 && "left-[70%]",
                  tick === 100 && "right-0",
                )}
              />
            ))}
          </div>
          {confidential && [30, 70].map((tick) => (
            <span
              key={tick}
              className={cn(
                "absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/70 bg-amber-100/90 text-amber-700 shadow-sm dark:bg-amber-950/90 dark:text-amber-300",
                compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
                tick === 30 ? "left-[30%]" : "left-[70%]",
              )}
              title="Protected threshold"
            >
              <Lock className={compact ? "h-1.5 w-1.5" : "h-2 w-2"} aria-hidden />
            </span>
          ))}
          {pin}
        </div>

        {interactive && value !== undefined && (
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={draftPosition ?? sliderPosition}
            onChange={(event) => {
              const nextPosition = Number(event.target.value) / 10;
              setDraftPosition(nextPosition);
              const nextValue = boundaryPositionToValue(
                nextPosition,
                limits.approveLimit,
                limits.hardLimit,
                limits.maxDisplay,
              );
              onChange?.(Math.max(0, Math.round(nextValue)));
            }}
            onBlur={() => setDraftPosition(null)}
            aria-label="Requested amount on policy boundary"
            aria-valuetext={`${formatAmount(markerValue, unit)}, ${ZONE_TEXT[zone]}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none"
          />
        )}
      </div>

      {!compact && (
        <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="text-emerald-700 dark:text-emerald-300">Auto</span>
          <span className="text-amber-700 dark:text-amber-300">Hold</span>
          <span className="text-red-700 dark:text-red-300">Stop</span>
        </div>
      )}
    </div>
  );
}
