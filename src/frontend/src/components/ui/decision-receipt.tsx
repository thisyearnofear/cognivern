"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { trackUxEvent } from "@/lib/ux-events";
import { decisionLabel } from "@/lib/decision-language";

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
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  complete: { icon: CheckCircle2, className: "text-emerald-500", label: "Complete" },
  pending: { icon: Clock3, className: "text-amber-500", label: "Pending" },
  blocked: { icon: XCircle, className: "text-red-500", label: "Blocked" },
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

/** A deliberately compact, copyable proof artifact for an operator review. */
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
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></span>
          <div>
            <p className="text-xs font-semibold">Decision receipt</p>
            <p className="text-[11px] text-muted-foreground">Shareable review summary</p>
          </div>
        </div>
        <StatusBadge status={decision} className="text-[11px]" />
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="font-medium">{subject}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
        <ol
          aria-label="Decision lifecycle"
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          {lifecycle.map((step) => {
            const meta = STEP_META[step.state];
            const Icon = meta.icon;
            return (
              <li key={step.label} className="min-w-0 rounded-lg border bg-muted/20 px-2.5 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <Icon className={`h-3 w-3 shrink-0 ${meta.className}`} aria-hidden="true" />
                  <span className="sr-only">{meta.label}</span>
                  <span className="truncate">{step.label}</span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{step.detail}</div>
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
        <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <code className="max-w-[15rem] truncate text-[11px] text-muted-foreground">{reference}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyReceipt()}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy for review"}
          </Button>
        </div>
      </div>
    </aside>
  );
}