"use client";

import { useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { trackUxEvent } from "@/lib/ux-events";

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

  const copyReceipt = async () => {
    const receipt = [
      "Cognivern decision receipt",
      `Outcome: ${decision.replaceAll("_", " ")}`,
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
        <div className="flex flex-wrap gap-1.5">
          {evidence.map((item) => <span key={item} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{item}</span>)}
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
