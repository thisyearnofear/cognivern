"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trophy,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSealedBidRound,
  useGovernanceTimeline,
} from "@/hooks/use-api";
import {
  apiClient,
  type PolicyCheck,
} from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { mutate } from "swr";
import { BackendBadge } from "./backend-badge";
import { GovernanceTimelineView } from "./governance-timeline";
import { PartyView } from "./party-view";
import { RevealComparison } from "./reveal-comparison";

const DEMO_BIDDERS = ["Alice", "Bob", "Charlie"] as const;

function shortAddress(addr?: string | null): string {
  if (!addr) return "";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

interface RoundDetailProps {
  roundId: string;
  onBack: () => void;
}

export function RoundDetail({ roundId, onBack }: RoundDetailProps) {
  const { data: round, isLoading, error } = useSealedBidRound(roundId);
  const [bidder, setBidder] = useState<(typeof DEMO_BIDDERS)[number]>("Alice");
  const [amountUsd, setAmountUsd] = useState<number>(30000);
  const [proposalDetails, setProposalDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [selectionMethod, setSelectionMethod] = useState<
    "lowest-bid" | "highest-bid"
  >("lowest-bid");
  // Policy gate state — populated when closeRound returns 403 with
  // policyChecks. Cleared on successful close or when the round changes.
  const [policyChecks, setPolicyChecks] = useState<PolicyCheck[] | null>(null);

  // Governance timeline — only fetched for agent-governed rounds (rounds
  // with a governanceRunId). SWR null-keys for non-governed rounds.
  const { data: governanceTimeline, isLoading: governanceLoading } =
    useGovernanceTimeline(roundId, round?.governanceRunId);

  const workspaceMode = useAuthStore((s) => s.workspaceMode);
  const isAuthed = useAuthStore((s) => s.isConnected);
  const walletAddress = useAuthStore((s) => s.walletAddress);
  const isProduction = workspaceMode === "production";
  // In production the ledger identity is the signed-in wallet; in sandbox the
  // user acts as a demo persona. This mirrors the backend's productionIdentity.
  const effectiveBidder = isProduction ? (walletAddress ?? "") : bidder;
  const canSubmitBid = isProduction ? isAuthed && !!walletAddress : true;

  async function refresh() {
    await mutate(`/api/vendor/sealed-bid/rounds/${roundId}`);
    await mutate("/api/vendor/sealed-bid/rounds");
    await mutate(
      `/api/vendor/sealed-bid/rounds/${roundId}/governance-timeline`,
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isProduction && !canSubmitBid) {
      toast.error("Sign in with your wallet to bid on the production ledger");
      return;
    }
    setSubmitting(true);
    try {
      // The backend re-derives the bidder from the verified JWT in production;
      // we send effectiveBidder for parity and labelling.
      const res = await apiClient.submitSealedBid({
        roundId,
        bidder: effectiveBidder,
        amountUsd,
        proposalDetails: proposalDetails || undefined,
      });
      if (!res.success) throw new Error(res.error || "Bid failed");
      const who = isProduction ? shortAddress(walletAddress) : bidder;
      toast.success(`${who} submitted a sealed bid`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    setPolicyChecks(null);
    try {
      const res = await apiClient.closeSealedBidRound({
        roundId,
        manager: "Auctioneer",
      });
      if (!res.success) {
        // Policy gate rejection (403) carries policyChecks — surface them
        // inline so the user sees *which* check failed, not just "Close failed".
        const checks = (res as { policyChecks?: PolicyCheck[] }).policyChecks;
        if (checks && checks.length > 0) {
          setPolicyChecks(checks);
          const failed = checks.filter((c) => !c.passed);
          toast.error(
            `Policy gate blocked close — ${failed.length} check${failed.length === 1 ? "" : "s"} failed`,
          );
        } else {
          throw new Error(res.error || "Close failed");
        }
        return;
      }
      toast.success("Round closed — policy checks passed");
      setPolicyChecks(null);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Close failed");
    } finally {
      setClosing(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      const res = await apiClient.revealSealedBidWinner({
        roundId,
        selectionMethod,
      });
      if (!res.success) throw new Error(res.error || "Reveal failed");
      toast.success(
        `Winner revealed atomically — ${res.data?.winner?.split("::")[0] ?? "?"} at $${res.data?.winningBid}`,
      );
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setRevealing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="rounded-xl border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
          {error?.message || "Round not found"}
        </div>
      </div>
    );
  }

  const deadlineMissed = new Date(round.deadline) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{round.description}</h1>
            <p className="text-xs text-muted-foreground">
              {round.serviceCategory}
              {round.deadline && !isNaN(new Date(round.deadline).getTime())
                ? ` · deadline ${new Date(round.deadline).toLocaleString()}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BackendBadge backend={round.backend} />
          {round.createdByAgent && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
              <Bot className="h-3 w-3" />
              Agent-governed
            </span>
          )}
          <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
            {round.status}
          </span>
        </div>
      </div>

      {round.winner && round.winningBid !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 flex items-start gap-3"
        >
          <Trophy className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0 space-y-1.5">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              Winner: {round.winner.split("::")[0]} at $
              {round.winningBid.toLocaleString()}
              {round.settledAssetCid && (
                <motion.span
                  key={`settled-${round.settledAssetCid}`}
                  animate={{ opacity: [1, 0.55, 1] }}
                  transition={{
                    duration: 0.8,
                    repeat: 4,
                    ease: "easeInOut",
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400"
                >
                  <BadgeCheck className="h-3 w-3" />
                  Value settled atomically
                </motion.span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Revealed in{" "}
              <span className="font-medium text-foreground">
                one atomic transaction
              </span>{" "}
              — the winner was published and every losing bid archived in the
              same ledger event. No losing amount was ever disclosed, to
              competitors <span className="italic">or</span> the auctioneer. See
              it in the party view below: even as Auctioneer, the ledger now
              returns 0 bid contracts.
            </div>
            {round.settledAssetCid && round.settlementAmount != null && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {round.settlementAssetTag ?? "USDC"}{" "}
                  {round.settlementAmount.toLocaleString()}
                </span>{" "}
                transferred to the winner in the same transaction — on-ledger
                contract{" "}
                <code className="font-mono text-[10px] text-foreground/80">
                  {round.settledAssetCid.slice(0, 16)}…
                </code>
                . No separate settlement step, no escrow-release window: value
                moved at the moment the winner was published.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {round.status === "open" && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-4 space-y-4"
        >
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4" /> Submit sealed bid
          </h3>
          {round.bids.length < 2 && !isProduction && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">Demo tip:</span> Submit at least
                2 bids as different Sandbox Bidders, then close the auction to
                see how Canton keeps losing bids hidden from the Auctioneer.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {isProduction ? (
              <div className="space-y-2">
                <label className="text-xs font-medium">Bidding as</label>
                {walletAddress ? (
                  <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
                    {shortAddress(walletAddress)}
                  </div>
                ) : (
                  <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                    Sign in to bid as yourself
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium">
                  Demo bidder — sandbox ledger
                </label>
                <Select
                  value={bidder}
                  onValueChange={(v) =>
                    setBidder(v as (typeof DEMO_BIDDERS)[number])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_BIDDERS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium">Amount (USD)</label>
              <Input
                type="number"
                min={1}
                value={amountUsd}
                onChange={(e) => setAmountUsd(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Proposal (optional)</label>
              <Input
                placeholder="Short pitch"
                value={proposalDetails}
                onChange={(e) => setProposalDetails(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> On the Canton backend, only the
              auctioneer will see this amount.
            </p>
            <Button
              type="submit"
              disabled={submitting || deadlineMissed || !canSubmitBid}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isProduction
                ? canSubmitBid
                  ? `Submit as ${shortAddress(walletAddress)}`
                  : "Sign in to bid"
                : `Submit as ${bidder}`}
            </Button>
          </div>
        </form>
      )}

      {round.status !== "revealed" && round.bids.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Auctioneer actions
            {round.createdByAgent && (
              <span className="text-[10px] font-normal text-muted-foreground">
                · policy-gated for agent-governed rounds
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {round.status === "open" && (
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={closing || round.bids.length === 0}
              >
                {closing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : round.createdByAgent ? (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Close bidding ({round.bids.length} bids)
                {round.createdByAgent ? " · check policy" : ""}
              </Button>
            )}
            {round.status === "closed" && (
              <>
                <Select
                  value={selectionMethod}
                  onValueChange={(v) =>
                    setSelectionMethod(v as "lowest-bid" | "highest-bid")
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lowest-bid">Lowest bid wins</SelectItem>
                    <SelectItem value="highest-bid">
                      Highest bid wins
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleReveal} disabled={revealing}>
                  {revealing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trophy className="h-4 w-4 mr-2" />
                  )}
                  Reveal winner atomically
                </Button>
                <p className="text-xs text-muted-foreground w-full">
                  <Clock className="h-3 w-3 inline mr-1" /> One transaction:
                  archives every bid + emits the AuctionResult. Losing amounts
                  never surface.
                </p>
              </>
            )}
          </div>

          {/* Policy gate results — shown when closeRound returns 403 with
              policyChecks. Each check is rendered with pass/fail icon + detail. */}
          {policyChecks && policyChecks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                <ShieldX className="h-4 w-4" />
                Policy gate blocked close
              </div>
              <div className="space-y-1.5">
                {policyChecks.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-start gap-2 text-xs"
                  >
                    {c.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldX className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <span className="text-muted-foreground">
                      <span className="font-mono text-foreground/70">
                        {c.name}
                      </span>
                      {" — "}
                      {c.detail}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                The auctioneer cannot close until all policy checks pass. This
                is the agent governance layer enforcing commercial safety —
                not a UI hint.
              </p>
            </motion.div>
          )}
        </div>
      )}

      <PartyView round={round} />

      {round.backend === "canton" && <RevealComparison />}

      {/* Agent governance timeline — only renders for agent-governed rounds
          (the hook null-keys for non-governed rounds). Shows every CRE run
          event with its SHA-256 hash — the tamper-evident audit trail. */}
      {round.governanceRunId && (
        <GovernanceTimelineView
          timeline={governanceTimeline}
          isLoading={governanceLoading}
        />
      )}
    </motion.div>
  );
}
