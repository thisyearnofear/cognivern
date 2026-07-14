"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import { Eye, Lock, Loader2, Database } from "lucide-react";
import { apiClient, type SealedBidRound } from "@/lib/api-client";

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
  return bidder.split("::")[0] || bidder;
}

interface PartyViewProps {
  round: SealedBidRound;
}

// Interactive privacy demonstrator backed by REAL per-party ledger queries.
// The user picks a party; we hit GET …/party-view?party=<name>, which queries
// the participant as that party and returns exactly the Bid contracts it can
// read on-ledger. A bidder sees only their own bid (they're its signatory);
// the auctioneer sees all (observer on every bid). Competitors' bids are never
// in the response — Canton's disclosure model, proven live, not a UI filter.
export function PartyView({ round }: PartyViewProps) {
  const [asParty, setAsParty] = useState<PartyName>("Auctioneer");

  // Re-query the participant on party switch (and when the round's bids change).
  // SWR keys on all of these, so switching identity fires a fresh ledger read.
  const { data, isLoading } = useSWR(
    ["sb-party-view", round.roundId, asParty, round.status, round.bids.length],
    () => apiClient.getSealedBidPartyView(round.roundId, asParty),
    { revalidateOnFocus: false },
  );

  const view = data?.success ? data.data : undefined;
  const supported = view?.supported ?? true;
  const partyId = view?.partyId ?? "";
  const bids = view?.visibleBids ?? null;
  const error = data && !data.success ? (data.error ?? "Ledger query failed") : null;
  const loading = isLoading;
  const count = bids?.length ?? 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" /> Party view — live ledger query
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Each toggle re-queries the Canton participant{" "}
            <span className="font-medium text-foreground">
              acting as that party
            </span>
            . You&apos;re seeing exactly what the ledger returns — not a UI
            filter.
          </p>
        </div>
        <div className="flex gap-1">
          {PARTIES.map((p) => (
            <button
              key={p}
              type="button"
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

      {/* The live ledger-response line — the count changes per identity. */}
      <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            GET /rounds/{round.roundId.slice(0, 10)}…/party-view?party={asParty}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
        </div>
        {!loading && supported && !error && (
          <div className="mt-1.5 text-foreground">
            participant returned{" "}
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
            {partyId && (
              <>
                {" "}
                as{" "}
                <span className="text-muted-foreground">
                  {shortParty(partyId)}
                </span>
              </>
            )}
          </div>
        )}
        {!loading && !supported && (
          <div className="mt-1.5 text-muted-foreground">
            Per-party ledger disclosure is a Canton property — not available on
            this backend.
          </div>
        )}
        {error && <div className="mt-1.5 text-destructive">{error}</div>}
      </div>

      {/* What that party actually sees. */}
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
            bids!.map((b) => (
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
                ? "All bid contracts were archived by the atomic reveal — the losing amounts were never disclosed to anyone."
                : asParty === "Auctioneer"
                  ? "No bids have been submitted to this round yet."
                  : `Canton discloses no bid to ${asParty} on this round — the participant simply never sends a competitor's Bid to a party that isn't its observer.`}
            </li>
          )}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}
