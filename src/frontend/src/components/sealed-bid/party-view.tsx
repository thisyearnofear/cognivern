"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import { Eye, Lock, Loader2, Database } from "lucide-react";
import { apiClient, type SealedBidRound } from "@/lib/api-client";
import { useDemoStore } from "@/stores/demo-store";
import { DEMO_SEALED_BID_PARTY_VIEW } from "@/lib/demo-data";
import { displayPartyName } from "@/lib/workspace-label";

// The demo parties allocated on Devnet. Toggling one re-queries the Canton
// participant ACTING AS that party — the visible-bid count is whatever the
// ledger actually returns, not a client-side computation.
const PARTIES = ["Auctioneer", "Alice", "Bob", "Charlie"] as const;
type PartyName = (typeof PARTIES)[number];

function shortParty(id: string): string {
  const [name, ns] = id.split("::");
  return ns ? `${name}::${ns.slice(0, 6)}…` : name;
}
function shortName(bidder: string): string {
  return displayPartyName(bidder);
}

interface PartyViewProps {
  round: SealedBidRound;
}

// Interactive privacy demonstrator. On a Canton round each toggle re-queries
// GET …/party-view?party=<name> through this service — the backend reads the
// participant as that party and returns exactly the Bid contracts it can see
// on-ledger. A bidder sees only their own bid (they're its signatory); the
// manager sees all (observer on every bid). Competitors' bids are never in
// the response — Canton's disclosure model, not a UI filter. In demo mode
// (no backend reachable) a recorded sample view is shown instead and no
// request is made.
export function PartyView({ round }: PartyViewProps) {
  const [asParty, setAsParty] = useState<PartyName>("Auctioneer");
  const demoMode = useDemoStore((s) => s.demoMode);
  const isCanton = round.backend === "canton";

  // Re-query the participant on party switch (and when the round's bids
  // change). Null key: no request in demo mode or on non-Canton backends.
  const { data, error: requestError, isLoading } = useSWR(
    !demoMode && isCanton
      ? ["sb-party-view", round.roundId, asParty, round.status, round.bids.length]
      : null,
    () => apiClient.getSealedBidPartyView(round.roundId, asParty),
    { revalidateOnFocus: false },
  );

  // In demo mode we can't hit the Canton participant, so use the curated
  // per-party recording that mirrors what the ledger disclosed.
  const demoView = demoMode
    ? DEMO_SEALED_BID_PARTY_VIEW[`${round.roundId}::${asParty}`]
    : undefined;

  const queryFailed = !demoMode && (requestError != null || (data != null && !data.success));
  const result = !demoMode && !queryFailed && data?.success ? data.data : undefined;
  const loading = !demoMode && isCanton && isLoading;
  const unsupported = !isCanton || result?.supported === false;
  const bids =
    unsupported || loading
      ? undefined
      : demoMode
        ? demoView
          ? round.status === "revealed"
            ? []
            : demoView.visibleBids
          : undefined
        : result?.supported && Array.isArray(result.visibleBids)
          ? result.visibleBids
          : undefined;

  const partyLabel = demoMode ? demoView?.party : result?.partyId;
  const count = bids?.length ?? 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" /> Party view —{" "}
            {demoMode ? "sample view" : "live ledger query"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            {demoMode ? (
              <>
                A recorded sample of what each party could read — no ledger is
                queried in demo mode.
              </>
            ) : (
              <>
                Each toggle re-queries the Canton participant through this
                service{" "}
                <span className="font-medium text-foreground">
                  acting as that party
                </span>
                . You&apos;re seeing exactly what the ledger returns — not a UI
                filter.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {PARTIES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={asParty === p}
              onClick={() => setAsParty(p)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                asParty === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* The response line — the count changes per identity. */}
      <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {demoMode
              ? "Sample view — no ledger request"
              : `GET /rounds/${round.roundId.slice(0, 10)}…/party-view?party=${asParty}`}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
        </div>
        {!loading && queryFailed && (
          <div className="mt-1.5 text-destructive">
            Ledger query failed. Bid visibility could not be verified.
          </div>
        )}
        {!loading && !queryFailed && unsupported && (
          <div className="mt-1.5 text-muted-foreground">
            Per-party ledger disclosure is a Canton property — not available on
            this backend.
          </div>
        )}
        {!loading && !queryFailed && !unsupported && bids === undefined && (
          <div className="mt-1.5 text-muted-foreground">
            {demoMode
              ? "No sample response for this party."
              : "No party-view data returned."}
          </div>
        )}
        {!loading && !queryFailed && !unsupported && bids !== undefined && (
          <div className="mt-1.5 text-foreground">
            {demoMode ? "sample records" : "participant returned"}{" "}
            <motion.span
              key={`${asParty}-${count}`}
              initial={{ scale: 1.3, color: "rgb(16 185 129)" }}
              animate={{ scale: 1, color: "currentColor" }}
              transition={{ duration: 0.35 }}
              className="inline-block font-bold"
            >
              {count}
            </motion.span>{" "}
            Bid contract{count === 1 ? "" : "s"}
            {partyLabel && (
              <>
                {" "}
                as{" "}
                <span className="text-muted-foreground">
                  {shortParty(partyLabel)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* What that party actually sees. */}
      {bids !== undefined ? (
        <AnimatePresence mode="wait">
          <motion.ul
            key={asParty}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            {count > 0 ? (
              bids.map((b) => (
                <li
                  key={`${b.bidder}-${b.index}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">{shortName(b.bidder)}</span>
                    {asParty !== "Auctioneer" &&
                      shortName(b.bidder).toLowerCase().startsWith(
                        asParty.toLowerCase(),
                      ) && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          your bid
                        </span>
                      )}
                  </div>
                  <span className="font-semibold tabular-nums">
                    ${b.amountUsd.toLocaleString()}
                  </span>
                </li>
              ))
            ) : (
              <li className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                {round.status === "revealed"
                  ? "No active bids remain in the revealed round."
                  : "No active bids visible to this party."}
              </li>
            )}
          </motion.ul>
        </AnimatePresence>
      ) : demoMode && !demoView ? (
        <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
          This sample round has no party-view recording.{" "}
          <Link href="/verify?round=sandbox-replay" className="text-primary hover:underline">
            Try the guided replay instead →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
