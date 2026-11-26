"use client";


import { motion, useReducedMotion } from "motion/react";
import { MOTION_SPRING } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export interface ReservoirSegmentInput {
  capacity: number;
  consumed: number;
  pendingOther?: number;
  proposedDelta?: number;
}

export interface ReservoirSegments {
  /** Width percentages (0..100), stacking in order. */
  consumedPct: number;
  pendingPct: number;
  proposedPct: number;
  remainingPct: number;
  /** True when consumed + pending + proposed exceeds capacity. */
  overflow: boolean;
  /** Utilization before applying the proposed delta (0..1+). */
  beforeRatio: number;
  /** Utilization after applying the proposed delta (0..1+). */
  afterRatio: number;
}

function sane(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * Pure reservoir math. Converts absolute amounts into clamped stacking
 * percentages. Capacity <= 0 collapses all widths to zero (the caller decides
 * whether to render at all). Over-capacity usage clamps the visual total at
 * 100% and flags `overflow` — segments never stretch the bar past its track.
 */
export function computeReservoirSegments(input: ReservoirSegmentInput): ReservoirSegments {
  const capacity = sane(input.capacity);
  const consumed = sane(input.consumed);
  const pending = sane(input.pendingOther);
  const proposed = sane(input.proposedDelta);

  if (capacity <= 0) {
    return {
      consumedPct: 0,
      pendingPct: 0,
      proposedPct: 0,
      remainingPct: 100,
      overflow: consumed + pending + proposed > 0,
      beforeRatio: 0,
      afterRatio: 0,
    };
  }

  const beforeRatio = (consumed + pending) / capacity;
  const afterRatio = (consumed + pending + proposed) / capacity;

  // Convert to percentages, then clamp the stack sequentially so the visual
  // never exceeds the track even when usage overshoots capacity.
  let used = 0;
  const clamp = (raw: number) => {
    const pct = (raw / capacity) * 100;
    const fitted = Math.min(pct, Math.max(0, 100 - used));
    used += fitted;
    return fitted;
  };

  const consumedPct = clamp(consumed);
  const pendingPct = clamp(pending);
  const proposedPct = clamp(proposed);
  const remainingPct = Math.max(0, 100 - used);

  return {
    consumedPct,
    pendingPct,
    proposedPct,
    remainingPct,
    overflow: consumed + pending + proposed > capacity,
    beforeRatio,
    afterRatio,
  };
}

/** Clamp a soft-cap position into the bar; returns null when not renderable. */
export function softCapPosition(softCap: number | undefined, capacity: number): number | null {
  if (softCap == null || !Number.isFinite(softCap) || capacity <= 0 || softCap < 0) return null;
  return Math.min(100, (softCap / capacity) * 100);
}

function defaultFormat(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

export interface MandateReservoirProps {
  capacity: number;
  consumed: number;
  pendingOther?: number;
  /** Incremental impact of the pending approval — highlighted pulse segment. */
  proposedDelta?: number;
  /** Optional vertical tick at the soft-cap threshold, with hover readout. */
  softCap?: number;
  /** Leading label, e.g. the asset or program name. */
  label?: string;
  formatValue?: (value: number) => string;
  /** Reserve space for the before→after readout even without a delta. */
  showLegend?: boolean;
  compact?: boolean;
  className?: string;
}

const LEGEND = [
  { key: "consumed", label: "Consumed", swatch: "bg-primary" },
  {
    key: "pending",
    label: "Held",
    swatch:
      "bg-[repeating-linear-gradient(45deg,var(--color-amber-500)_0px,var(--color-amber-500)_1.5px,transparent_1.5px,transparent_4px)] border border-amber-500/40",
  },
  { key: "proposed", label: "This request", swatch: "bg-emerald-500" },
  { key: "remaining", label: "Available", swatch: "bg-muted border border-border" },
] as const;

/**
 * Stacked proportional treasury/mandate bar. Replaces monospace evidence
 * dumps and dense numeric rows with a spatial readout: what is consumed, what
 * other held work reserves, what *this* approval would add, and what remains.
 */
export function MandateReservoir({
  capacity,
  consumed,
  pendingOther = 0,
  proposedDelta = 0,
  softCap,
  label,
  formatValue = defaultFormat,
  showLegend = false,
  compact = false,
  className,
}: MandateReservoirProps) {
  const reduceMotion = useReducedMotion();

  const segments = computeReservoirSegments({ capacity, consumed, pendingOther, proposedDelta });
  const capPos = softCapPosition(softCap, capacity);
  const hasDelta = proposedDelta > 0;
  const exceedsCap =
    capPos != null && softCap != null ? segments.afterRatio * capacity > softCap : segments.overflow;
  const heightClass = compact ? "h-2" : "h-3.5";

  const spring = reduceMotion ? { duration: 0 } : MOTION_SPRING.instrument;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {label && <p className="truncate text-xs font-medium">{label}</p>}
        <p className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {Math.round(segments.beforeRatio * 100)}%
          {hasDelta && (
            <>
              {" "}
              <span aria-hidden>→</span>{" "}
              <span className={cn("font-semibold", exceedsCap ? "text-amber-600" : "text-emerald-600")}>
                {Math.round(segments.afterRatio * 100)}%
              </span>{" "}
              <span className="text-muted-foreground">
                (+{formatValue(proposedDelta)})
              </span>
            </>
          )}
          {!hasDelta && ` of ${formatValue(capacity)}`}
        </p>
      </div>

      <div
        className={cn("relative mt-1.5 flex w-full overflow-visible rounded-full bg-muted", heightClass)}
        role="img"
        aria-label={`Treasury ${Math.round(segments.beforeRatio * 100)}% committed${
          hasDelta ? `, rising to ${Math.round(segments.afterRatio * 100)}% if approved` : ""
        }`}
      >
        <div className="flex h-full w-full overflow-hidden rounded-full">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${segments.consumedPct}%` }}
            transition={spring}
          />
          <motion.div
            className="h-full border-y border-amber-500/30"
            initial={false}
            animate={{ width: `${segments.pendingPct}%` }}
            transition={spring}
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--color-amber-500) 0px, var(--color-amber-500) 1.5px, transparent 1.5px, transparent 4px)",
              backgroundColor: "color-mix(in srgb, var(--color-amber-500) 12%, transparent)",
            }}
          />
          {hasDelta && (
            <motion.div
              className={cn(
                "relative h-full",
                exceedsCap ? "bg-amber-500/90" : "bg-emerald-500/90",
              )}
              initial={false}
              animate={{ width: `${segments.proposedPct}%` }}
              transition={spring}
            >
              {!reduceMotion && (
                <motion.div
                  className={cn(
                    "pointer-events-none absolute inset-0",
                    exceedsCap ? "bg-amber-300" : "bg-emerald-300",
                  )}
                  animate={{ opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          )}
          {/* remaining is the quiet track itself (bg-muted) */}
        </div>

        {capPos != null && (
          <div
            className="group absolute top-[-4px] bottom-[-4px] w-px bg-foreground/60"
            style={{ left: `${capPos}%` }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border bg-popover px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-popover-foreground shadow-sm group-hover:block">
              soft cap {formatValue(softCap ?? 0)}
            </span>
          </div>
        )}
        <span className="sr-only">{`capacity ${formatValue(capacity)}`}</span>
      </div>

      {showLegend && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGEND.filter((entry) => entry.key !== "proposed" || hasDelta).map((entry) => (
            <span key={entry.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn("inline-block h-2 w-2 rounded-[2px]", entry.swatch)} aria-hidden />
              {entry.label}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
