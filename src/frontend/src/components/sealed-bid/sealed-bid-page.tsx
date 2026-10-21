"use client";

import { useState } from "react";
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
  return <Badge variant="outline" className="capitalize">{status}</Badge>;
}

function WorkspaceStatusLine() {
  const { mode, isConnected } = useWorkspaceMode();
  const { data: caps, isLoading } = useSealedBidCapabilities();
  if (!isConnected) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <span><span className="font-semibold">Sample data.</span> Sign in to create real rounds. Nothing here moves funds.</span>
      </div>
    );
  }
  if (isLoading) return <Skeleton className="h-10 rounded-xl" />;
  if (mode === "production") {
    if (caps?.backendConfigured && caps?.settlementSupported) {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
          <Shield className="h-4 w-4 shrink-0 mt-0.5" />
          <span><span className="font-semibold">Production · Canton connected.</span> New rounds can reserve real settlement value at reveal.</span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <span><span className="font-semibold">Production · ledger not fully connected.</span> {caps?.settlementReason ?? "Rounds run without fund movement until settlement is configured."}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
      <Shield className="h-4 w-4 shrink-0 mt-0.5" />
      <span><span className="font-semibold text-foreground">Sandbox.</span> Explore freely — bids are demo personas and no real funds can move.</span>
    </div>
  );
}

export function SealedBidPage() {
  const { data: rounds, isLoading, error } = useSealedBidRounds();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "revealed">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showAgentCreate, setShowAgentCreate] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
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
            Run a confidential RFP. Vendors bid blind — nobody sees a
            competitor&apos;s price until you reveal the winner.
          </p>
          <p className="text-xs text-muted-foreground max-w-2xl">
            <span className="font-medium text-foreground">Recommended:</span> an agent
            round checks budget, deadline and bid rules for you.{" "}
            <span className="font-medium text-foreground">Manual</span> is a quick
            private bid collection with no fund movement.
          </p>
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

      <WorkspaceStatusLine />
      {isAppAuthenticated ? (
        <CantonIdentityCard compact />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground max-w-xl">
            <span className="font-medium text-foreground">Want to bid privately?</span>{" "}
            Connect a wallet and we&apos;ll give you a Canton bidding identity.
            Signing is gasless — it never moves funds.
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowCantonSignIn(true)} className="gap-2">
            <Network className="h-3.5 w-3.5" /> Get a bidding identity
          </Button>
        </div>
      )}
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
                {(["all", "open", "closed", "revealed"] as const).map((s) => (
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
              <PageState
                variant="empty"
                title="No vendor selections yet"
                message="Start a confidential RFP — vendors bid blind, you reveal one winner."
                action={{ label: "New agent round", onClick: () => { setShowCreate(false); setShowAgentCreate(true); } }}
                secondaryAction={{ label: "Manual instead", onClick: () => { setShowAgentCreate(false); setShowCreate(true); } }}
                className="col-span-full"
              />
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
