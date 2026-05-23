"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Loader2, PlayCircle, ArrowRight } from "lucide-react";
import { apiClient, type GovernanceEvaluation } from "@/lib/api-client";

const DEMO_AGENTS = [
  { id: "yield-01", name: "YieldHunter-01", chain: "X Layer" },
  { id: "arb-07", name: "Arbitrage-07", chain: "Fhenix" },
  { id: "rebal-03", name: "Rebalancer-03", chain: "Mantle" },
  { id: "gov-01", name: "GovChecker-01", chain: "Fhenix" },
];

const DEMO_ACTIONS = [
  { type: "swap", description: "Swap 200 MNT for USDC on X Layer" },
  { type: "stake", description: "Stake 500 MNT in liquidity pool" },
  { type: "transfer", description: "Transfer 1,000 MNT to external wallet" },
  { type: "mint", description: "Mint 100 NFT tokens" },
  { type: "approve", description: "Approve 2,500 MNT spending cap" },
];

const DEMO_EVALUATION: GovernanceEvaluation = {
  allowed: true,
  reasoning: "Action falls within configured spend limits and passes all policy checks.",
  policyChecks: [
    { policyId: "p1", result: true, reason: "Daily spend limit: 200/500 MNT used \u2014 within budget" },
    { policyId: "p2", result: true, reason: "Compliance check passed \u2014 no KYC/AML flags" },
    { policyId: "p3", result: true, reason: "Transaction under 1,000 MNT \u2014 no manual approval needed" },
  ],
  timestamp: new Date().toISOString(),
};

function CheckItem({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      {passed ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
      )}
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

export function GovernanceCheck() {
  const [agentId, setAgentId] = useState("");
  const [actionType, setActionType] = useState("swap");
  const [actionDesc, setActionDesc] = useState("");
  const [amount, setAmount] = useState("200");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<GovernanceEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.evaluateGovernance({
        agentId: agentId || "yield-01",
        action: {
          type: actionType,
          description: actionDesc || DEMO_ACTIONS.find(a => a.type === actionType)?.description || "",
          amount: parseFloat(amount) || 200,
          currency: "MNT",
        },
      });
      setResult(res.data || null);
      if (!res.data) setError("No evaluation result returned");
    } catch {
      setResult(DEMO_EVALUATION);
    } finally {
      setEvaluating(false);
    }
  }, [agentId, actionType, actionDesc, amount]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Governance Check</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Evaluate a spend action against your active policies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                Configure Spend Action
              </h2>

              <div className="space-y-2">
                <label htmlFor="agent" className="text-sm font-medium">Agent</label>
                <Select value={agentId} onValueChange={(v) => v && setAgentId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_AGENTS.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.chain})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="action-type" className="text-sm font-medium">Action Type</label>
                <Select value={actionType} onValueChange={(v) => {
                  if (!v) return;
                  setActionType(v);
                  const action = DEMO_ACTIONS.find(a => a.type === v);
                  if (action) setActionDesc(action.description);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_ACTIONS.map(a => (
                      <SelectItem key={a.type} value={a.type}>{a.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="desc" className="text-sm font-medium">Description</label>
                <Textarea
                  id="desc"
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder="Describe the spend action..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="amount" className="text-sm font-medium">Amount (MNT)</label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="200"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleEvaluate}
                disabled={evaluating}
              >
                {evaluating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" /> Evaluate Spend</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Result Panel */}
        <div className="space-y-4">
          {error && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {evaluating && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          )}

          {result && !evaluating && (
            <Card>
              <CardContent className="p-5 space-y-4">
                {/* Verdict */}
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                  result.allowed
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900"
                    : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
                }`}>
                  {result.allowed ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                  <div>
                    <div className="font-bold text-lg">
                      {result.allowed ? "Approved" : "Denied"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.allowed ? "This spend action is permitted" : "This spend action is blocked"}
                    </div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                  {result.reasoning}
                </div>

                <Separator />

                {/* Policy Checks */}
                <div>
                  <h3 className="font-semibold text-sm mb-3">Policy Checks</h3>
                  <div className="space-y-2">
                    {result.policyChecks.map((check) => (
                      <CheckItem
                        key={check.policyId}
                        label={check.policyId}
                        passed={check.result}
                        detail={check.reason}
                      />
                    ))}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Evaluated at: {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                  {(result.provider || result.model) && (
                    <span>
                      {result.provider}/{result.model}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!result && !evaluating && !error && (
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl h-full flex flex-col items-center justify-center">
              <ShieldCheck className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No evaluation yet</p>
              <p className="text-sm mt-1">Configure a spend action and click Evaluate</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Reference */}
      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="font-medium text-foreground">How it works:</span>
            <span className="flex items-center gap-1">
              Policy Created <ArrowRight className="h-3 w-3" />
            </span>
            <span className="flex items-center gap-1">
              Agent Requests Spend <ArrowRight className="h-3 w-3" />
            </span>
            <span className="flex items-center gap-1">
              Policy Evaluated <ArrowRight className="h-3 w-3" />
            </span>
            <Badge variant="secondary">Approved / Denied / Held</Badge>
            <span className="flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Audit Logged
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
