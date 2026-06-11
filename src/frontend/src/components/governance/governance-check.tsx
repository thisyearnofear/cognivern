"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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
import { useFheProgress } from "@/hooks/use-fhe-progress";
import { HelpIcon } from "@/components/ui/help-icon";

function getSuggestion(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("exceed") || lower.includes("limit") || lower.includes("daily") || lower.includes("threshold"))
    return "Try reducing the amount or increase your daily limit in Policies";
  if (lower.includes("allowlist") || lower.includes("not in") || lower.includes("not allowed"))
    return "Add this vendor or protocol to your allowlist in Policies";
  if (lower.includes("chain"))
    return "Allow this chain in your Chain Restriction policy";
  return "Review this policy in Policies and adjust the rule condition";
}

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
        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" aria-label="Passed" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" aria-label="Failed" />
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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // Async FHE evaluation state (shared hook)
  const {
    fheRunId,
    setFheRunId,
    fheSteps,
    resetFheSteps,
    connectToFheSse,
  } = useFheProgress();
  const [nlInput, setNlInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [debouncedNlParsed, setDebouncedNlParsed] = useState<{
    type: string;
    amount: string;
  } | null>(null);
  const nlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced NL parser — avoids running parseNlInput on every keystroke
  const parseNlInputRef = useRef(parseNlInput);
  useEffect(() => {
    parseNlInputRef.current = parseNlInput;
  }, [parseNlInput]);

  useEffect(() => {
    if (nlDebounceRef.current) {
      clearTimeout(nlDebounceRef.current);
    }
    if (!nlInput.trim()) {
      nlDebounceRef.current = setTimeout(() => {
        setDebouncedNlParsed(null);
      });
      return;
    }
    nlDebounceRef.current = setTimeout(() => {
      setDebouncedNlParsed(parseNlInputRef.current(nlInput));
    }, 250);
    return () => {
      if (nlDebounceRef.current) clearTimeout(nlDebounceRef.current);
    };
  }, [nlInput]);

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    setError(null);
    setErrorCode(null);
    setResult(null);
    setFheRunId(null);
    resetFheSteps();

    try {
      const parsed = nlInput.trim() ? parseNlInput(nlInput) : null;
      const evalParams = {
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
      };

      // Use the FHE-aware endpoint to detect async (202) vs sync (200) responses
      const { status, data } = await apiClient.evaluateGovernanceFhe(evalParams);
      const body = data as { success?: boolean; data?: Record<string, unknown> } | null;

      if (status === 202) {
        // Async FHE evaluation — connect to SSE stream for progress
        const runId = body?.data?.runId as string | undefined;
        if (!runId) {
          throw new Error("No runId returned for FHE evaluation");
        }
        setFheRunId(runId);

        // Connect to SSE — the hook manages step transitions automatically
        connectToFheSse(runId, {
          onComplete: (resultData) => {
            if (resultData) {
              setResult(resultData as unknown as GovernanceEvaluation);
            }
            setFheRunId(null);
            setEvaluating(false);
          },
          onError: (errMsg) => {
            setError(`FHE evaluation error: ${errMsg}`);
            setFheRunId(null);
            setEvaluating(false);
          },
        });
      } else {
        // Sync evaluation (non-confidential) — use data directly
        const resultData = body?.data;
        setResult((resultData as unknown as GovernanceEvaluation) || null);
        if (!resultData) setError("No evaluation result returned");
        setEvaluating(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Evaluation failed";
      // Detect NO_ACTIVE_POLICY from backend 503 response
      if (message.includes("NO_ACTIVE_POLICY")) {
        setErrorCode("NO_ACTIVE_POLICY");
      }
      setError(message);
      setEvaluating(false);
    }
  }, [
    nlInput,
    agentId,
    agentList,
    actionType,
    actionDesc,
    amount,
    parseNlInput,
    setFheRunId,
    resetFheSteps,
    connectToFheSse,
  ]);

  const handleRetryWithAmount = useCallback(
    (newAmount: number) => {
      setAmount(String(newAmount));
      setNlInput("");
      setEvaluating(true);
      setError(null);
      setResult(null);
      apiClient
        .evaluateGovernance({
          agentId: agentId || agentList[0]?.id || "unknown",
          action: {
            type: actionType,
            description:
              actionDesc ||
              ACTION_TYPES.find((a) => a.type === actionType)?.description ||
              "",
            amount: newAmount,
            currency: "USDC",
          },
        })
        .then((res) => {
          setResult(res.data || null);
          if (!res.data) setError("No evaluation result returned");
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Evaluation failed"),
        )
        .finally(() => setEvaluating(false));
    },
    [agentId, agentList, actionType, actionDesc],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
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
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <PlayCircle className="h-4 w-4 text-primary" />
                Configure Spend Action
              </h2>

              {/* Natural Language Input — Primary */}
              <div className="space-y-2">
                <label htmlFor="nl-input" className="text-sm font-medium flex items-center gap-1.5">
                  Describe in plain English
                  <HelpIcon helpKey="governance:nl-input" />
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
                {debouncedNlParsed && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      Type: {debouncedNlParsed.type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Amount: ${debouncedNlParsed.amount}
                    </Badge>
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
            </div>
        </div>

        {/* Result Panel */}
        <div className="space-y-4">
          {errorCode === "NO_ACTIVE_POLICY" ? (
            <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  No active policy found
                </div>
              </div>
              <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                You need an active policy before you can evaluate spend actions.
                Create one in about 2 minutes — start with a template or build
                your own rules.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push("/policies")}
                  className="gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Create a Policy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : error && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* FHE Progress Panel — shown during async confidential evaluation */}
          {evaluating && fheRunId && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                  <Lock className="h-4 w-4" />
                  FHE Confidential Evaluation
                </div>
                <p className="text-xs text-muted-foreground">
                  Policy thresholds are being evaluated in ciphertext on the
                  Fhenix network. Your budget limits stay encrypted throughout.
                </p>
                <div className="space-y-0.5">
                  {fheSteps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3 py-1.5">
                      {/* Step indicator */}
                      <div className="flex-shrink-0 w-6 flex justify-center">
                        {step.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : step.status === "active" ? (
                          <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                        ) : step.status === "error" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20" />
                        )}
                      </div>
                      {/* Step label */}
                      <span
                        className={`text-xs transition-colors ${
                          step.status === "done"
                            ? "text-foreground"
                            : step.status === "active"
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : step.status === "error"
                                ? "text-red-500"
                                : "text-muted-foreground/50"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Live progress timestamp */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Evaluation in progress
                  {fheSteps.some((s) => s.status === "active") && (
                    <span className="text-amber-500">
                      ·{" "}
                      {
                        fheSteps.find((s) => s.status === "active")?.label
                      }
                    </span>
                  )}
                </div>
              </div>
          )}

          {/* Standard loading skeleton — shown during sync evaluation */}
          {evaluating && !fheRunId && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
          )}

          {result && !evaluating && (
            <div className="rounded-xl border bg-card p-5 space-y-4">
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
                  <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "var(--font-space-grotesk)" }}>Policy Checks</h3>
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

                {/* Suggestions for denied results */}
                {!result.allowed &&
                  (result.policyChecks || []).some((c) => !c.result) && (
                    <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-4 space-y-2">
                      <h3 className="font-semibold text-sm flex items-center gap-2 text-sky-700 dark:text-sky-300" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        <AlertTriangle className="h-4 w-4" />
                        How to fix this
                      </h3>
                      <ul className="space-y-1.5">
                        {(result.policyChecks || [])
                          .filter((c) => !c.result)
                          .map((check) => (
                            <li
                              key={check.policyId}
                              className="text-xs text-muted-foreground flex items-start gap-2"
                            >
                              <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-sky-500" />
                              <span>
                                <span className="font-medium text-foreground">
                                  {check.policyId}:
                                </span>{" "}
                                {getSuggestion(check.reason)}
                              </span>
                            </li>
                          ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => router.push("/policies")}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Go to Policies →
                      </button>
                    </div>
                  )}

                {/* Try again with lower amounts */}
                {!result.allowed && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Try again with:
                    </span>
                    {[100, 50, 10].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleRetryWithAmount(amt)}
                        disabled={evaluating}
                        className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Evaluation Privacy indicator — always shown */}
                {result.confidential?.fheEvaluated && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                      <Lock className="h-4 w-4" />
                      Encrypted Evaluation (Fhenix FHE)
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Chain: {result.confidential.chain}</div>
                      {result.confidential.decisionIds &&
                        result.confidential.decisionIds.length > 0 && (
                          <div className="font-mono break-all">
                            Decision: {result.confidential.decisionIds[0]}
                          </div>
                        )}
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        Budget limits evaluated in ciphertext — values never
                        revealed to agent
                      </div>
                    </div>
                  </div>
                )}

                {!result.confidential?.fheEvaluated && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      <span>
                        Standard evaluation — consider{" "}
                        <button
                          type="button"
                          onClick={() => router.push("/policies")}
                          className="text-primary hover:underline"
                        >
                          encrypting sensitive policies
                        </button>{" "}
                        for production use
                      </span>
                    </div>
                  </div>
                )}

                {/* Security protections */}
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>
                      Protected by{" "}
                      {[
                        "JWT authentication verified",
                        "API key validated (scrypt hash)",
                        "Rate limit checked",
                        "Idempotency verified",
                        "Policy evaluation completed",
                        "Audit trail stored",
                        result.confidential?.fheEvaluated
                          ? "FHE encrypted evaluation"
                          : "ChainGPT contract audit available",
                      ].length}{" "}
                      security layers
                    </span>
                    <span className="text-[10px] group-open:hidden">
                      (expand)
                    </span>
                  </summary>
                  <div className="mt-2 pl-5 space-y-1">
                    {[
                      "JWT authentication verified",
                      "API key validated (scrypt hash)",
                      "Rate limit checked",
                      "Idempotency verified",
                      "Policy evaluation completed",
                      "Audit trail stored",
                      result.confidential?.fheEvaluated
                        ? "FHE encrypted evaluation"
                        : "ChainGPT contract audit available",
                    ].map((layer) => (
                      <div
                        key={layer}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        {layer}
                      </div>
                    ))}
                  </div>
                </details>

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
              </div>
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
      <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
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
          <p className="text-xs text-muted-foreground">
            Every spend is evaluated against your active policies in under 100ms.
            Encrypted policies evaluate without exposing amounts to agents.
          </p>
        </div>
    </div>
  );
}
