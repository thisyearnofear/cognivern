"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import type { SealedBid, SealedBidRound } from "@/lib/api-client";

// Parties defined in the demo Daml setup. The prod backend allocates these
// automatically on first sandbox boot via daml/daml/Main.daml's setup script.
type PartyName = "Auctioneer" | "Alice" | "Bob" | "Charlie";
const PARTIES: PartyName[] = ["Auctioneer", "Alice", "Bob", "Charlie"];

// Determine what a given party can see for a given bid, per Canton's
// disclosure model. Auctioneer is observer on every Bid; bidders see only
// their own bid. This mirrors the exact rules encoded in the Daml `Bid`
// template (signatory bidder + observer manager).
function partyCanSee(bid: SealedBid, party: PartyName): boolean {
  if (party === "Auctioneer") return true;
  return bid.bidder.startsWith(`${party}::`) || bid.bidder === party;
}

interface PartyViewProps {
  round: SealedBidRound;
}

// Interactive privacy demonstrator. The user picks a party and the bid
// list dims out the entries that party cannot see on-ledger. This makes the
// Canton sub-transaction privacy story visible to demo viewers without
// requiring them to inspect the ledger themselves.
export function PartyView({ round }: PartyViewProps) {
  const [asParty, setAsParty] = useState<PartyName>("Auctioneer");

  const view = useMemo(
    () =>
      round.bids.map((b) => ({
        bid: b,
        visible: partyCanSee(b, asParty),
      })),
    [round.bids, asParty],
  );

  const visibleCount = view.filter((v) => v.visible).length;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" /> Party view
          </h3>
          <p className="text-xs text-muted-foreground">
            What each party can see on the Canton ledger. The auctioneer is
            observer on every bid; bidders see only their own.
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

      <div className="text-xs text-muted-foreground">
        As <span className="font-semibold">{asParty}</span>: visible{" "}
        <span className="font-semibold">{visibleCount}</span> of{" "}
        <span className="font-semibold">{round.bids.length}</span> bids
      </div>

      <ul className="space-y-2">
        {view.map(({ bid, visible }, i) => {
          const bidderShort = bid.bidder.split("::")[0] || bid.bidder;
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-opacity ${
                visible ? "opacity-100" : "opacity-40"
              }`}
            >
              <div className="flex items-center gap-2">
                {visible ? (
                  <Eye className="h-4 w-4 text-emerald-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{bidderShort}</span>
                <span className="text-xs text-muted-foreground">
                  #{bid.index}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {visible ? (
                  <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                    {bid.encryptedAmount.slice(0, 80)}
                    {bid.encryptedAmount.length > 80 && "…"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> not disclosed
                  </span>
                )}
              </div>
            </li>
          );
        })}
        {view.length === 0 && (
          <li className="text-xs text-muted-foreground italic">
            No bids submitted yet.
          </li>
        )}
      </ul>
    </div>
  );
}
