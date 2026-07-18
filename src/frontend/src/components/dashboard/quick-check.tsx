"use client";

import { useState, useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient, type GovernanceEvaluation } from "@/lib/api-client";
import { useAgents } from "@/hooks/use-api";
import { useDemoStore } from "@/stores/demo-store";
import { HelpIcon } from "@/components/ui/help-icon";

const QUICK_ACTIONS = [
  { type: "swap", label: "Swap", amount: "500" },
  { type: "transfer", label: "Transfer", amount: "1000" },
  { type: "stake", label: "Stake", amount: "2000" },
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

      setEvaluating(true);
      setError(null);
      setResult(null);

      try {
        if (demoMode) {
          // Simulate response in demo mode
          await new Promise((resolve) => setTimeout(resolve, 800));
          setResult({
            allowed: Math.random() > 0.3,
            reasoning:
              Math.random() > 0.3
                ? `Demo: ${checkType} of $${checkAmount} approved by simulated policy`
                : `Demo: ${checkType} of $${checkAmount} exceeds demo budget limit`,
            policyChecks: [
              {
                policyId: "demo-budget-policy",
                result: Math.random() > 0.3,
                reason: "Within daily limit",
              },
            ],
            timestamp: new Date().toISOString(),
          });
        } else {
          const res = await apiClient.evaluateGovernance({
            agentId: agentList[0]?.id || "unknown",
            action: {
              type: checkType,
              description: `Quick ${checkType} check`,
              amount: parseFloat(checkAmount) || 500,
              currency: "USDC",
            },
          });
          setResult(res.data || null);
          if (!res.data) setError("No result returned");
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
            Quick Check
            <HelpIcon helpKey="governance:quick-check" />
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/governance/check")}
            className="h-7 gap-1 text-xs"
          >
            Full Check <ArrowRight className="h-3 w-3" />
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
          <div
            className={`p-3 rounded-lg flex items-center gap-2 ${
              result.allowed
                ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900"
                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
            }`}
          >
            {result.allowed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-sm">
                {result.allowed ? "Approved" : "Denied"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {result.reasoning}
              </div>
            </div>
          </div>
        )}

        {!result && !evaluating && !error && (
          <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            Select an action or enter an amount to check
          </div>
        )}
      </div>
  );
}
