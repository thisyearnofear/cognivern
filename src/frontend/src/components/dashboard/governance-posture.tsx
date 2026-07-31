"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NormalizedAuditLog } from "@/lib/normalizers";
import { trackUxEvent } from "@/lib/ux-events";

interface GovernancePostureProps {
  logs: NormalizedAuditLog[];
  activeIdentities: number;
  onChainProofCount: number;
}

/** Aggregate-only collaboration artifact; it never exposes spend or identity details. */
export function GovernancePosture({ logs, activeIdentities, onChainProofCount }: GovernancePostureProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const summary = useMemo(() => {
    const blocked = logs.filter((log) => log.decision === "denied").length;
    const held = logs.filter((log) => log.decision === "held").length;
    const approved = logs.filter((log) => log.decision === "approved").length;
    const approvalRate = logs.length ? Math.round((approved / logs.length) * 100) : 0;
    const needsAttention = blocked + held;
    return { blocked, held, approvalRate, needsAttention };
  }, [logs]);

  const posture = summary.needsAttention > 0 ? "Review needed" : "Controls operating normally";
  const evidence = [
    `${logs.length} recorded decision${logs.length === 1 ? "" : "s"}`,
    `${activeIdentities} active identit${activeIdentities === 1 ? "y" : "ies"}`,
    ...(onChainProofCount > 0 ? [`${onChainProofCount} on-chain record${onChainProofCount === 1 ? "" : "s"}`] : []),
  ];

  const copyPosture = async () => {
    const brief = [
      "Cognivern governance posture",
      `Status: ${posture}`,
      `Approval rate: ${summary.approvalRate}%`,
      `Needs review: ${summary.needsAttention}`,
      `Evidence: ${evidence.join(" · ")}`,
      `Review the protected audit trail: ${window.location.origin}/audit`,
    ].join("\n");
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    trackUxEvent("proof_shared", "governance_posture", posture);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="border-t pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="governance-posture"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) trackUxEvent("disclosure_opened", "governance_posture");
        }}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Share governance posture</span>
          <span className="block text-xs text-muted-foreground">A concise, safe summary for a review thread</span>
        </span>
        <span className="text-xs font-medium text-primary">{open ? "Hide" : "Prepare"}</span>
      </button>

      {open && (
        <div id="governance-posture" className="app-surface-card motion-enter mt-3 overflow-hidden">
          <div className="flex items-start gap-3 border-b border-border/70 bg-primary/[0.03] px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold">{posture}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Current aggregate view — no spend, wallet, or policy values included.</p>
            </div>
          </div>
          <div className="space-y-3 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-lg font-semibold">{summary.approvalRate}%</p><p className="text-xs text-muted-foreground">Approval rate</p></div>
              <div><p className="text-lg font-semibold">{summary.needsAttention}</p><p className="text-xs text-muted-foreground">Need review</p></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {evidence.map((item) => <span key={item} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{item}</span>)}
            </div>
            <div className="flex justify-end border-t border-border/70 pt-3">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyPosture()}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy posture"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
