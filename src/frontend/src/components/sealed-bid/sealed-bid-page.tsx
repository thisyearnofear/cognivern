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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageState } from "@/components/ui/error-state";
import { useSealedBidRounds } from "@/hooks/use-api";
import { useDemoStore } from "@/stores/demo-store";
import { mutate } from "swr";
import { AgentCreateRound } from "./agent-create-round";
import { GuidedRoundCreate } from "./guided-round-create";
import { RoundDetail } from "./round-detail";

export function SealedBidPage() {
  const demoMode = useDemoStore((s) => s.demoMode);
  const { data: rounds, isLoading, error } = useSealedBidRounds();
  const [showCreate, setShowCreate] = useState(false);
  const [showAgentCreate, setShowAgentCreate] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6" /> Sealed-bid vendor selection
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Confidential vendor RFPs. Bids stay sealed from competitors until
            the selection is complete.
          </p>
          <p className="text-xs text-muted-foreground">
            Two ways to start: an agent-governed round runs every event
            through policy and a tamper-evident ledger; a manual round is a
            direct private selection that does not escrow funds.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                <Bot className="h-4 w-4 mr-2" /> Create agent round
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              setShowCreate((v) => !v);
              setShowAgentCreate(false);
            }}
            variant={showCreate ? "outline" : "secondary"}
          >
            {showCreate ? (
              <>
                <X className="h-4 w-4 mr-2" /> Cancel
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-2" /> Create manually
              </>
            )}
          </Button>
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

      {demoMode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <Shield className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Demo data.</span> These rounds are
            sample vendor selections so you can explore the sealed-bid and
            atomic-settlement flow without connecting a wallet. Create a real
            round to see it live on Canton Devnet.
          </span>
        </div>
      )}

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

      {!isLoading && !error && rounds && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {rounds.length === 0 ? (
              <PageState
                variant="empty"
                title="No vendor selection rounds"
                message="Start a confidential RFP with an agent-governed round."
                action={{ label: "Create agent round", onClick: () => { setShowCreate(false); setShowAgentCreate(true); } }}
                className="col-span-full"
              />
            ) : (
              rounds.map((r) => (
                <motion.button
                  key={r.roundId}
                  type="button"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  onClick={() => setSelectedRoundId(r.roundId)}
                  className="text-left rounded-xl border bg-card p-4 hover:border-primary transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{r.description}</h3>
                      <p className="text-xs text-muted-foreground">
                        {r.serviceCategory}
                        {r.status === "revealed"
                          ? " · bids sealed & archived"
                          : ` · ${r.bidCount}/${r.maxBids} bids`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.createdByAgent && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                          <Bot className="h-2.5 w-2.5" />
                          Agent
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{r.status}</span>
                    {r.winner && (
                      <span className="text-emerald-600 font-medium">
                        winner: {r.winner.split("::")[0]}
                      </span>
                    )}
                  </div>
                </motion.button>
              ))
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
