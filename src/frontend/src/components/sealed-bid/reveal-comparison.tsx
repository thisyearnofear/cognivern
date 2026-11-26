"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Trophy } from "lucide-react";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { SealedEnvelope } from "@/components/primitives/sealed-envelope";
import { MOTION_DURATION } from "@/lib/motion-tokens";

// Interactive "why Canton" — the same sealed-bid protocol runs on either
// backend (createRound backend: "canton" | "fhe") behind the same API. They
// seal bids equally well; the reveal is where they diverge, and that's the
// whole argument. The same three worked-example bids flip between archived
// ghosts (Canton) and exposed amber cards (FHE) as you toggle.
const EXAMPLE_BIDS = [
  { bidder: "Alice", amountUsd: 14200 },
  { bidder: "Bob", amountUsd: 12400 },
  { bidder: "Charlie", amountUsd: 13800 },
] as const;
const WINNER = EXAMPLE_BIDS[1]; // Bob — lowest quote

export function RevealComparison() {
  const [backend, setBackend] = useState<"canton" | "fhe">("canton");

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Why the reveal stays private</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Same selection, same API —{" "}
            <span className="font-mono text-[11px]">
              createRound(backend: &quot;canton&quot; | &quot;fhe&quot;)
            </span>
            . Both seal bids. The reveal is where the rails diverge.
          </p>
        </div>
        <SegmentedControl
          id="reveal-backend"
          options={[
            { value: "canton" as const, label: "Canton" },
            { value: "fhe" as const, label: "FHE (Fhenix)" },
          ]}
          value={backend}
          onChange={setBackend}
        />
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="grid flex-1 grid-cols-3 gap-2">
          {EXAMPLE_BIDS.map((bid) => {
            const isWinner = bid.bidder === WINNER.bidder;
            const state = isWinner
              ? "open"
              : backend === "canton"
                ? "archived"
                : "exposed";
            return (
              <SealedEnvelope
                key={bid.bidder}
                state={state}
                bidder={bid.bidder}
                amountUsd={bid.amountUsd}
                tag={isWinner ? "winner" : undefined}
              />
            );
          })}
        </div>

        <ArrowRight
          className="h-4 w-4 shrink-0 rotate-90 self-center text-muted-foreground sm:rotate-0"
          aria-hidden
        />

        {/* Result slot — the winner is all the reveal ever contains. */}
        <motion.div
          layout
          transition={{ duration: MOTION_DURATION.fast }}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-2"
        >
          <Trophy className="h-4 w-4 text-emerald-600" aria-hidden />
          <div className="text-xs">
            <div className="text-muted-foreground">Winner</div>
            <div className="font-semibold tabular-nums text-foreground">
              {WINNER.bidder} ${WINNER.amountUsd.toLocaleString()}
            </div>
          </div>
        </motion.div>
      </div>

      <p className="text-xs text-muted-foreground">
        {backend === "canton"
          ? "Losing bids archive on reveal — absent from the result."
          : "Manager decrypts all bids off-chain to pick a winner."}
      </p>
    </div>
  );
}
