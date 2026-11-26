"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import { GovernanceMoment } from "@/components/ui/governance-moment";
import { EvidenceFlow, type GatePhase, type GateOutcome } from "@/components/primitives/evidence-flow";
import { trackUxEvent } from "@/lib/ux-events";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  PlayCircle,
  RotateCcw,
  Clock,
  Lock,
  ShieldOff,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  defaultExecutionRail,
  formatEvidenceAnchorLine,
} from "@cognivern/shared";

const EXECUTION_RAIL_NAME = defaultExecutionRail().displayName;
const EVIDENCE_LINE = formatEvidenceAnchorLine();

interface Scenario {
  id: string;
  label: string;
  amount: number;
  asset: string;
  purpose: string;
  outcome: GateOutcome;
  decisionDetail: string;
  summaryDetail: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "approve",
    label: "Approve $50",
    amount: 50,
    asset: "USDC",
    purpose: "Gas top-up for relayer wallet",
    outcome: "approved",
    decisionDetail: "Approved — within daily limit, compliance passed",
    summaryDetail: "YieldHunter-01 can proceed with the transaction. Audit trail stored on-chain.",
  },
  {
    id: "hold",
    label: "Hold $500",
    amount: 500,
    asset: "USDC",
    purpose: "LP staking deposit on Curve",
    outcome: "held",
    decisionDetail: "Held for review — exceeds soft limit of $200, requires operator approval",
    summaryDetail: `Spend held for operator review. Once approved, the transaction will broadcast to ${EXECUTION_RAIL_NAME}.`,
  },
  {
    id: "deny",
    label: "Deny $5,000",
    amount: 5000,
    asset: "USDC",
    purpose: "Transfer to unverified recipient",
    outcome: "denied",
    decisionDetail: "Denied — exceeds hard limit of $1,000 and recipient not in allowlist",
    summaryDetail: "Arbitrage-07's request blocked. Policy violation logged to audit trail.",
  },
];

/** Demo playback timing for the gate phases (ms). */
const TRAVEL_MS = 900;
const EVALUATE_MS = 1400;
const UNGOVERNED_MS = 1200;

export function SpendFlowDemo() {
  const router = useRouter();
  const isConnected = useAuthStore((s) => s.isConnected);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const [governed, setGoverned] = useState(true);
  const [phase, setPhase] = useState<GatePhase>("idle");
  const [outcome, setOutcome] = useState<GateOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  function handleStart() {
    trackUxEvent("primary_action_clicked", "spend_flow_demo", governed ? scenario.outcome : "ungoverned");
    clearTimers();
    setCompleted(false);
    setOutcome(null);
    setRunning(true);
    setPhase("travel");

    if (governed) {
      schedule(() => setPhase("evaluate"), TRAVEL_MS);
      schedule(() => {
        setPhase("decided");
        setOutcome(scenario.outcome);
      }, TRAVEL_MS + EVALUATE_MS);
      schedule(() => {
        setCompleted(true);
        setRunning(false);
        trackUxEvent("primary_action_completed", "spend_flow_demo", scenario.outcome);
      }, TRAVEL_MS + EVALUATE_MS + 700);
    } else {
      // Ungoverned: the packet bypasses the gate — no evaluation ever happens.
      schedule(() => {
        setPhase("decided");
        setCompleted(true);
        setRunning(false);
        trackUxEvent("primary_action_completed", "spend_flow_demo", "ungoverned");
      }, UNGOVERNED_MS);
    }
  }

  const handleReset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setOutcome(null);
    setCompleted(false);
    setRunning(false);
  }, [clearTimers]);

  function selectScenario(id: string) {
    if (running) return;
    setScenarioId(id);
    handleReset();
  }

  function toggleGoverned() {
    if (running) return;
    setGoverned(!governed);
    handleReset();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>Spend Flow Demo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Watch how Cognivern evaluates every agent spend in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running ? (
            <Button onClick={handleStart}>
              {completed ? (
                <>
                  <RotateCcw className="h-4 w-4" /> Replay
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" /> Start Demo
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Scenario selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-muted/20">
        <span className="text-sm font-medium text-muted-foreground shrink-0">
          Scenario:
        </span>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((sc) => {
            const isActive = sc.id === scenarioId;
            const colorClass =
              sc.outcome === "approved"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : sc.outcome === "held"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => selectScenario(sc.id)}
                disabled={running}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  isActive
                    ? colorClass
                    : "border-border bg-background text-muted-foreground hover:border-primary/30"
                } ${running ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Governance toggle */}
      <div className="flex items-center justify-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
        <ShieldOff
          className={`h-4 w-4 ${!governed ? "text-red-500" : "text-muted-foreground"}`}
        />
        <button
          type="button"
          onClick={toggleGoverned}
          aria-label="Toggle governance"
          className={`relative w-12 h-6 rounded-full transition-colors ${
            governed ? "bg-emerald-500" : "bg-red-400"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              governed ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
        <ShieldCheck
          className={`h-4 w-4 ${governed ? "text-emerald-500" : "text-muted-foreground"}`}
        />
        <span className="text-sm font-medium">
          Governance:{" "}
          <span className={governed ? "text-emerald-500" : "text-red-500"}>
            {governed ? "ON" : "OFF"}
          </span>
        </span>
      </div>

      {/* Live gate schematic — replaces the old timed text-row stepper. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <EvidenceFlow
          variant="gate"
          governed={governed}
          fhe={governed}
          phase={phase}
          outcome={outcome}
          intentLabel="YieldHunter-01"
          amountLabel={`$${scenario.amount} ${scenario.asset}`}
          subscript={
            phase === "evaluate"
              ? "FHE comparisons on encrypted values — amounts never in plaintext"
              : phase === "idle"
                ? scenario.purpose
                : null
          }
        />
        {phase === "decided" && governed && outcome && (
          <div className="mt-2 flex items-center justify-center gap-2 text-xs">
            {outcome === "approved" ? (
              <>
                <Lock className="h-3 w-3 text-blue-500" />
                <span className="text-blue-600 dark:text-blue-400">
                  ${scenario.amount} {scenario.asset} within encrypted daily budget
                </span>
                <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-2" />
                <span className="text-emerald-600 dark:text-emerald-400">Compliance passed</span>
              </>
            ) : outcome === "held" ? (
              <>
                <Clock className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">
                  ${scenario.amount} {scenario.asset} exceeds soft limit — operator approval required
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 text-red-500" />
                <span className="text-red-600 dark:text-red-400">{scenario.decisionDetail}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      {completed && governed && (
        <div className="space-y-3">
          <GovernanceMoment
            outcome={scenario.outcome}
            amount={scenario.amount}
            asset={scenario.asset}
          />
        <div
          className={`rounded-xl border-2 bg-card ${
            scenario.outcome === "approved"
              ? "border-emerald-200 dark:border-emerald-900"
              : scenario.outcome === "held"
                ? "border-amber-200 dark:border-amber-900"
                : "border-red-200 dark:border-red-900"
          }`}
        >
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              {scenario.outcome === "approved" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : scenario.outcome === "held" ? (
                <Clock className="h-6 w-6 text-amber-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <div>
                <div className="font-bold text-lg">
                  Spend {scenario.outcome === "approved" ? "Approved" : scenario.outcome === "held" ? "Held for Review" : "Denied"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {scenario.summaryDetail}
                </div>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>
                <strong>Amount:</strong> ${scenario.amount} {scenario.asset}
              </span>
              <span>
                <strong>Duration:</strong> {((TRAVEL_MS + EVALUATE_MS) / 1000).toFixed(1)}s
              </span>
              <span>
                <strong>Policies checked:</strong> 3
              </span>
              <span>
                <strong>Audit:</strong> {scenario.outcome === "held" ? "Pending" : "Immutable"}
              </span>
            </div>
          </div>
        </div>
        </div>
      )}

      {completed && !governed && (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-900 bg-card">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <div className="font-bold text-lg text-red-600 dark:text-red-400">
                  No Governance
                </div>
                <div className="text-sm text-muted-foreground">
                  ${scenario.amount} {scenario.asset} spent with no guardrails. No policy
                  evaluated. No audit evidence. If this were a malicious or erroneous
                  transaction, it would be irreversible.
                </div>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex flex-wrap items-center gap-4 text-sm text-red-500">
              <span>
                <strong>Policies checked:</strong> 0
              </span>
              <span>
                <strong>Audit trail:</strong> None
              </span>
              <span>
                <strong>Recovery:</strong> Impossible
              </span>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start gap-2">
            {governed ? (
              <Lock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            ) : (
              <ShieldOff className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="text-xs text-muted-foreground">
              {governed ? (
                <>
                  <span className="font-medium text-foreground">
                    Privacy by design:
                  </span>{" "}
                  Budgets, limits, and spend amounts are evaluated while encrypted —
                  the policy engine sees compliance, not your numbers. Audit evidence
                  is stored immutably on configured evidence rails (
                  {EVIDENCE_LINE.replace(/^Immutable on /, "")}).
                </>
              ) : (
                <>
                  <span className="font-medium text-red-500">
                    Without governance:
                  </span>{" "}
                  Agents execute directly with no policy checks, no encryption, and
                  no audit trail. Errors and malicious transactions are irreversible.
                  Toggle governance ON to see the difference.
                </>
              )}
            </div>
          </div>
        </div>

      {/* Demo-to-product bridge: appear after the demo completes so visitors
          see a natural next step once they understand the value. */}
      {completed && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm">
                  {isConnected
                    ? "Apply this to your own agents"
                    : "Set up your own governed workspace"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {isConnected
                    ? "Create a policy and connect your first API identity to govern real agent spend."
                    : "Sign in to run this same flow on your own policies, agents, and real transactions."}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                router.push(isConnected ? "/governance/check" : "/onboarding")
              }
              className="gap-1.5 shrink-0"
            >
              {isConnected ? "Run a real check" : "Get started free"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
