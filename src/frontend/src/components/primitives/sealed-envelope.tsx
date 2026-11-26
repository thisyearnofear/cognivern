"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import { MOTION_SPRING, MOTION_DURATION } from "@/lib/motion-tokens";

/**
 * `SealedEnvelope` — a single vendor bid as a tactile envelope card with four
 * animated states driven entirely by the `state` prop. The parent resolves
 * the state from real disclosure data (participant responses, replay
 * evidence); this component never decides visibility itself.
 *
 * - `open`     — bid is disclosed to the active party: crisp card, vendor +
 *                tabular-nums amount, open flap, primary accent.
 * - `redacted` — not on this party's ledger: muted security-hatched surface,
 *                closed flap, etched cipher bar instead of the amount,
 *                centered lock seal.
 * - `archived` — losing bid post-reveal: shrunken, dimmed, dashed border,
 *                diagonal ARCHIVED ghost watermark, price absent.
 * - `exposed`  — losing bid readable by the manager (FHE Option B): open flap
 *                with amber warning border + micro-tag.
 *
 * Reduced motion swaps states instantly (static color/hatch/lock still carry
 * the meaning, per the reduced-motion gate).
 */

export type EnvelopeState = "open" | "redacted" | "archived" | "exposed";

interface SealedEnvelopeProps {
  state: EnvelopeState;
  /** Vendor display name — bidder identity is public round metadata even when the amount is sealed. */
  bidder: string;
  /** Quote amount in USD; rendered only in `open`/`exposed` states when present. */
  amountUsd?: number | null;
  /** Optional micro-tag (e.g. "your bid", "winner"). */
  tag?: string;
  className?: string;
}

function EnvelopeFlap({ open }: { open: boolean }) {
  // Top fold: open flap sweeps up behind the card (shallow inverted fold),
  // closed flap drops its tip downward over the body.
  return (
    <motion.svg
      viewBox="0 0 120 26"
      aria-hidden="true"
      focusable="false"
      className="block h-[26px] w-full"
      initial={false}
    >
      <motion.path
        d="M2 2 L60 24 L118 2"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1.5"
        initial={false}
        animate={{ d: open ? "M2 24 L60 2 L118 24" : "M2 2 L60 24 L118 2" }}
        transition={MOTION_SPRING.instrument}
      />
    </motion.svg>
  );
}

export function SealedEnvelope({
  state,
  bidder,
  amountUsd,
  tag,
  className,
}: SealedEnvelopeProps) {
  const reduceMotion = useReducedMotion();
  // useId contains colons, which are unreliable inside SVG url(#…) refs.
  const hatchId = useId().replace(/:/g, "");
  const spring = reduceMotion
    ? { type: "tween" as const, duration: 0 }
    : MOTION_SPRING.instrument;

  const redacted = state === "redacted";
  const archived = state === "archived";
  const exposed = state === "exposed";
  const flapOpen = state === "open" || exposed;
  const showsAmount = (state === "open" || exposed) && amountUsd != null;

  const borderClass = exposed
    ? "border-amber-500/60"
    : archived
      ? "border-dashed border-border"
      : redacted
        ? "border-border"
        : "border-primary/40";

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        scale: archived ? 0.96 : 1,
        opacity: archived ? 0.55 : 1,
      }}
      transition={spring}
      className={`relative overflow-hidden rounded-xl border bg-card ${borderClass} ${className ?? ""}`}
      data-envelope-state={state}
    >
      {/* Security-hatch pattern definition, scoped per card via useId-free constant fill. */}
      {redacted && (
        <svg aria-hidden className="absolute inset-0 h-full w-full">
          <defs>
            <pattern
              id={hatchId}
              width="8"
              height="8"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="var(--muted)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke="var(--border)"
                strokeWidth="2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${hatchId})`} />
        </svg>
      )}

      {/* ARCHIVED ghost watermark. */}
      {archived && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="-rotate-12 select-none text-lg font-bold uppercase tracking-[0.3em] text-muted-foreground/25">
            Archived
          </span>
        </span>
      )}

      <div className="relative">
        <EnvelopeFlap open={flapOpen} />

        <div className="flex min-h-[64px] flex-col justify-center gap-1 px-3 pb-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              {bidder}
            </span>
            {tag ? (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {tag}
              </span>
            ) : null}
          </div>

          {redacted ? (
            <>
              {/* Etched cipher bar — amount unknown to this party. */}
              <div
                aria-label="sealed amount"
                className="mt-1 flex gap-[3px]"
                aria-hidden={false}
              >
                {[10, 14, 8, 12, 16, 9].map((w, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="inline-block h-2.5 rounded-[1px] bg-muted-foreground/35"
                    style={{ width: w }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" />
                Not on party&apos;s ledger
              </div>
            </>
          ) : archived ? (
            <div className="mt-1 text-sm font-semibold tabular-nums text-muted-foreground">
              $ —
            </div>
          ) : (
            <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {showsAmount ? `$${amountUsd.toLocaleString()}` : "$ —"}
            </div>
          )}

          {exposed && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-500">
              Exposed to manager
            </div>
          )}
        </div>

        {/* Centered lock seal on redacted cards. */}
        {redacted && (
          <motion.div
            initial={false}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { ...MOTION_SPRING.stamp, duration: MOTION_DURATION.micro }
            }
            className="absolute right-2 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card"
            aria-hidden
          >
            <Lock className="h-3 w-3 text-muted-foreground" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
