"use client";

import { useEffect, useRef, useState } from "react";
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
  Share2,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trophy,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { displayPartyName, relativeDeadline, shortAddress } from "@/lib/workspace-label";
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
  useCantonIdentity,
  useMandates,
} from "@/hooks/use-api";
import { useSealedBidLiveUpdates } from "@/hooks/use-sealed-bid-stream";
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

function LifecycleSteps({ status }: { status: string }) {
  const order = ["open", "closed", "revealed"] as const;
  const labels: Record<string, string> = { open: "Bidding", closed: "Closed", revealed: "Decided" };
  if (status === "cancelled") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Round cancelled — bids archived without disclosure
      </p>
    );
  }
  const activeIdx = Math.max(0, order.indexOf(status as (typeof order)[number]));
  return (
    <ol aria-label="Round progress" className="flex items-center gap-1.5 text-[11px]">
      {order.map((s, i) => {
        const done = i < activeIdx || status === "revealed";
        const current = i === activeIdx;
        return (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-current={current ? "step" : undefined}
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                done || current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {done && !current ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            </span>
            <span className={current ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {labels[s]}
            </span>
            {i < order.length - 1 && <span aria-hidden="true" className="mx-1 h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
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
  const [cancelling, setCancelling] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
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
  // Close/reveal acts as the round manager (Auctioneer party on-ledger).
  // Sandbox is an explicit toy ledger — anyone may act as auctioneer for the
  // demo. Production writes require a verified wallet JWT (sealedBidWriteAuth).
  const canManage = !isProduction || (isAuthed && !!walletAddress);
  const { data: cantonIdentity } = useCantonIdentity(isProduction && isAuthed);
  const { data: mandates } = useMandates();
  const mandateName = round?.mandateId
    ? (mandates ?? []).find((m) => m.id === round.mandateId)?.name
    : undefined;
  const hasOwnBid = round?.bids.some(
    (b) => b.bidder === effectiveBidder || displayPartyName(b.bidder) === effectiveBidder,
  ) ?? false;

  // Live updates: the SSE event arrives before the refetched round, so we
  // park the outcome in a ref and toast once the new status lands.
  const pendingOutcomeRef = useRef<"revealed" | "cancelled" | null>(null);
  // When the viewer triggers reveal/cancel themselves, their own action toast
  // already covers it — the echoed SSE event must not toast a second time.
  const localActionRef = useRef<"revealed" | "cancelled" | null>(null);
  const prevStatusRef = useRef<string | undefined>(undefined);
  useSealedBidLiveUpdates(roundId, (event) => {
    if (event.change !== "revealed" && event.change !== "cancelled") return;
    if (event.change === localActionRef.current) {
      localActionRef.current = null;
      return;
    }
    pendingOutcomeRef.current = event.change;
  });

  useEffect(() => {
    const status = round?.status;
    if (!status) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status || !pendingOutcomeRef.current) return;
    const pending = pendingOutcomeRef.current;
    pendingOutcomeRef.current = null;
    if (pending === "cancelled" && status === "cancelled") {
      toast("This round was cancelled");
      return;
    }
    if (pending === "revealed" && status === "revealed") {
      const isViewerWinner = isProduction
        ? !!round?.winner &&
          (round.winner === cantonIdentity?.party ||
            round.winner === walletAddress)
        : displayPartyName(round?.winner) === effectiveBidder;
      if (isViewerWinner) toast.success("You won this round");
      else if (hasOwnBid) toast("Round decided — your bid was not selected");
      else toast("Round decided");
    }
  }, [
    round?.status,
    round?.winner,
    isProduction,
    cantonIdentity?.party,
    walletAddress,
    effectiveBidder,
    hasOwnBid,
  ]);
  const amountError =
    !Number.isFinite(amountUsd) || amountUsd < 1
      ? "Enter an amount of at least $1."
      : amountUsd > 100_000_000
        ? "That amount looks unusually large — double-check it."
        : null;
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
      toast.error("Sign in with your connected account to bid");
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

  async function handleCancel() {
    if (!window.confirm("Cancel this round? Bids are archived without disclosure and any escrowed deposit returns to the manager.")) return;
    localActionRef.current = "cancelled";
    setCancelling(true);
    try {
      const res = await apiClient.cancelSealedBidRound({
        roundId,
        manager: "Auctioneer",
      });
      if (!res.success) throw new Error(res.error || "Cancel failed");
      toast.success("Round cancelled — bids archived, escrow returned");
      await refresh();
    } catch (err: unknown) {
      localActionRef.current = null;
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  async function handleShareProof() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/verify?round=${roundId}`,
      );
      toast.success("Proof link copied");
    } catch {
      toast.error("Could not copy the link — clipboard unavailable");
    }
  }

  async function handleWithdraw() {
    if (!window.confirm("Withdraw your bid? It is archived without disclosure.")) return;
    setWithdrawing(true);
    try {
      const res = await apiClient.withdrawSealedBid({ roundId, bidder: effectiveBidder });
      if (!res.success) throw new Error(res.error || "Withdraw failed");
      toast.success("Bid withdrawn");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleReveal() {
    localActionRef.current = "revealed";
    setRevealing(true);
    try {
      const res = await apiClient.revealSealedBidWinner({
        roundId,
        selectionMethod,
      });
      if (!res.success) throw new Error(res.error || "Reveal failed");
      toast.success(
        `Winner revealed — ${displayPartyName(res.data?.winner) || "?"} at $${res.data?.winningBid}`,
      );
      await refresh();
    } catch (err: unknown) {
      localActionRef.current = null;
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
              {round.deadline && !isNaN(new Date(round.deadline).getTime()) ? (
                <>
                  {" · "}{new Date(round.deadline).toLocaleString()}
                  {round.status === "open" && (
                    <span className="ml-1 font-medium text-foreground/80">({relativeDeadline(round.deadline)})</span>
                  )}
                </>
              ) : null}
              {" · "}{round.bids.length}/{round.maxBids} bids
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {round.createdByAgent && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                <Bot className="h-3 w-3" />
                Agent-checked
              </span>
            )}
            {round.mandateId && (
              <a
                href={`/spend?mandate=${encodeURIComponent(round.mandateId)}`}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary hover:bg-primary/15"
              >
                Under mandate: {mandateName ?? round.mandateId}
              </a>
            )}
            {round.status === "open" ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Open for bids</Badge>
            ) : round.status === "closed" ? (
              <Badge variant="secondary">Closed · ready to reveal</Badge>
            ) : round.status === "cancelled" ? (
              <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Decided</Badge>
            )}
            {(round.status === "revealed" || round.status === "cancelled") && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void handleShareProof()}
              >
                <Share2 className="h-3.5 w-3.5 mr-1" /> Share proof
              </Button>
            )}
          </div>
          <LifecycleSteps status={round.status} />
        </div>
      </div>

      <details className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">
          How privacy works here
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Runs on:</span>
            <BackendBadge backend={round.backend} />
          </div>
          <p>
            Vendors can&apos;t see each other&apos;s prices. The winner and price are
            published once — losing bids stay sealed and are never disclosed.
          </p>
          {round.ledgerRefs && Object.values(round.ledgerRefs).some(Boolean) && (
            <dl className="space-y-1 pt-1 border-t border-border/60">
              <dt className="font-medium">Ledger proof</dt>
              {Object.entries(round.ledgerRefs).filter(([, v]) => v).map(([k, v]) => (
                <dd key={k} className="flex gap-2">
                  <span className="w-16 shrink-0 capitalize">{k}</span>
                  <code className="truncate font-mono" title={v as string}>{v as string}</code>
                </dd>
              ))}
              <dd className="text-muted-foreground">
                <a
                  href={`/verify?round=${encodeURIComponent(roundId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Open public proof →
                </a>
              </dd>
            </dl>
          )}
        </div>
      </details>

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
              Winner: {displayPartyName(round.winner)} at $
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
              The winner was published and all losing bids were archived together.
              No losing amount was disclosed to competitors or the auctioneer.
            </div>
            {round.settledAssetCid && round.settlementAmount != null && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {round.settlementAssetTag ?? "USDC"}{" "}
                  {round.settlementAmount.toLocaleString()}
                </span>{" "}
                transferred to the winner as part of the same settlement. Reference
                ID{" "}
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
                see how losing bids stay hidden from the auctioneer.
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
                  Play as (sandbox persona)
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
              <label htmlFor="bid-amount" className="text-xs font-medium">Amount (USD)</label>
              <Input
                id="bid-amount"
                type="number"
                min={1}
                value={amountUsd}
                aria-invalid={!!amountError}
                onChange={(e) => setAmountUsd(parseFloat(e.target.value) || 0)}
              />
              {amountError && (
                <p role="alert" className="text-[11px] text-destructive">{amountError}</p>
              )}
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
          <div className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Sealed bid: competitors see nothing. Only the auctioneer sees the amount, and only at reveal.</span>
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Sealed until reveal
            </p>
            {hasOwnBid && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={withdrawing}
                onClick={handleWithdraw}
              >
                {withdrawing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Withdraw my bid
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting || deadlineMissed || !canSubmitBid || !!amountError}
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

      {round.status === "cancelled" && (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-2">
          <X className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-foreground">This round was cancelled.</span>{" "}
            Any bids were archived without disclosure
            {round.settledAssetCid ? " and the escrowed deposit returned to the manager" : ""}.
          </span>
        </div>
      )}

      {round.status !== "revealed" && round.status !== "cancelled" && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          {!isProduction && (
            <p className="rounded-md bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
              Sandbox demo — anyone can act as auctioneer here. In Production this step requires a signed-in wallet.
            </p>
          )}
          {isProduction && !canManage && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex items-start gap-2">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span><span className="font-medium">Waiting on the auctioneer.</span> Only the signed-in round manager can close bidding and reveal the winner. This page updates live when the result is published.</span>
            </div>
          )}
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Next step: close &amp; reveal
            {round.createdByAgent && (
              <span className="text-[10px] font-normal text-muted-foreground">
                · policy-gated for agent-governed rounds
              </span>
            )}
          </h3>
          {canManage && (
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
                Close bidding ({round.bids.length} bid{round.bids.length === 1 ? "" : "s"})
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
                  Reveal winner
                </Button>
                <p className="text-xs text-muted-foreground w-full">
                  <Clock className="h-3 w-3 inline mr-1" /> The selection records
                  the winner and archives losing bids together. Losing amounts
                  never surface.
                </p>
              </>
            )}
            {(round.status === "open" || round.status === "closed") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-1" />
                )}
                Cancel round
              </Button>
            )}
          </div>
          )}

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

      <details className="space-y-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
          Verify who can see each bid
        </summary>
        <PartyView round={round} />
      </details>

      {round.backend === "canton" && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
            Compare privacy guarantees
          </summary>
          <RevealComparison />
        </details>
      )}

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
