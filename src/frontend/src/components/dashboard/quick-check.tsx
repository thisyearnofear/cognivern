"use client";

import { useState, useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient, type GovernanceEvaluation } from "@/lib/api-client";
import { useAgents } from "@/hooks/use-api";
import { useDemoStore } from "@/stores/demo-store";
import { HelpIcon } from "@/components/ui/help-icon";
import { DecisionPreview, type DecisionOutcome } from "@/components/governance/decision-preview";
import { trackUxEvent } from "@/lib/ux-events";
import {
  DEMO_APPROVE_THRESHOLD,
  DEMO_HARD_LIMIT,
  resolveDemoDecision,
} from "@cognivern/shared";

const QUICK_ACTIONS = [
  { type: "swap", label: "Approve $50", amount: "50" },
  { type: "transfer", label: "Review $500", amount: "500" },
  { type: "stake", label: "Stop $5,000", amount: "5000" },
];

export function QuickCheck() {
  const router = useRouter();
  const demoMode = useDemoStore((s) => s.demoMode);
  const { data: agents } = useAgents();
  const [actionType, setActionType] = useState("swap");
  const [amount, setAmount] = useState("500");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<GovernanceEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentList = useMemo(() => agents || [], [agents]);

  const handleQuickCheck = useCallback(
    async (type?: string, amt?: string) => {
      const checkType = type || actionType;
      const checkAmount = amt || amount;

      trackUxEvent("primary_action_clicked", "quick_check", checkType);
      setEvaluating(true);
      setError(null);
      setResult(null);

      try {
        const numericAmount = parseFloat(checkAmount) || 500;
        if (demoMode) {
          // Keep the demo deterministic and aligned with the landing page:
          // under the approval threshold is approved, the middle band is held,
          // and the hard limit is denied.
          await new Promise((resolve) => setTimeout(resolve, 800));
          const decision = resolveDemoDecision(numericAmount);
          const allowed = decision === "approved";
          setResult({
            allowed,
            decision,
            reasoning:
              decision === "approved"
                ? `Within the automatic approval limit for this ${checkType}`
                : decision === "held"
                  ? `At or above $${DEMO_APPROVE_THRESHOLD} — held for operator review`
                  : `Above the $${DEMO_HARD_LIMIT.toLocaleString()} hard limit — stopped before execution`,
            policyChecks: [
              {
                policyId: "demo-budget-policy",
                result: decision !== "denied",
                reason:
                  decision === "approved"
                    ? `Under the $${DEMO_APPROVE_THRESHOLD} approval threshold`
                    : decision === "held"
                      ? "Requires human review"
                      : `Over the $${DEMO_HARD_LIMIT.toLocaleString()} hard limit`,
              },
            ],
            timestamp: new Date().toISOString(),
          });
          trackUxEvent("primary_action_completed", "quick_check", decision);
        } else {
          const res = await apiClient.evaluateGovernance({
            agentId: agentList[0]?.id || "unknown",
            action: {
              type: checkType,
              description: `Quick ${checkType} check`,
              amount: numericAmount,
              currency: "USDC",
            },
          });
          setResult(res.data || null);
          if (!res.data) setError("No result returned");
          else trackUxEvent(
            "primary_action_completed",
            "quick_check",
            res.data.decision || (res.data.allowed ? "approved" : "denied"),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Check failed");
      } finally {
        setEvaluating(false);
      }
    },
    [agentList, actionType, amount, demoMode],
  );

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Run a governed request
            <HelpIcon helpKey="governance:quick-check" />
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              trackUxEvent("primary_action_clicked", "quick_check", "full_check");
              router.push("/governance/check");
            }}
            className="h-7 gap-1 text-xs"
          >
            Open full check <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Test a spend action against your policies
        </p>

        {/* Quick action chips */}
        <div className="flex gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.type}
              onClick={() => {
                setActionType(action.type);
                setAmount(action.amount);
                handleQuickCheck(action.type, action.amount);
              }}
              disabled={evaluating}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                actionType === action.type && result
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Custom amount input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="pl-7 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={() => handleQuickCheck()}
            disabled={evaluating}
            className="h-8 gap-1"
          >
            {evaluating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            Check
          </Button>
        </div>

        {/* Result */}
        {error && (
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {result && !evaluating && (
          <DecisionPreview
            compact
            decision={(result.decision || (result.allowed ? "approved" : "denied")) as DecisionOutcome}
            reasoning={result.reasoning}
          />
        )}

        {!result && !evaluating && !error && (
          <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            Select an outcome or enter an amount to see the boundary
          </div>
        )}
      </div>
  );
}
