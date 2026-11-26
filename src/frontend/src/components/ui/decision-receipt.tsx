"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecisionStamp, type DecisionStampDecision } from "@/components/primitives/decision-stamp";
import { trackUxEvent } from "@/lib/ux-events";
import { decisionLabel } from "@/lib/decision-language";
import { cn } from "@/lib/utils";

interface DecisionReceiptProps {
  decision: string;
  subject: string;
  summary: string;
  reference: string;
  evidence: string[];
  timestamp?: string;
  reviewPath?: string;
}

/**
 * The lifecycle stages a decision can be in. Only "complete" renders as a
 * green check; "pending" is an amber clock (waiting on the operator or on
 * execution), "blocked" is a red stop (the action was stopped or failed).
 * A held or stopped decision must not look identical to an approved one.
 */
type StepState = "complete" | "pending" | "blocked";

interface LifecycleStep {
  label: string;
  detail: string;
  state: StepState;
}

const STEP_META: Record<
  StepState,
  { icon: typeof CheckCircle2; className: string; dot: string; label: string }
> = {
  complete: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    dot: "border-emerald-500 bg-emerald-500/15 text-emerald-500",
    label: "Complete",
  },
  pending: {
    icon: Clock3,
    className: "text-amber-500",
    dot: "border-amber-500 bg-amber-500/15 text-amber-500",
    label: "Pending",
  },
  blocked: {
    icon: XCircle,
    className: "text-red-500",
    dot: "border-red-500 bg-red-500/15 text-red-500",
    label: "Blocked",
  },
};

/** The decision step is complete when a final outcome was rendered. */
function decisionStepState(decision: string): StepState {
  switch (decision) {
    case "held":
    case "paused_for_approval":
    case "running":
      return "pending";
    case "denied":
    case "failed":
      return "blocked";
    default:
      return "complete";
  }
}

/**
 * The final step of the lifecycle is the only one whose outcome depends on
 * the decision itself. Approved/completed decisions reach a recorded
 * reference; held and paused decisions wait on operator resolution; stopped
 * and failed decisions never complete.
 */
function recordStep(decision: string): { detail: string; state: StepState } {
  switch (decision) {
    case "held":
      return { detail: "Awaiting operator review", state: "pending" };
    case "paused_for_approval":
      return { detail: "Awaiting operator approval", state: "pending" };
    case "running":
      return { detail: "Execution in progress", state: "pending" };
    case "denied":
      return { detail: "Action stopped — not executed", state: "blocked" };
    case "failed":
      return { detail: "Execution failed — review trace", state: "blocked" };
    default:
      return { detail: "Reference recorded", state: "complete" };
  }
}

/** Map arbitrary decision/run statuses onto the three stamp verdicts. */
function stampDecision(decision: string): DecisionStampDecision {
  switch (decision) {
    case "held":
    case "paused_for_approval":
    case "running":
      return "held";
    case "denied":
    case "failed":
      return "denied";
    default:
      return "approved";
  }
}

/**
 * Notched ticket-stub seam — a row of punched half-circles along a horizontal
 * edge. Pure CSS radial-gradient mask: zero images, crisp in both themes.
 */
function PerforatedSeam({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-2 w-full",
        position === "top" ? "rounded-t-xl" : "rounded-b-xl rotate-180",
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 6px 0px, transparent 4px, var(--border) 4.5px, transparent 5px)",
        backgroundSize: "16px 8px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "0 0",
        opacity: 0.9,
      }}
    />
  );
}

/** A deliberately compact, copyable proof artifact for an operator review,
 *  styled as a tamper-evident notary receipt rather than a settings card. */
export function DecisionReceipt({
  decision,
  subject,
  summary,
  reference,
  evidence,
  timestamp,
  reviewPath = "/audit",
}: DecisionReceiptProps) {
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();
  const record = recordStep(decision);
  const lifecycle: LifecycleStep[] = [
    { label: "Request", detail: "Intent received", state: "complete" },
    { label: "Policy", detail: "Boundary evaluated", state: "complete" },
    {
      label: "Decision",
      detail: decisionLabel(decision),
      state: decisionStepState(decision),
    },
    {
      label: "Evidence",
      detail: `${evidence.length} signal${evidence.length === 1 ? "" : "s"}`,
      state: "complete",
    },
    { label: "Record", detail: record.detail, state: record.state },
  ];

  const copyReceipt = async () => {
    const receipt = [
      "Cognivern decision receipt",
      `Outcome: ${decisionLabel(decision)}`,
      `Subject: ${subject}`,
      `Summary: ${summary}`,
      `Evidence: ${evidence.join(" · ")}`,
      `Reference: ${reference}`,
      ...(record.state !== "complete" ? [`Status: ${record.detail}`] : []),
      ...(timestamp ? [`Recorded: ${timestamp}`] : []),
      `Review in Cognivern: ${window.location.origin}${reviewPath}`,
    ].join("\n");
    await navigator.clipboard.writeText(receipt);
    setCopied(true);
    trackUxEvent("proof_shared", "decision_receipt", decision);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="app-surface-card motion-enter overflow-hidden">
      {/* Perforated proof seam — the tactile tell that this is a receipt. */}
      <PerforatedSeam position="top" />
      <div className="flex items-start justify-between gap-3 border-b border-dashed border-border px-4 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></span>
          <div>
            <p className="text-xs font-semibold">Decision receipt</p>
            <p className="text-[11px] text-muted-foreground">Shareable review summary</p>
          </div>
        </div>
        {/* Embossed notary stamp, top-right. */}
        <DecisionStamp decision={stampDecision(decision)} className="shadow" />
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="font-medium">{subject}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
        {/* Horizontal 5-node connected wire — the lifecycle reads in one
            eye-sweep instead of five boxed tiles. */}
        <ol
          aria-label="Decision lifecycle"
          className="flex items-start"
        >
          {lifecycle.map((step, index) => {
            const meta = STEP_META[step.state];
            const Icon = meta.icon;
            return (
              <li key={step.label} className="flex min-w-0 flex-1 items-start last:flex-none">
                <div className="flex w-16 min-w-0 flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border",
                      meta.dot,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">{meta.label}</span>
                  </span>
                  <span className="text-[10px] font-medium leading-tight">{step.label}</span>
                  <span className="max-w-full truncate text-center text-[9.5px] leading-tight text-muted-foreground">
                    {step.detail}
                  </span>
                </div>
                {index < lifecycle.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-0.5 mt-[13px] h-px min-w-2 flex-1",
                      step.state === "complete" ? "bg-emerald-500/50" : "bg-border",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Evidence recorded</p>
          <div className="flex flex-wrap gap-1.5">
            {evidence.length > 0 ? evidence.map((item) => <span key={item} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{item}</span>) : <span className="text-[11px] text-muted-foreground">No supporting evidence attached.</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-3">
          <code className="max-w-[15rem] truncate font-mono text-[11px] text-muted-foreground">{reference}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyReceipt()}>
            {/* Morphing copy confirmation — icon crossfades copy → check. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "copied" : "copy"}
                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduceMotion ? undefined : { scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-center gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy for review"}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>
      <PerforatedSeam position="bottom" />
    </aside>
  );
}
