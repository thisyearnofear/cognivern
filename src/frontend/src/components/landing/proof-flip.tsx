"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { DecisionStamp } from "@/components/primitives/decision-stamp";
import type { DecisionStampDecision } from "@/components/primitives/decision-stamp";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion-tokens";

/* ─── Live proof stats ─────────────────────────────────────────
   The diligence report is the strongest checkable artifact on the
   site — real purchased evidence, public receipts, three model
   vendors. The band under the hero pulls its numbers from the same
   static JSON /verify renders, so they stay live when the report
   regenerates; the fallback constants match the published run. */

type DiligenceReportPeek = {
  summary?: {
    perModel?: { label?: string; decisionsChanged?: number }[];
    run?: { escalations?: number };
  };
  cases?: {
    supplier?: { name?: string };
    evidence?: { steps?: { evidenceHash?: string }[] };
    perModel?: {
      label?: string;
      alone?: { decision?: string | null };
      governed?: { finalDecision?: string | null };
    }[];
  }[];
};

const PROOF_FALLBACK = {
  changed: 5,
  vendors: 3,
  escalated: 3,
  cell: {
    caseIndex: 3,
    supplier: "Viktor Anatolyevich Bout",
    model: "qwen",
    alone: "reject",
    governed: "hold",
    evidenceHash: null as string | null,
  },
};

export function useDiligenceProof() {
  const [stats, setStats] = useState(PROOF_FALLBACK);
  useEffect(() => {
    let cancelled = false;
    fetch("/evidence/diligence/supplier-diligence.json")
      .then((r) => (r.ok ? (r.json() as Promise<DiligenceReportPeek>) : Promise.reject(r.status)))
      .then((report) => {
        if (cancelled) return;
        const cases = report.cases ?? [];
        let cell = PROOF_FALLBACK.cell;
        for (let ci = 0; ci < cases.length; ci++) {
          const pm = (cases[ci].perModel ?? []).find(
            (m) =>
              m.alone?.decision &&
              m.governed?.finalDecision &&
              m.alone.decision !== m.governed.finalDecision,
          );
          if (pm) {
            cell = {
              caseIndex: ci,
              supplier: cases[ci].supplier?.name ?? "supplier",
              model: pm.label ?? "model",
              alone: pm.alone!.decision!,
              governed: pm.governed!.finalDecision!,
              evidenceHash: cases[ci].evidence?.steps?.[0]?.evidenceHash ?? null,
            };
            break;
          }
        }
        const perModel = report.summary?.perModel ?? [];
        setStats({
          changed:
            perModel.reduce((s, m) => s + (m.decisionsChanged ?? 0), 0) ||
            PROOF_FALLBACK.changed,
          vendors: perModel.length || PROOF_FALLBACK.vendors,
          escalated: report.summary?.run?.escalations ?? PROOF_FALLBACK.escalated,
          cell,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

/** The diligence report speaks in `proceed` / `hold` / `reject`; the
 *  notary stamp speaks in the app's three decision outcomes. */
export function proofDecisionToStamp(decision: string): DecisionStampDecision {
  if (decision === "hold") return "held";
  if (decision === "reject") return "denied";
  return "approved";
}

const PROOF_CHIP: Record<string, string> = {
  proceed:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  hold: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  reject: "bg-destructive/10 text-destructive border-destructive/30",
};

function ProofDecisionChip({ decision }: { decision: string }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-px text-[10px] font-semibold leading-4 ${
        PROOF_CHIP[decision] ?? "border-border bg-muted/40 text-muted-foreground"
      }`}
    >
      {decision}
    </span>
  );
}

/**
 * Band 2 — Proof, not promise. A side-by-side visual decision flip:
 * the model alone vs the same model behind specialist evidence and
 * enforced policy, pulled live from the public diligence report.
 */
export function ProofFlip() {
  const proof = useDiligenceProof();
  const reduceMotion = useReducedMotion();
  const stamp = proofDecisionToStamp(proof.cell.governed);
  const hash = proof.cell.evidenceHash;
  const shortHash = hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : null;

  return (
    <section id="proof" className="border-t border-border bg-muted/30 scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span
            className="text-xs font-semibold text-primary uppercase tracking-widest"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Proof, not promise
          </span>
          <h2
            className="text-3xl font-bold text-foreground mt-3"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Watch governance change a real decision
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm">
            {proof.changed} decisions changed · {proof.vendors} model vendors ·{" "}
            {proof.escalated} escalated to a human.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="grid md:grid-cols-[1fr_auto_1fr]">
            {/* Left: model alone */}
            <div className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Model alone
              </p>
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="truncate text-sm font-medium">{proof.cell.supplier}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  supplier payment · {proof.cell.model}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <ProofDecisionChip decision={proof.cell.alone} />
                  <span className="text-[11px] text-muted-foreground">
                    unassisted answer
                  </span>
                </div>
              </div>
            </div>

            {/* Center gate arrow */}
            <div className="flex md:flex-col items-center justify-center gap-1 px-2 py-4 md:py-0">
              <svg
                viewBox="0 0 64 24"
                className="h-6 w-16 rotate-90 md:rotate-0 text-primary"
                aria-hidden="true"
              >
                <motion.path
                  d="M2 12 H52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: MOTION_DURATION.flow, ease: MOTION_EASE.inOut }}
                />
                <path
                  d="M52 6 L62 12 L52 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <p className="text-center text-[10px] leading-tight text-muted-foreground md:max-w-[110px]">
                + specialist evidence + policy
              </p>
            </div>

            {/* Right: governed */}
            <div className="border-t md:border-t-0 md:border-l border-border p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Governed
              </p>
              <div className="relative mt-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-4">
                <div className="pointer-events-none absolute right-3 top-3">
                  <DecisionStamp decision={stamp} />
                </div>
                <p className="truncate text-sm font-medium">{proof.cell.supplier}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  same supplier, same model
                </p>
                <div className="mt-8 border-t border-dashed border-border pt-2.5">
                  <p
                    className="font-mono text-[10px] tabular-nums text-muted-foreground"
                    style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
                  >
                    {shortHash ? `evidence ${shortHash}` : "receipt-backed evidence"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <ProofDecisionChip decision={proof.cell.governed} />
                    final decision, on the record
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center border-t border-border bg-muted/40 px-5 py-3">
            <Link
              href={`/verify?report=supplier-diligence&case=${proof.cell.caseIndex}&model=${proof.cell.model}`}
              className="inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Inspect the full replay <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
