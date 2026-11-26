"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Inbox,
  Zap,
  Bot,
  Link2,
  Landmark,
  Receipt,
} from "lucide-react";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import type { FheStep } from "@/hooks/use-fhe-progress";

/* ─── Shared types ──────────────────────────────────────────── */

export type GateOutcome = "approved" | "held" | "denied";

/**
 * The honest phases a governed evaluation can visually occupy:
 *  - idle:    nothing submitted yet (gate present, rails quiet)
 *  - travel:  intent packet is moving toward the gate (encryption/submission)
 *  - evaluate: the gate is actively evaluating (FHE prover running when `fhe`)
 *  - decided: a terminal outcome exists — exactly one branch illuminates
 */
export type GatePhase = "idle" | "travel" | "evaluate" | "decided";

/**
 * Maps real FHE SSE step states onto gate visuals without inventing progress:
 *  - step 0 (load policy)      → idle gate, subscript carries the label
 *  - step 1 (encrypt params)   → packet travel toward the gate
 *  - step 2 (submit on Fhenix) → gate actively evaluating (amber lock ring)
 *  - step 3 (record audit)     → still evaluating visually; the subscript
 *    carries the label because no branch outcome exists yet.
 * Returns the active step's label as the subscript for steps that have no
 * visual analog on the schematic.
 */
export function gatePhaseFromFheSteps(steps: FheStep[]): {
  phase: GatePhase;
  subscript: string | null;
} {
  const activeIdx = steps.findIndex((s) => s.status === "active");
  if (activeIdx === -1) return { phase: "idle", subscript: null };
  const label = steps[activeIdx]?.label ?? null;
  if (activeIdx <= 0) return { phase: "idle", subscript: label };
  if (activeIdx === 1) return { phase: "travel", subscript: label };
  return { phase: "evaluate", subscript: label };
}

/* ─── Gate variant geometry ─────────────────────────────────── */

const GATE_OCTAGON = (() => {
  // Octagon centered on (290,110), radius 30, flat-top orientation.
  const cx = 290;
  const cy = 110;
  const r = 30;
  const k = r * Math.cos(Math.PI / 8);
  const j = r * Math.sin(Math.PI / 8);
  return [
    [cx - j, cy - k],
    [cx + j, cy - k],
    [cx + k, cy - j],
    [cx + k, cy + j],
    [cx + j, cy + k],
    [cx - j, cy + k],
    [cx - k, cy + j],
    [cx - k, cy - j],
  ]
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ") + " Z";
})();

const BRANCH_Y = { approved: 34, held: 110, denied: 186 } as const;

const BRANCH_PATH: Record<GateOutcome, string> = {
  approved: "M320,110 C360,110 356,34 406,34",
  held: "M320,110 L406,110",
  denied: "M320,110 C360,110 356,186 406,186",
};

const BRANCH_TONE: Record<
  GateOutcome,
  { stroke: string; text: string; chip: string }
> = {
  approved: {
    stroke: "stroke-emerald-500",
    text: "fill-emerald-600 dark:fill-emerald-400",
    chip: "stroke-emerald-500/60 fill-emerald-500/10",
  },
  held: {
    stroke: "stroke-amber-500",
    text: "fill-amber-600 dark:fill-amber-400",
    chip: "stroke-amber-500/60 fill-amber-500/10",
  },
  denied: {
    stroke: "stroke-red-500",
    text: "fill-red-600 dark:fill-red-400",
    chip: "stroke-red-500/60 fill-red-500/10",
  },
};

function outcomeFromUnknown(outcome: string | null | undefined): GateOutcome | null {
  if (outcome === "approved" || outcome === "held" || outcome === "denied") return outcome;
  return null;
}

/* ─── Gate variant ──────────────────────────────────────────── */

export interface EvidenceFlowGateProps {
  variant: "gate";
  /** When false the shield gate dims to a dashed outline and the packet
   *  bypasses straight to "No audit record". */
  governed?: boolean;
  /** Show the amber encrypted-lock ring while the prover runs. */
  fhe?: boolean;
  phase?: GatePhase;
  /** Terminal outcome; illuminates exactly one branch. */
  outcome?: GateOutcome | null;
  intentLabel?: string;
  amountLabel?: string;
  /** Compact text for real progress steps that have no visual analog —
   *  never used to fake progress. */
  subscript?: string | null;
  className?: string;
}

/**
 * Live branching gate schematic: Intent → Policy Gate → three outcome rails.
 * All animation is pathLength / opacity / transform so it composits on the
 * GPU; under reduced motion every element renders in its settled state.
 */
function GateSchematic({
  governed = true,
  fhe = false,
  phase = "idle",
  outcome = null,
  intentLabel = "Agent intent",
  amountLabel,
  subscript = null,
  className,
}: Omit<EvidenceFlowGateProps, "variant">) {
  const reduceMotion = useReducedMotion();
  const traveling = phase === "travel" || phase === "evaluate" || phase === "decided";
  const evaluating = phase === "evaluate";
  const decided = phase === "decided" && outcome !== null;

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <svg
        viewBox="0 0 640 236"
        role="img"
        aria-label={
          governed
            ? "Governed spend flowing through a policy gate into an outcome rail"
            : "Ungoverned spend bypassing the policy gate with no audit record"
        }
        className="mx-auto block h-auto w-full min-w-[540px] max-w-2xl text-muted-foreground"
      >
        {/* ── Rail 1→2: intent wire ── */}
        <path
          d="M92,110 L252,110"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="stroke-border"
        />
        <motion.path
          d="M92,110 L252,110"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={governed ? "stroke-primary" : "stroke-red-400"}
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: traveling ? 1 : 0 }}
          transition={{ duration: MOTION_DURATION.flow, ease: MOTION_EASE.inOut }}
        />

        {/* Packet dot traveling the intent wire */}
        {traveling && !decided && (
          reduceMotion ? (
            <circle cx={evaluating ? 252 : 170} cy="110" r="4" className={fhe ? "fill-amber-500" : "fill-primary"} />
          ) : (
            <motion.circle
              cy="110"
              r="4"
              className={fhe ? "fill-amber-500" : "fill-primary"}
              initial={{ cx: 92, opacity: 0 }}
              animate={{ cx: evaluating ? 252 : 170, opacity: 1 }}
              transition={{
                cx: { duration: MOTION_DURATION.flow, ease: MOTION_EASE.inOut },
                opacity: { duration: MOTION_DURATION.micro },
              }}
            />
          )
        )}

        {/* ── Node 1: Intent ── */}
        <g>
          <circle cx="64" cy="110" r="26" className="fill-card stroke-border" strokeWidth="1.5" />
          <circle cx="64" cy="110" r="26" fill="none" className="stroke-primary/30" strokeWidth="1" />
          <text x="64" y="114" textAnchor="middle" fontSize="13" className="fill-primary">◆</text>
          <text x="64" y="152" textAnchor="middle" fontSize="10" fill="currentColor" className="font-medium">
            {intentLabel}
          </text>
          {amountLabel && (
            <text x="64" y="166" textAnchor="middle" fontSize="10" fill="currentColor" className="font-mono tabular-nums">
              {amountLabel}
            </text>
          )}
        </g>

        {/* ── Node 2: Policy gate ── */}
        <g opacity={governed ? 1 : 0.45}>
          <motion.path
            d={GATE_OCTAGON}
            className={cn("fill-card", governed ? "stroke-primary" : "stroke-muted-foreground")}
            strokeWidth="1.75"
            strokeDasharray={governed ? undefined : "5 4"}
            initial={false}
            animate={{ opacity: governed ? 1 : 0.5 }}
          />
          {/* shield glyph: simple shield silhouette inside the octagon */}
          <path
            d="M290,96 l10,4 v8 c0,7 -4.5,12 -10,14 c-5.5,-2 -10,-7 -10,-14 v-8 z"
            className={governed ? "fill-primary/15 stroke-primary" : "fill-transparent stroke-muted-foreground"}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {governed && (
            <path d="M286,110 l3,3 l6,-6" fill="none" className="stroke-primary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          <text x="290" y="152" textAnchor="middle" fontSize="10" fill="currentColor" className="font-medium">
            Policy gate
          </text>
          {governed && fhe && (
            <text x="290" y="166" textAnchor="middle" fontSize="8.5" className="fill-amber-600 dark:fill-amber-400">
              encrypted evaluation
            </text>
          )}
        </g>

        {/* Amber encrypted-lock ring while the prover runs */}
        {governed && fhe && evaluating && (
          <motion.circle
            cx="290"
            cy="110"
            r="40"
            fill="none"
            className="stroke-amber-500"
            strokeWidth="1.5"
            strokeDasharray="6 5"
            initial={reduceMotion ? false : { opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            transition={{
              opacity: { duration: MOTION_DURATION.fast },
              rotate: reduceMotion
                ? { duration: 0 }
                : { duration: 6, ease: "linear", repeat: Number.POSITIVE_INFINITY },
            }}
            style={{ transformOrigin: "290px 110px" }}
          />
        )}
        {governed && fhe && evaluating && (
          <text x="290" y="70" textAnchor="middle" fontSize="8.5" className="fill-amber-600 dark:fill-amber-400">
            🔒 prover running
          </text>
        )}

        {/* ── Governed: three branching outcome rails ── */}
        {governed && (
          <g>
            {(Object.keys(BRANCH_PATH) as GateOutcome[]).map((branch) => {
              const active = decided && outcome === branch;
              const quiet = !active;
              const tone = BRANCH_TONE[branch];
              return (
                <g key={branch} opacity={quiet ? (decided ? 0.2 : 0.35) : 1}>
                  <path
                    d={BRANCH_PATH[branch]}
                    fill="none"
                    strokeWidth="1.25"
                    className="stroke-border"
                  />
                  <motion.path
                    d={BRANCH_PATH[branch]}
                    fill="none"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    className={tone.stroke}
                    initial={reduceMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: active ? 1 : 0 }}
                    transition={{ duration: MOTION_DURATION.flow, ease: MOTION_EASE.inOut }}
                  />
                  {branch === "approved" && (
                    <g opacity={active || !decided ? 1 : 0.6}>
                      <TerminalNode x={432} y={BRANCH_Y.approved} tone={tone} label="Approved" active={active} glyph="check" />
                      <Connector x1={452} x2={488} y={BRANCH_Y.approved} active={active} toneClass={tone.stroke} />
                      <TerminalNode x={508} y={BRANCH_Y.approved} tone={tone} label="Execute" active={active} glyph="zap" />
                      <Connector x1={528} x2={564} y={BRANCH_Y.approved} active={active} toneClass={tone.stroke} />
                      <TerminalNode x={584} y={BRANCH_Y.approved} tone={tone} label="Receipt" active={active} glyph="receipt" />
                    </g>
                  )}
                  {branch === "held" && (
                    <g opacity={active || !decided ? 1 : 0.6}>
                      <TerminalNode x={432} y={BRANCH_Y.held} tone={tone} label="Held" active={active} glyph="clock" />
                      <Connector x1={452} x2={488} y={BRANCH_Y.held} active={active} toneClass={tone.stroke} />
                      <TerminalNode x={508} y={BRANCH_Y.held} tone={tone} label="Operator inbox" active={active} glyph="inbox" wide />
                    </g>
                  )}
                  {branch === "denied" && (
                    <g opacity={active || !decided ? 1 : 0.6}>
                      {/* Solid stop-bar terminates the denied rail. */}
                      <rect x="432" y={BRANCH_Y.denied - 16} width="6" height="32" rx="1.5" className={active ? "fill-red-500" : "fill-muted-foreground/40"} />
                      <text x="452" y={BRANCH_Y.denied + 3} fontSize="10" className={active ? tone.text : "fill-muted-foreground"}>
                        Stopped
                      </text>
                      <text x="452" y={BRANCH_Y.denied + 16} fontSize="8.5" fill="currentColor" opacity="0.7">
                        never executes
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* ── Ungoverned: bypass rail to "No audit record" ── */}
        {!governed && (
          <g>
            <path
              d="M64,138 C64,204 560,208 560,176"
              fill="none"
              strokeWidth="1.25"
              strokeDasharray="4 4"
              className="stroke-muted-foreground/50"
            />
            <motion.path
              d="M64,138 C64,204 560,208 560,176"
              fill="none"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="stroke-red-400"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: traveling ? 1 : 0 }}
              transition={{ duration: MOTION_DURATION.flow, ease: MOTION_EASE.inOut }}
            />
            <g opacity={traveling ? 1 : 0.5}>
              <rect x="498" y="140" width="124" height="24" rx="6" className="fill-red-500/10 stroke-red-500/50" strokeWidth="1" />
              <text x="560" y="156" textAnchor="middle" fontSize="10" className="fill-red-600 dark:fill-red-400">
                No audit record
              </text>
            </g>
          </g>
        )}

        {/* Subscript for real steps without a visual analog */}
        {subscript && (
          <text x="290" y="216" textAnchor="middle" fontSize="10" fill="currentColor" className="font-mono">
            {subscript}
          </text>
        )}
      </svg>
    </div>
  );
}

function TerminalNode({
  x,
  y,
  tone,
  label,
  active,
  glyph,
  wide = false,
}: {
  x: number;
  y: number;
  tone: { stroke: string; text: string; chip: string };
  label: string;
  active: boolean;
  glyph: "check" | "zap" | "receipt" | "clock" | "inbox";
  wide?: boolean;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" className={cn("fill-card", active ? tone.stroke : "stroke-muted-foreground/50")} strokeWidth="1.5" />
      {glyph === "check" && (
        <path d={`M${x - 4},${y} l2.8,2.8 l5.2,-5.6`} fill="none" className={active ? tone.stroke : "stroke-muted-foreground/60"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {glyph === "zap" && (
        <path d={`M${x + 1},${y - 5} l-4.5,5.5 h3.5 l-1.5,5 l5,-5.5 h-3.5 z`} fill="none" className={active ? tone.stroke : "stroke-muted-foreground/60"} strokeWidth="1.3" strokeLinejoin="round" />
      )}
      {glyph === "receipt" && (
        <g className={active ? tone.stroke : "stroke-muted-foreground/60"} strokeWidth="1.3" fill="none">
          <rect x={x - 3.5} y={y - 4.5} width="7" height="9" rx="1" />
          <path d={`M${x - 1.5},${y - 1.5} h3 M${x - 1.5},${y + 1} h3`} strokeLinecap="round" />
        </g>
      )}
      {glyph === "clock" && (
        <g className={active ? tone.stroke : "stroke-muted-foreground/60"} strokeWidth="1.4" fill="none">
          <circle cx={x} cy={y} r="4.5" />
          <path d={`M${x},${y - 2.5} v2.5 l2,1.2`} strokeLinecap="round" />
        </g>
      )}
      {glyph === "inbox" && (
        <g className={active ? tone.stroke : "stroke-muted-foreground/60"} strokeWidth="1.3" fill="none">
          <path d={`M${x - 4.5},${y - 3} h9 v6 h-9 z M${x - 4.5},${y} h2.8 a1.7,1.7 0 0 0 3.4,0 h2.8`} strokeLinejoin="round" />
        </g>
      )}
      <text
        x={x}
        y={y + (wide ? 26 : 24)}
        textAnchor="middle"
        fontSize="8.5"
        className={active ? tone.text : "fill-muted-foreground"}
      >
        {label}
      </text>
    </g>
  );
}

function Connector({
  x1,
  x2,
  y,
  active,
  toneClass,
}: {
  x1: number;
  x2: number;
  y: number;
  active: boolean;
  toneClass: string;
}) {
  return (
    <path
      d={`M${x1},${y} L${x2},${y}`}
      fill="none"
      strokeWidth="1.25"
      strokeLinecap="round"
      className={active ? toneClass : "stroke-border"}
      opacity={active ? 1 : 0.5}
    />
  );
}

/* ─── Micro-chain variant ───────────────────────────────────── */

export interface MicroChainNode {
  key: string;
  label: string;
  /** Filled/colored when the evidence is actually present on the record. */
  proven: boolean;
  /** Semantic tone when proven; defaults to emerald. */
  tone?: "primary" | "emerald" | "amber" | "sky";
  tooltip?: string;
}

/**
 * Builds the canonical 4-node evidence wire for an audit/activity row.
 * Every flag must come from real evidence fields on the record — pass
 * exactly what the row data proves, nothing more.
 */
export function buildEvidenceMicroChain(proof: {
  policy: boolean;
  privacy: boolean;
  onchain: boolean;
  receipt: boolean;
}): MicroChainNode[] {
  return [
    {
      key: "policy",
      label: "Policy",
      proven: proof.policy,
      tone: "primary",
      tooltip: proof.policy ? "Policy boundary evaluated" : "No policy evaluation evidence",
    },
    {
      key: "privacy",
      label: "Privacy/FHE",
      proven: proof.privacy,
      tone: "amber",
      tooltip: proof.privacy ? "Encrypted (FHE) evaluation" : "No encrypted evaluation",
    },
    {
      key: "onchain",
      label: "On-chain",
      proven: proof.onchain,
      tone: "sky",
      tooltip: proof.onchain ? "Anchored on-chain" : "No on-chain record",
    },
    {
      key: "receipt",
      label: "Receipt",
      proven: proof.receipt,
      tone: "emerald",
      tooltip: proof.receipt ? "Evidence receipt recorded" : "Receipt pending",
    },
  ];
}

const MICRO_TONE: Record<NonNullable<MicroChainNode["tone"]>, { fill: string; icon: string }> = {
  primary: { fill: "bg-primary border-primary", icon: "text-primary-foreground" },
  emerald: { fill: "bg-emerald-500 border-emerald-500", icon: "text-white" },
  amber: { fill: "bg-amber-500 border-amber-500", icon: "text-white" },
  sky: { fill: "bg-sky-500 border-sky-500", icon: "text-white" },
};

const MICRO_ICON: Record<string, typeof ShieldCheck> = {
  policy: ShieldCheck,
  privacy: Lock,
  onchain: Link2,
  receipt: Receipt,
};

/**
 * Compact ~120px inline evidence wire. Filled/colored nodes are proven,
 * hollow/muted nodes are absent — evidence completeness reads in one glance.
 */
function MicroChain({
  stages,
  className,
}: {
  stages: MicroChainNode[];
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0 align-middle", className)}
      role="img"
      aria-label={`Evidence: ${stages.map((s) => `${s.label} ${s.proven ? "proven" : "absent"}`).join(", ")}`}
    >
      {stages.map((stage, i) => {
        const Icon = MICRO_ICON[stage.key] ?? ShieldCheck;
        const tone = MICRO_TONE[stage.tone ?? "emerald"];
        return (
          <span key={stage.key} className="inline-flex items-center" title={stage.tooltip ?? stage.label}>
            {i > 0 && (
              <span
                className={cn(
                  "h-px w-2.5",
                  stage.proven && stages[i - 1]?.proven ? "bg-muted-foreground/50" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                stage.proven ? tone.fill : "border-muted-foreground/30 bg-transparent",
              )}
            >
              {stage.proven ? (
                <Icon className={cn("h-2 w-2", tone.icon)} strokeWidth={3} aria-hidden="true" />
              ) : (
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden="true" />
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* ─── Loop variant ──────────────────────────────────────────── */

export interface LoopStage {
  key: string;
  label: string;
  /** Live stages get solid rails; building stages get dashed rails. */
  status: "live" | "building";
  caption?: string;
}

export interface EvidenceFlowLoopProps {
  variant: "loop";
  stages: LoopStage[];
  activeStage: string;
  onStageSelect?: (key: string) => void;
  /** layoutId namespace so multiple loops never share a gliding ring. */
  ringId?: string;
  className?: string;
}

const LOOP_ICONS: Record<string, typeof Landmark> = {
  fund: Landmark,
  act: Bot,
  spend: Zap,
  outcome: CheckCircle2,
  allocate: Inbox,
};

/**
 * Interactive 5-stage mandate loop with a return arc. Clicking a stage
 * glides the shared-layout active ring and notifies the consumer, which
 * swaps the preview canvas below (wired up in Phase 4).
 */
function LoopSchematic({
  stages,
  activeStage,
  onStageSelect,
  ringId,
  className,
}: Omit<EvidenceFlowLoopProps, "variant">) {
  const autoId = useId();
  const layoutId = `evidence-loop-ring-${ringId ?? autoId}`;
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("relative", className)}>
      <ol className="relative flex items-stretch" aria-label="Mandate loop stages">
        {stages.map((stage, i) => {
          const Icon = LOOP_ICONS[stage.key] ?? Landmark;
          const isActive = stage.key === activeStage;
          const next = stages[i + 1];
          return (
            <li key={stage.key} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => onStageSelect?.(stage.key)}
                aria-pressed={isActive}
                className="group relative flex flex-col items-center gap-1.5 px-1 outline-none"
              >
                <span className="relative flex h-11 w-11 items-center justify-center">
                  {isActive && (
                    <motion.span
                      layoutId={layoutId}
                      transition={reduceMotion ? { duration: 0 } : MOTION_SPRING.snappy}
                      className="absolute inset-0 rounded-full border-2 border-primary bg-primary/10"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      isActive
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : stage.status === "live"
                          ? "border-border bg-card text-muted-foreground group-hover:border-primary/40"
                          : "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground/60",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
                {stage.status === "building" && (
                  <span className="text-[8.5px] uppercase tracking-widest text-muted-foreground/60">
                    building
                  </span>
                )}
              </button>
              {next && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 h-0 flex-1 border-t-2",
                    next.status === "live" && stage.status === "live"
                      ? "border-primary/50"
                      : "border-dashed border-muted-foreground/30",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {/* Return arc: Allocate flows back into Fund so the loop reads as a loop. */}
      <svg
        viewBox="0 0 100 14"
        preserveAspectRatio="none"
        className="pointer-events-none mx-auto mt-1 h-3.5 w-4/5 text-muted-foreground/40"
        aria-hidden="true"
      >
        <path
          d="M96,1 C96,10 4,10 4,1"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="2.5 2.5"
          vectorEffect="non-scaling-stroke"
        />
        <path d="M4,1 l1.8,-2.4 M4,1 l2.4,0.8" fill="none" stroke="currentColor" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/* ─── Public component ──────────────────────────────────────── */

export type EvidenceFlowProps =
  | EvidenceFlowGateProps
  | ({ variant: "micro-chain"; stages: MicroChainNode[]; className?: string })
  | EvidenceFlowLoopProps;

/**
 * EvidenceFlow — the execution-pipeline primitive. Three composable variants:
 *  - `gate`:        live branching schematic (Intent → Policy Gate → outcome rails)
 *  - `micro-chain`: compact inline evidence-completeness wire for rows
 *  - `loop`:        interactive 5-stage mandate loop explorer
 */
export function EvidenceFlow(props: EvidenceFlowProps) {
  if (props.variant === "micro-chain") {
    return <MicroChain stages={props.stages} className={props.className} />;
  }
  if (props.variant === "loop") {
    const loopProps = { ...props } as Partial<EvidenceFlowLoopProps>;
    delete loopProps.variant;
    return <LoopSchematic {...(loopProps as Omit<EvidenceFlowLoopProps, "variant">)} />;
  }
  const gateProps = { ...props } as Partial<EvidenceFlowGateProps>;
  delete gateProps.variant;
  return <GateSchematic {...(gateProps as Omit<EvidenceFlowGateProps, "variant">)} />;
}

/** Narrow unknown decision strings to a gate outcome. */
export function toGateOutcome(outcome: string | null | undefined): GateOutcome | null {
  return outcomeFromUnknown(outcome);
}
