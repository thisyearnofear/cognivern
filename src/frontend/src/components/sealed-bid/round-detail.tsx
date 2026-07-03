"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
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
import { useSealedBidRound } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";
import { BackendBadge } from "./backend-badge";
import { PartyView } from "./party-view";

const DEMO_BIDDERS = ["Alice", "Bob", "Charlie"] as const;

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

  async function refresh() {
    await mutate(`/api/vendor/sealed-bid/rounds/${roundId}`);
    await mutate("/api/vendor/sealed-bid/rounds");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiClient.submitSealedBid({
        roundId,
        bidder,
        amountUsd,
        proposalDetails: proposalDetails || undefined,
      });
      if (!res.success) throw new Error(res.error || "Bid failed");
      toast.success(`${bidder} submitted a sealed bid`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      const res = await apiClient.closeSealedBidRound({
        roundId,
        manager: "Auctioneer",
      });
      if (!res.success) throw new Error(res.error || "Close failed");
      toast.success("Round closed");
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
              {round.serviceCategory} · deadline{" "}
              {new Date(round.deadline).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BackendBadge backend={round.backend} />
          <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
            {round.status}
          </span>
        </div>
      </div>

      {round.winner && round.winningBid !== null && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Winner: {round.winner.split("::")[0]} at $
              {round.winningBid.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Losing bid amounts remain undisclosed on-ledger — Canton archived
              them without ever revealing them to competitors.
            </div>
          </div>
        </div>
      )}

      {round.status === "open" && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-4 space-y-4"
        >
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4" /> Submit sealed bid
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">Bidder</label>
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
            <Button type="submit" disabled={submitting || deadlineMissed}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Submit as {bidder}
            </Button>
          </div>
        </form>
      )}

      {round.status !== "revealed" && round.bids.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Auctioneer actions
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
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Close bidding ({round.bids.length} bids)
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
        </div>
      )}

      <PartyView round={round} />
    </motion.div>
  );
}
