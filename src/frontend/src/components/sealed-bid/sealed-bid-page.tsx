"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Gavel,
  PlusCircle,
  X,
  ChevronRight,
  Shield,
  Bot,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthModal } from "@/components/auth/auth-modal";
import { useAuthStore } from "@/stores/auth-store";
import { CantonIdentityCard } from "./canton-identity-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageState } from "@/components/ui/error-state";
import { useSealedBidRounds, useSealedBidCapabilities } from "@/hooks/use-api";
import { useSealedBidLiveUpdates } from "@/hooks/use-sealed-bid-stream";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { mutate } from "swr";
import { AgentCreateRound } from "./agent-create-round";
import { GuidedRoundCreate } from "./guided-round-create";
import { RoundDetail } from "./round-detail";
import { displayPartyName, relativeDeadline } from "@/lib/workspace-label";

function StatusPill({ status }: { status: string }) {
  if (status === "open")
    return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">Open for bids</Badge>;
  if (status === "closed")
    return <Badge variant="secondary">Closed · ready to reveal</Badge>;
  if (status === "revealed")
    return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Decided</Badge>;
  if (status === "cancelled")
    return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
  return <Badge variant="outline" className="capitalize">{status}</Badge>;
}

function WorkspaceStatusChips() {
  const { mode, isConnected } = useWorkspaceMode();
  const { data: caps, isLoading } = useSealedBidCapabilities();
  if (!isConnected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <Shield className="h-3 w-3" aria-hidden />
        Sample data. Sign in for real rounds
      </span>
    );
  }
  if (isLoading) return <Skeleton className="h-5 w-28 rounded-full" />;
  if (mode === "production") {
    if (caps?.backendConfigured && caps?.settlementSupported) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <Shield className="h-3 w-3" aria-hidden />
          Canton connected — real settlement at reveal
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
        title={caps?.settlementReason ?? "Rounds run without fund movement until settlement is configured."}
      >
        <Shield className="h-3 w-3" aria-hidden />
        Ledger not fully connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Shield className="h-3 w-3" aria-hidden />
      Sandbox — no real funds
    </span>
  );
}

export function SealedBidPage() {
  const { data: rounds, isLoading, error } = useSealedBidRounds();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "revealed" | "cancelled">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showAgentCreate, setShowAgentCreate] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  // Live round updates — refetches the rounds list on any lifecycle event.
  // Disabled while a detail view is open: RoundDetail runs its own filtered
  // stream which already invalidates the list key.
  useSealedBidLiveUpdates(null, undefined, !selectedRoundId);
  const [showCantonSignIn, setShowCantonSignIn] = useState(false);
  const isAppAuthenticated = useAuthStore((s) => s.isConnected);

  if (selectedRoundId) {
    return (
      <RoundDetail
        roundId={selectedRoundId}
        onBack={() => setSelectedRoundId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-primary">Governed action</p>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6" /> Private vendor selection
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Vendors bid blind; you reveal one winner.
          </p>
          {/* Compact inline status: ledger connectivity + bidding identity.
              The agent-vs-manual tradeoff is explained inside each creation
              form at the moment of choice, not in the permanent header. */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <WorkspaceStatusChips />
            {!isAppAuthenticated && (
              <button
                type="button"
                onClick={() => setShowCantonSignIn(true)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                title="Connect a wallet for a Canton bidding identity — signing is gasless and never moves funds."
              >
                <Network className="h-3 w-3" aria-hidden />
                Get a bidding identity
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => {
              setShowAgentCreate((v) => !v);
              setShowCreate(false);
            }}
            variant={showAgentCreate ? "outline" : "default"}
          >
            {showAgentCreate ? (
              <>
                <X className="h-4 w-4 mr-2" /> Cancel
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" /> New agent round
              </>
            )}
          </Button>
          {!showAgentCreate && (
            <Button
              onClick={() => {
                setShowCreate((v) => !v);
                setShowAgentCreate(false);
              }}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              {showCreate ? (
                <>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 mr-1" /> Manual instead
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {showAgentCreate && (
        <AgentCreateRound
          onCreated={(id) => {
            setShowAgentCreate(false);
            setSelectedRoundId(id);
          }}
          onCancel={() => setShowAgentCreate(false)}
        />
      )}

      {isAppAuthenticated && <CantonIdentityCard compact />}
      <AuthModal
        open={showCantonSignIn}
        initialTab="canton"
        onClose={() => setShowCantonSignIn(false)}
      />

      {showCreate && (
        <GuidedRoundCreate
          onCreated={(id) => {
            setShowCreate(false);
            setSelectedRoundId(id);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <PageState variant="error" title="Could not load vendor rounds" message="Confidential vendor selection is unavailable right now." action={{ label: "Retry", onClick: () => mutate("/api/vendor/sealed-bid/rounds") }} />
      )}

      {!isLoading && !error && rounds && (() => {
        const q = query.trim().toLowerCase();
        const filtered = rounds.filter((r) => {
          if (statusFilter !== "all" && r.status !== statusFilter) return false;
          if (!q) return true;
          return (
            r.description.toLowerCase().includes(q) ||
            r.serviceCategory.toLowerCase().includes(q) ||
            r.roundId.toLowerCase().includes(q)
          );
        });
        return (
        <div className="space-y-3">
          {rounds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rounds…"
                aria-label="Search rounds"
                className="h-9 w-full sm:w-64 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <div className="flex gap-1" role="group" aria-label="Filter by status">
                {(["all", "open", "closed", "revealed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={statusFilter === s}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors capitalize ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                  >
                    {s === "all" ? "All" : s === "revealed" ? "Decided" : s}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rounds.length}</span>
            </div>
          )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {rounds.length === 0 ? (
              <div className="col-span-full space-y-2">
                <PageState
                  variant="empty"
                  title="No vendor selections yet"
                  message="Start a confidential RFP — vendors bid blind, you reveal one winner."
                  action={{ label: "New agent round", onClick: () => { setShowCreate(false); setShowAgentCreate(true); } }}
                  secondaryAction={{ label: "Manual instead", onClick: () => { setShowAgentCreate(false); setShowCreate(true); } }}
                />
                <p className="text-center text-xs text-muted-foreground">
                  <Link href="/verify?round=sandbox-replay" className="text-primary underline underline-offset-2 hover:text-primary/80">
                    See a completed round
                  </Link>{" "}
                  · Recorded sandbox replay
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <PageState
                variant="no-results"
                title="No rounds match"
                message={query ? `Nothing matches "${query}" with this filter.` : "No rounds with this status yet."}
                action={{ label: "Clear filters", onClick: () => { setQuery(""); setStatusFilter("all"); } }}
                className="col-span-full"
              />
            ) : (
              filtered.map((r) => {
                const pct = r.maxBids > 0 ? Math.min(100, Math.round((r.bidCount / r.maxBids) * 100)) : 0;
                const deadlineLabel = r.status === "open" ? relativeDeadline(r.deadline) : "";
                return (
                <motion.button
                  key={r.roundId}
                  type="button"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  onClick={() => setSelectedRoundId(r.roundId)}
                  aria-label={`Open round ${r.description}, ${r.status}, ${r.bidCount} of ${r.maxBids} bids`}
                  className="text-left rounded-xl border bg-card p-4 hover:border-primary transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{r.description}</h3>
                      <p className="text-xs text-muted-foreground">
                        {r.serviceCategory}
                        {deadlineLabel ? ` · ${deadlineLabel}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusPill status={r.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={r.bidCount} aria-valuemax={r.maxBids}>
                    <div className="h-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {r.status === "revealed"
                        ? "Bids sealed & archived"
                        : `${r.bidCount}/${r.maxBids} bids`}
                      {r.createdByAgent && " · agent-checked"}
                    </span>
                    {r.winner && (
                      <span className="text-emerald-600 font-medium">
                        Winner: {displayPartyName(r.winner)}
                      </span>
                    )}
                  </div>
                </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>
        </div>
        );
      })()}
    </div>
  );
}
