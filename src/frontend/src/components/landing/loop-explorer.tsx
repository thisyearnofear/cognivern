"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { EvidenceFlow, type LoopStage } from "@/components/primitives/evidence-flow";
import { MandateReservoir } from "@/components/primitives/mandate-reservoir";
import { BoundaryBar } from "@/components/primitives/boundary-bar";
import { DecisionStamp } from "@/components/primitives/decision-stamp";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion-tokens";
import { Button } from "@/components/ui/button";

/**
 * One caption per stage — the explorer carries the story visually, so
 * copy stays at a single line.
 */
export const LOOP_EXPLORER_STAGES: (LoopStage & { caption: string })[] = [
  {
    key: "fund",
    label: "Fund",
    status: "live",
    caption: "A mandate sets the budget, boundary, and success metric.",
  },
  {
    key: "act",
    label: "Act",
    status: "live",
    caption: "Every action approved, held, or stopped — with a reason.",
  },
  {
    key: "spend",
    label: "Spend",
    status: "live",
    caption: "Every dollar attributed, backed by a receipt.",
  },
  {
    key: "outcome",
    label: "Outcome",
    status: "building",
    caption: "Results recorded and verified where the source allows.",
  },
  {
    key: "allocate",
    label: "Allocate",
    status: "building",
    caption: "Evidence gates the next tranche — advisory, never automatic.",
  },
];

/* ─── Stage preview canvases ──────────────────────────────────
   Compact, honest miniatures of the real product primitives. Sample
   values are labelled as samples. */

function FundPreview() {
  return (
    <div className="p-5">
      <MandateReservoir
        capacity={12000}
        consumed={4600}
        pendingOther={1800}
        proposedDelta={2400}
        softCap={8000}
        label="Ops mandate · USDC"
        showLegend
      />
    </div>
  );
}

function ActPreview() {
  return (
    <div className="relative p-5">
      <div className="pointer-events-none absolute right-4 top-4">
        <DecisionStamp decision="held" />
      </div>
      <p className="text-xs text-muted-foreground">Agent requests $550</p>
      <BoundaryBar
        className="mt-4"
        approveLimit={100}
        hardLimit={3000}
        maxDisplay={5000}
        value={550}
      />
      <p className="mt-3 text-[11px] text-muted-foreground">
        Above the $100 review threshold — held for an operator.
      </p>
    </div>
  );
}

function SpendPreview() {
  return (
    <div className="p-5">
      {/* Compact receipt stub in the notary-receipt language: perforated
          top edge, mono rows, stamped outcome. */}
      <div className="relative mx-auto max-w-sm overflow-hidden rounded-lg border border-border bg-card">
        <div
          aria-hidden
          className="h-2 w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 6px 0px, transparent 3px, var(--border) 3.5px, transparent 4px)",
            backgroundSize: "12px 4px",
            backgroundRepeat: "repeat-x",
          }}
        />
        <div
          className="space-y-1.5 p-4 font-mono text-[11px] tabular-nums text-muted-foreground"
          style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
        >
          <div className="flex justify-between">
            <span>amount</span>
            <span className="text-foreground">$46.20 USDC</span>
          </div>
          <div className="flex justify-between">
            <span>mandate</span>
            <span>ops-q3 · within limit</span>
          </div>
          <div className="flex justify-between">
            <span>policy</span>
            <span>2 checks passed</span>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-border pt-1.5">
            <span>record</span>
            <span className="text-emerald-600 dark:text-emerald-400">approved · on the trail</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
        Sample receipt
      </p>
    </div>
  );
}

function OutcomePreview() {
  const reduceMotion = useReducedMotion();
  // Semicircular confidence gauge: value 42%, threshold tick at 60%.
  const value = 42;
  const threshold = 60;
  const arc = (pct: number) => (pct / 100) * 180;
  const polar = (deg: number, r: number) => {
    const rad = ((180 - deg) * Math.PI) / 180;
    return [50 + r * Math.cos(rad), 50 - r * Math.sin(rad)];
  };
  const [tx, ty] = polar(arc(threshold), 34);
  return (
    <div className="p-5">
      <svg viewBox="0 0 100 58" className="mx-auto w-full max-w-xs" role="img" aria-label="Confidence 42 percent, below the 60 percent threshold">
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
        <motion.path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke="var(--color-amber-500)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="126"
          initial={reduceMotion ? false : { strokeDashoffset: 126 }}
          whileInView={{ strokeDashoffset: 126 - (126 * value) / 100 }}
          viewport={{ once: true }}
          transition={{ duration: MOTION_DURATION.flow, ease: MOTION_EASE.inOut }}
        />
        <line x1={tx} y1={ty - 6} x2={tx} y2={ty + 4} stroke="var(--foreground)" strokeWidth="1.5" />
        <text x="50" y="52" textAnchor="middle" className="fill-foreground font-mono text-[13px] font-bold tabular-nums">
          {value}%
        </text>
      </svg>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        Below the {threshold}% confidence threshold — routed to review.
      </p>
    </div>
  );
}

function AllocatePreview() {
  return (
    <div className="flex items-center justify-center gap-2 p-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-14 w-20 flex-col items-center justify-center rounded-lg border text-[10px] font-medium ${
              i === 0
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-dashed border-muted-foreground/40 text-muted-foreground/60"
            }`}
          >
            <span className="font-mono text-[9px] uppercase tracking-widest">tranche {i + 1}</span>
            <span className="mt-0.5">{i === 0 ? "unlocked" : "gated"}</span>
          </div>
          {i < 2 && (
            <svg viewBox="0 0 20 8" className="h-2 w-5 text-muted-foreground/40" aria-hidden>
              <path d="M0 4 H14 M14 1 L19 4 L14 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

const PREVIEWS: Record<string, () => React.JSX.Element> = {
  fund: FundPreview,
  act: ActPreview,
  spend: SpendPreview,
  outcome: OutcomePreview,
  allocate: AllocatePreview,
};

/**
 * Band 3 — the interactive loop explorer. Replaces the three repetitive
 * card grids (the loop / how it works / jobs to be done) with one
 * clickable rail and a swapping visual canvas.
 */
export function LoopExplorer() {
  const router = useRouter();
  const [active, setActive] = useState("fund");
  const reduceMotion = useReducedMotion();
  const stage = LOOP_EXPLORER_STAGES.find((s) => s.key === active) ?? LOOP_EXPLORER_STAGES[0];
  const Preview = PREVIEWS[active] ?? FundPreview;

  return (
    <section id="the-loop" className="border-t border-border scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6 py-20">
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
            The loop
          </span>
          <h2
            className="text-3xl font-bold text-foreground mt-3"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            From funded mandate to measured outcome
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm">
            Solid stages are live; dashed are building.
          </p>
        </motion.div>

        <div className="overflow-x-auto pb-1">
          <EvidenceFlow
            variant="loop"
            ringId="landing-loop"
            stages={LOOP_EXPLORER_STAGES}
            activeStage={active}
            onStageSelect={setActive}
            className="min-w-[480px]"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.out }}
            >
              <Preview />
            </motion.div>
          </AnimatePresence>
          <div className="border-t border-border bg-muted/40 px-5 py-3 text-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={active}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: MOTION_DURATION.micro }}
                className="text-sm text-muted-foreground"
              >
                {stage.caption}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Button
            variant="default"
            size="lg"
            onClick={() => router.push("/demo/attribution")}
          >
            See a funded mandate <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Sample data, no wallet needed — watch the loop run end to end
          </p>
        </div>
      </div>
    </section>
  );
}
