"use client";

import { useState, useEffect, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  FileSearch,
  CheckCircle2,
  XCircle,
  PlayCircle,
  RotateCcw,
  Clock,
  Activity,
  Lock,
  ShieldOff,
  AlertTriangle,
} from "lucide-react";

interface StepState {
  id: string;
  label: string;
  icon: typeof ShieldCheck;
  status: "pending" | "active" | "passed" | "failed" | "held";
  detail: string;
}

interface Scenario {
  id: string;
  label: string;
  amount: number;
  asset: string;
  purpose: string;
  outcome: "approved" | "held" | "denied";
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
    summaryDetail: "Spend held for operator review. Once approved, the transaction will broadcast to X Layer.",
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

function buildSteps(scenario: Scenario): StepState[] {
  return [
    {
      id: "policy",
      label: "Policy Created",
      icon: ShieldCheck,
      status: "pending",
      detail: "Daily limit: $1,000 (encrypted), soft limit: $200, compliance check enabled",
    },
    {
      id: "request",
      label: "Agent Requests Spend",
      icon: Activity,
      status: "pending",
      detail: `YieldHunter-01 requests ${scenario.amount} ${scenario.asset} — ${scenario.purpose} (encrypted client-side)`,
    },
    {
      id: "evaluate",
      label: "Policy Evaluated",
      icon: FileSearch,
      status: "pending",
      detail: "FHE comparisons on encrypted values — budget and amount never in plaintext",
    },
    {
      id: "decision",
      label: "Decision",
      icon: scenario.outcome === "approved" ? CheckCircle2 : scenario.outcome === "held" ? Clock : XCircle,
      status: "pending",
      detail: "",
    },
    {
      id: "audit",
      label: scenario.outcome === "held" ? "Held — Awaiting Approval" : "Audit Logged",
      icon: Clock,
      status: "pending",
      detail: scenario.outcome === "held"
        ? "Run paused. Operator must approve before broadcast."
        : "Immutable record stored on 0G + X Layer",
    },
  ];
}

function buildUngovernedSteps(scenario: Scenario): StepState[] {
  return [
    {
      id: "request",
      label: "Agent Requests Spend",
      icon: Activity,
      status: "pending",
      detail: `YieldHunter-01 requests ${scenario.amount} ${scenario.asset} — ${scenario.purpose} — no policy check`,
    },
    {
      id: "execute",
      label: "Executes Immediately",
      icon: AlertTriangle,
      status: "pending",
      detail: "Transaction sent directly to the blockchain with no guardrails",
    },
    {
      id: "no-audit",
      label: "No Audit Trail",
      icon: XCircle,
      status: "pending",
      detail: "No record of policy compliance — no evidence of approval",
    },
  ];
}

export function SpendFlowDemo() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const [governed, setGoverned] = useState(true);
  const [steps, setSteps] = useState<StepState[]>(() => buildSteps(scenario));
  const [currentStep, setCurrentStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const activeSteps = governed ? buildSteps(scenario) : buildUngovernedSteps(scenario);

  const advanceStep = useCallback(() => {
    const isUngoverned = !governed;
    const decisionIdx = isUngoverned ? 1 : 3;

    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === currentStep) {
          if (i === decisionIdx && !isUngoverned) {
            const outcome = scenario.outcome;
            return {
              ...s,
              status: outcome === "approved" ? ("passed" as const) : outcome === "held" ? ("held" as const) : ("failed" as const),
              detail: scenario.decisionDetail,
            };
          }
          return { ...s, status: "passed" as const };
        }
        return s;
      }),
    );

    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i === next) return { ...s, status: "active" as const };
          return s;
        }),
      );
    } else {
      setCompleted(true);
      setRunning(false);
    }
  }, [currentStep, steps.length, governed, scenario]);

  useEffect(() => {
    if (!running || completed) return;
    const timer = setTimeout(advanceStep, 1200);
    return () => clearTimeout(timer);
  }, [running, currentStep, completed, advanceStep]);

  function handleStart() {
    setSteps(
      activeSteps.map((s, i) =>
        i === 0 ? { ...s, status: "active" as const } : s,
      ),
    );
    setCurrentStep(0);
    setCompleted(false);
    setRunning(true);
  }

  function handleReset() {
    setSteps(activeSteps);
    setCurrentStep(0);
    setCompleted(false);
    setRunning(false);
  }

  function selectScenario(id: string) {
    if (running) return;
    const sc = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
    setScenarioId(id);
    setCompleted(false);
    setSteps(governed ? buildSteps(sc) : buildUngovernedSteps(sc));
    setCurrentStep(0);
  }

  function toggleGoverned() {
    if (running) return;
    setGoverned(!governed);
    setCompleted(false);
    setSteps(!governed ? buildSteps(scenario) : buildUngovernedSteps(scenario));
    setCurrentStep(0);
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
            <Button onClick={handleStart} disabled={completed}>
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

      {/* Flow visualization */}
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isUngoverned = !governed;
          return (
            <div key={step.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    step.status === "active"
                      ? "bg-primary text-primary-foreground scale-110 shadow-lg ring-2 ring-primary/30"
                      : step.status === "passed"
                        ? isUngoverned
                          ? "bg-red-100 dark:bg-red-950 text-red-500"
                          : "bg-emerald-100 dark:bg-emerald-950 text-emerald-500"
                        : step.status === "failed"
                          ? "bg-red-100 dark:bg-red-950 text-red-500"
                          : step.status === "held"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-500"
                            : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.status === "passed" || step.status === "failed" || step.status === "held" ? (
                    isUngoverned && step.status === "passed" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : step.status === "failed" ? (
                      <XCircle className="h-5 w-5" />
                    ) : step.status === "held" ? (
                      <Clock className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 my-1 transition-colors duration-500 ${
                      step.status === "passed"
                        ? isUngoverned
                          ? "bg-red-300"
                          : "bg-emerald-300"
                        : step.status === "held"
                          ? "bg-amber-300"
                          : step.status === "active"
                            ? "bg-primary/30"
                            : "bg-border"
                    }`}
                  />
                )}
              </div>
              <div
                className={`flex-1 pb-6 transition-all duration-500 ${
                  step.status === "active"
                    ? "opacity-100"
                    : step.status === "pending"
                      ? "opacity-50"
                      : "opacity-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`font-semibold text-sm ${
                      step.status === "active"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  {governed &&
                    (step.id === "policy" ||
                      step.id === "request" ||
                      step.id === "evaluate") && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        <Lock className="h-2.5 w-2.5" />
                        Encrypted
                      </span>
                    )}
                  {step.status === "active" && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      In progress
                    </span>
                  )}
                  {step.status === "passed" && idx === 3 && governed && (
                    <Badge variant="secondary" className="text-xs">
                      Approved
                    </Badge>
                  )}
                  {step.status === "held" && idx === 3 && governed && (
                    <Badge className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      Held
                    </Badge>
                  )}
                  {step.status === "failed" && idx === 3 && governed && (
                    <Badge variant="destructive" className="text-xs">
                      Denied
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
                {step.status === "passed" && idx === 3 && governed && scenario.outcome === "approved" && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Lock className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-600 dark:text-blue-400">
                      ${scenario.amount} {scenario.asset} within encrypted daily budget
                    </span>
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-2" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Compliance passed
                    </span>
                  </div>
                )}
                {step.status === "held" && idx === 3 && governed && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">
                      ${scenario.amount} {scenario.asset} exceeds soft limit — operator approval required
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {completed && governed && (
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
                <strong>Duration:</strong> {(steps.length * 1.2).toFixed(1)}s
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
                  is stored immutably on 0G and X Layer.
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
    </div>
  );
}
