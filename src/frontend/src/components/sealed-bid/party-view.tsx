"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Eye, Lock } from "lucide-react";
import {
  apiClient,
  type PartyVisibleBid,
  type SealedBid,
  type SealedBidRound,
} from "@/lib/api-client";
import { useDemoStore } from "@/stores/demo-store";
import { DEMO_SEALED_BID_PARTY_VIEW } from "@/lib/demo-data";
import { displayPartyName } from "@/lib/workspace-label";
import {
  DisclosureLens,
  type LensBid,
} from "@/components/primitives/disclosure-lens";
import type { EnvelopeState } from "@/components/primitives/sealed-envelope";

// The demo parties allocated on Devnet. Toggling one re-queries the Canton
// participant ACTING AS that party — the visible-bid count is whatever the
// ledger actually returns, not a client-side computation.
const PARTIES = ["Auctioneer", "Alice", "Bob", "Charlie"] as const;
type PartyName = (typeof PARTIES)[number];

function shortName(bidder: string): string {
  return displayPartyName(bidder);
}

interface PartyViewProps {
  round: SealedBidRound;
}

/**
 * Pure lens construction — exported for tests. Builds the envelope row from
 * the union of the round's public bid metadata and whatever the participant
 * disclosed to the queried party. Amounts exist ONLY on disclosed bids
 * (`round.bids` carries `encryptedAmount`, never the plaintext), so a
 * redacted envelope can never leak a price.
 */
export function buildPartyLensBids(
  roundBids: SealedBid[],
  visibleBids: PartyVisibleBid[],
): LensBid[] {
  const byIndex = new Map(visibleBids.map((v) => [v.index, v]));
  const lens = roundBids.map((b) => {
    const visible = byIndex.get(b.index);
    return {
      id: `${b.bidder}-${b.index}`,
      bidder: shortName(b.bidder),
      amountUsd: visible?.amountUsd ?? null,
      index: b.index,
    };
  });
  const known = new Set(roundBids.map((b) => b.index));
  for (const v of visibleBids) {
    if (!known.has(v.index)) {
      lens.push({
        id: `${v.bidder}-${v.index}`,
        bidder: shortName(v.bidder),
        amountUsd: v.amountUsd,
        index: v.index,
      });
    }
  }
  return lens;
}

/**
 * Disclosure resolution per the participant contract response — the only
 * inputs are the round status and whether the bid appeared in the queried
 * party's `visibleBids`. No client-side inference beyond what the ledger
 * returned.
 */
export function resolvePartyEnvelopeState(
  roundStatus: SealedBidRound["status"],
  bidIndex: number,
  visibleBids: PartyVisibleBid[],
): EnvelopeState {
  if (roundStatus === "revealed") return "archived";
  return visibleBids.some((v) => v.index === bidIndex) ? "open" : "redacted";
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
  const visibleBids =
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

  const count = visibleBids?.length ?? 0;
  const lensBids =
    visibleBids !== undefined ? buildPartyLensBids(round.bids, visibleBids) : [];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4" /> Party view —{" "}
          {demoMode ? "sample view" : "live ledger query"}
        </h3>
      </div>

      {/* Honest terminal states first — no envelopes without real data. */}
      {!loading && queryFailed && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Ledger query failed. Bid visibility could not be verified.
        </div>
      )}
      {!loading && !queryFailed && unsupported && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Per-party ledger disclosure is a Canton property — not available on
          this backend.
        </div>
      )}
      {!loading && !queryFailed && !unsupported && visibleBids === undefined && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {demoMode
            ? "No sample response for this party."
            : "No party-view data returned."}
        </div>
      )}

      {visibleBids !== undefined && !unsupported && !queryFailed ? (
        lensBids.length > 0 ? (
          <DisclosureLens
            id="party-lens"
            parties={PARTIES.map((p) => ({ value: p, label: p }))}
            activeParty={asParty}
            onPartyChange={setAsParty}
            loading={loading}
            bids={lensBids.map((b) => ({
              ...b,
              tag:
                asParty !== "Auctioneer" &&
                b.bidder.toLowerCase().startsWith(asParty.toLowerCase())
                  ? "your bid"
                  : undefined,
            }))}
            resolveEnvelopeState={(_party, bid) =>
              resolvePartyEnvelopeState(
                round.status,
                bid.index ?? Number.NaN,
                visibleBids,
              )
            }
            visibleCount={count}
            proofQuery={
              demoMode
                ? "Sample view — no ledger request"
                : `GET /rounds/${round.roundId.slice(0, 10)}…/party-view?party=${asParty}`
            }
            headerNote={
              demoMode ? (
                "A recorded sample of what each party could read — no ledger is queried in demo mode."
              ) : (
                <>
                  Each toggle re-queries the Canton participant{" "}
                  <span className="font-medium text-foreground">
                    acting as that party
                  </span>
                  . You&apos;re seeing exactly what the ledger returns — not a
                  UI filter.
                </>
              )
            }
          />
        ) : (
          <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            {round.status === "revealed"
              ? "No active bids remain in the revealed round."
              : "No active bids visible to this party."}
          </div>
        )
      ) : null}

      {demoMode && !demoView && visibleBids === undefined && !unsupported ? (
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
