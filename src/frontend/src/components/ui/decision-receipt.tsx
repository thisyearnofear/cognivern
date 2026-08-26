"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
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

/** A deliberately compact, copyable proof artifact for an operator review. */
export function DecisionReceipt({ decision, subject, summary, reference, evidence, timestamp, reviewPath = "/audit" }: DecisionReceiptProps) {
  const [copied, setCopied] = useState(false);
  const lifecycle = [
    { label: "Request", detail: "Intent received" },
    { label: "Policy", detail: "Boundary evaluated" },
    { label: "Decision", detail: decisionLabel(decision) },
    { label: "Evidence", detail: `${evidence.length} signal${evidence.length === 1 ? "" : "s"}` },
    { label: "Record", detail: "Reference available" },
  ];

  const copyReceipt = async () => {
    const receipt = [
      "Cognivern decision receipt",
      `Outcome: ${decisionLabel(decision)}`,
      `Subject: ${subject}`,
      `Summary: ${summary}`,
      `Evidence: ${evidence.join(" · ")}`,
      `Reference: ${reference}`,
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
          {lifecycle.map((step) => (
            <li key={step.label} className="min-w-0 rounded-lg border bg-muted/20 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
                <span className="truncate">{step.label}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{step.detail}</div>
            </li>
          ))}
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
