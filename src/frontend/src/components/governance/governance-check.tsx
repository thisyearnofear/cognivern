"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  PlayCircle,
  ArrowRight,
  Lock,
  Mic,
  MicOff,
  Sparkles,
} from "lucide-react";
import { apiClient, type GovernanceEvaluation } from "@/lib/api-client";
import { useAgents } from "@/hooks/use-api";
import { useVoiceInput } from "@/hooks/use-voice-input";

const ACTION_TYPES = [
  { type: "swap", description: "Swap tokens on a DEX" },
  { type: "stake", description: "Stake tokens in a liquidity pool" },
  { type: "transfer", description: "Transfer tokens to an external wallet" },
  { type: "mint", description: "Mint tokens" },
  { type: "approve", description: "Approve a spending cap" },
];

/** Quick-select description chips per action type */
const DESCRIPTION_CHIPS: Record<string, string[]> = {
  swap: [
    "Swap ETH for USDC on Uniswap V3",
    "Swap USDC for WBTC on Curve",
    "Swap stETH for ETH on Lido",
    "Arbitrage ETH/USDC across DEXs",
  ],
  stake: [
    "Stake USDC in Aave v3 lending pool",
    "Stake ETH in Lido for stETH rewards",
    "Deposit into Curve 3pool for CRV rewards",
    "Restake ETH on EigenLayer",
  ],
  transfer: [
    "Transfer USDC to treasury multisig",
    "Bridge ETH to Arbitrum via native bridge",
    "Withdraw to cold storage wallet",
    "Pay vendor invoice in USDC",
  ],
  mint: [
    "Mint governance tokens for rewards distribution",
    "Mint NFT collection for community airdrop",
    "Mint stablecoin via CDP vault",
  ],
  approve: [
    "Approve USDC spend cap for Aave v3",
    "Approve WETH for Uniswap V3 router",
    "Approve stablecoin for Curve gauge",
  ],
};

function CheckItem({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
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
  const router = useRouter();
  const { data: agents } = useAgents();
  const [agentId, setAgentId] = useState("");
  const [actionType, setActionType] = useState("swap");
  const [actionDesc, setActionDesc] = useState(
    ACTION_TYPES.find((a) => a.type === "swap")?.description || "",
  );
  const [amount, setAmount] = useState("200");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<GovernanceEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nlInput, setNlInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    recording,
    transcribing,
    startRecording: toggleVoiceInput,
  } = useVoiceInput({
    onResult: (text) => setActionDesc(text),
    onError: (err) => setError(err),
  });

  const agentList = useMemo(() => agents || [], [agents]);

  // Simple NL parser: extracts amount and infers action type from keywords
  const parseNlInput = useCallback((input: string) => {
    const lower = input.toLowerCase();
    let parsedType = actionType;
    let parsedAmount = amount;
    const parsedDesc = input;

    // Infer action type from keywords
    if (/\b(swap|exchange|trade|convert)\b/.test(lower)) parsedType = "swap";
    else if (/\b(stake|deposit|lend|yield)\b/.test(lower)) parsedType = "stake";
    else if (/\b(transfer|send|pay|withdraw|bridge)\b/.test(lower)) parsedType = "transfer";
    else if (/\b(mint|create|issue)\b/.test(lower)) parsedType = "mint";
    else if (/\b(approve|allow|permit)\b/.test(lower)) parsedType = "approve";

    // Extract amount (e.g. $500, 500, 2000)
    const amountMatch = input.match(/\$?\s*(\d+(?:,\d+)*(?:\.\d+)?)\b/);
    if (amountMatch) {
      parsedAmount = amountMatch[1].replace(/,/g, "");
    }

    return { type: parsedType, amount: parsedAmount, desc: parsedDesc };
  }, [actionType, amount]);

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    setResult(null);

    try {
      const parsed = nlInput.trim() ? parseNlInput(nlInput) : null;

      const res = await apiClient.evaluateGovernance({
        agentId: agentId || agentList[0]?.id || "unknown",
        action: {
          type: parsed?.type || actionType,
          description:
            parsed?.desc ||
            actionDesc ||
            ACTION_TYPES.find((a) => a.type === (parsed?.type || actionType))?.description ||
            "",
          amount: parseFloat(parsed?.amount || amount) || 200,
          currency: "USDC",
        },
      });
      setResult(res.data || null);
      if (!res.data) setError("No evaluation result returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }, [nlInput, agentId, agentList, actionType, actionDesc, amount, parseNlInput]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Governance Check
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluate a spend action against your active policies
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/os")}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Try Command Center
        </Button>
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

              {/* Natural Language Input — Primary */}
              <div className="space-y-2">
                <label htmlFor="nl-input" className="text-sm font-medium">
                  Describe in plain English
                </label>
                <div className="flex gap-2">
                  <Input
                    id="nl-input"
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    placeholder="e.g. Swap $500 USDC for ETH on Uniswap"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    disabled={transcribing}
                    onClick={toggleVoiceInput}
                    className={`flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-md border transition-colors shrink-0 ${
                      recording
                        ? "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : transcribing
                          ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    title={recording ? "Stop recording" : "Voice input"}
                  >
                    {transcribing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : recording ? (
                      <MicOff className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {nlInput && (
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const parsed = parseNlInput(nlInput);
                      return (
                        <>
                          <Badge variant="outline" className="text-[10px]">
                            Type: {parsed.type}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Amount: ${parsed.amount}
                          </Badge>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Advanced Fields — Collapsible */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {showAdvanced ? "Hide" : "Show"} advanced fields
                  <svg className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {showAdvanced && (
                  <div className="space-y-4 mt-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <label htmlFor="agent" className="text-sm font-medium">
                        Agent
                      </label>
                      <Select
                        value={agentId}
                        onValueChange={(v) => v && setAgentId(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agentList.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} ({a.chain})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="action-type" className="text-sm font-medium">
                        Action Type
                      </label>
                      <Select
                        value={actionType}
                        onValueChange={(v) => {
                          if (!v) return;
                          setActionType(v);
                          const action = ACTION_TYPES.find((a) => a.type === v);
                          if (action) setActionDesc(action.description);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select action type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map((a) => (
                            <SelectItem key={a.type} value={a.type}>
                              {a.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="desc" className="text-sm font-medium">
                        Description
                      </label>
                      <Textarea
                        id="desc"
                        value={actionDesc}
                        onChange={(e) => setActionDesc(e.target.value)}
                        placeholder="Describe the spend action or pick a chip below..."
                        rows={2}
                      />
                      {/* Quick-select chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {(DESCRIPTION_CHIPS[actionType] || []).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setActionDesc(chip)}
                            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                              actionDesc === chip
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="amount" className="text-sm font-medium">
                        Amount (USDC)
                      </label>
                      <Input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="200"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleEvaluate}
                disabled={evaluating}
              >
                {evaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Evaluating...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Evaluate Spend
                  </>
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
                <div
                  className={`p-4 rounded-xl flex items-center gap-3 ${
                    result.allowed
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900"
                      : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
                  }`}
                >
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
                      {result.allowed
                        ? "This spend action is permitted"
                        : "This spend action is blocked"}
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
                    {(result.policyChecks || []).map((check) => (
                      <CheckItem
                        key={check.policyId}
                        label={check.policyId}
                        passed={check.result}
                        detail={check.reason}
                      />
                    ))}
                  </div>
                </div>

                {/* FHE Confidential evaluation badge */}
                {"confidential" in result &&
                  (
                    result as GovernanceEvaluation & {
                      confidential?: {
                        fheEvaluated: boolean;
                        chain: string;
                        decisionIds?: string[];
                      };
                    }
                  ).confidential?.fheEvaluated &&
                  (() => {
                    const conf = (
                      result as GovernanceEvaluation & {
                        confidential: {
                          fheEvaluated: boolean;
                          chain: string;
                          decisionIds?: string[];
                        };
                      }
                    ).confidential;
                    return (
                      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                          <Lock className="h-4 w-4" />
                          Confidential Evaluation (Fhenix FHE)
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Chain: {conf.chain}</div>
                          {conf.decisionIds && conf.decisionIds.length > 0 && (
                            <div className="font-mono break-all">
                              Decision: {conf.decisionIds[0]}
                            </div>
                          )}
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            Budget limits evaluated in ciphertext — values never
                            revealed to agent
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Evaluated at:{" "}
                    {new Date(result.timestamp).toLocaleTimeString()}
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
              <p className="text-sm mt-1">
                Configure a spend action and click Evaluate
              </p>
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
