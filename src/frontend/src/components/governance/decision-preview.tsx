"use client";

import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { decisionLabel, resolveDecision, type DecisionOutcome } from "@/lib/decision-language";

export type { DecisionOutcome } from "@/lib/decision-language";

interface DecisionPreviewProps {
  decision: DecisionOutcome;
  reasoning?: string;
  amount?: number | string;
  compact?: boolean;
  showReasoning?: boolean;
  className?: string;
}

const OUTCOME_COPY: Record<DecisionOutcome, {
  label: string;
  blurb: string;
  surface: string;
  iconSurface: string;
  iconClass: string;
}> = {
  approved: {
    label: decisionLabel("approved"),
    blurb: "This action is within the boundary",
    surface: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    iconSurface: "bg-emerald-500/10",
    iconClass: "text-emerald-500",
  },
  held: {
    label: decisionLabel("held"),
    blurb: "This action needs operator judgment before it can execute",
    surface: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    iconSurface: "bg-amber-500/10",
    iconClass: "text-amber-500",
  },
  denied: {
    label: decisionLabel("denied"),
    blurb: "This action is outside the boundary",
    surface: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
    iconSurface: "bg-red-500/10",
    iconClass: "text-red-500",
  },
};

/**
 * The canonical Cognivern decision object. Keep the outcome language stable
 * across the landing demo, dashboard activation, and full governance flow so
 * users learn one model: approved, held, or stopped.
 */
export function DecisionPreview({
  decision,
  reasoning,
  amount,
  compact = false,
  showReasoning = true,
  className = "",
}: DecisionPreviewProps) {
  const resolved = resolveDecision(decision);
  const copy = OUTCOME_COPY[resolved];
  const Icon = resolved === "approved" ? CheckCircle2 : resolved === "held" ? Clock3 : XCircle;

  return (
    <div
      role="status"
      aria-label={`Decision: ${copy.label}`}
      className={`rounded-xl border ${copy.surface} ${compact ? "p-3" : "p-4"} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex shrink-0 items-center justify-center rounded-lg ${copy.iconSurface} ${compact ? "h-8 w-8" : "h-10 w-10"}`}>
          <Icon className={`${copy.iconClass} ${compact ? "h-4 w-4" : "h-5 w-5"}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-semibold ${compact ? "text-sm" : "text-lg"}`}>{copy.label}</div>
          <p className={`${compact ? "text-[11px]" : "text-sm"} text-muted-foreground`}>
            {copy.blurb}
          </p>
          {amount !== undefined && (
            <p className="mt-1 text-xs font-medium text-foreground/80">
              ${typeof amount === "number" ? amount.toLocaleString() : amount}
            </p>
          )}
        </div>
      </div>
      {showReasoning && reasoning && (
        <p className={`mt-3 ${compact ? "text-xs" : "text-sm"} leading-relaxed text-muted-foreground`}>
          {reasoning}
        </p>
      )}
    </div>
  );
}
