"use client";

import { motion, useReducedMotion } from "motion/react";
import { MOTION_SPRING } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export type DecisionStampDecision = "approved" | "held" | "denied";

const STAMP_STYLE: Record<DecisionStampDecision, { label: string; className: string }> = {
  approved: {
    label: "APPROVED",
    className: "border-emerald-600/70 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  held: {
    label: "HELD",
    className: "border-amber-600/70 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  denied: {
    label: "STOPPED",
    className: "border-red-600/70 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

/** Semantic notary stamp. Reserved spring weight communicates that a
 *  governance decision landed; under reduced motion it renders settled. */
export function DecisionStamp({
  decision,
  className,
}: {
  decision: DecisionStampDecision;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const style = STAMP_STYLE[decision];

  return (
    <motion.div
      key={decision}
      initial={reduceMotion ? false : { opacity: 0, scale: 1.9, rotate: -18 }}
      animate={{ opacity: 1, scale: 1, rotate: -6 }}
      transition={reduceMotion ? { duration: 0 } : MOTION_SPRING.stamp}
      aria-label={`Decision: ${style.label}`}
      className={cn(
        "inline-flex items-center rounded-md border-2 px-2.5 py-1 shadow-sm",
        style.className,
        className,
      )}
    >
      <span className="rounded-sm border border-current px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
        {style.label}
      </span>
    </motion.div>
  );
}
