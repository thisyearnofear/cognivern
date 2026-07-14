"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, AlertTriangle } from "lucide-react";

// Interactive "why Canton" — the same sealed-bid protocol runs on either
// backend (createRound backend: "canton" | "fhe") behind the same API. They
// seal bids equally well; the reveal is where they diverge, and that's the
// whole argument. Toggling makes the difference visible instead of asserted.
export function RevealComparison() {
  const [backend, setBackend] = useState<"canton" | "fhe">("canton");

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Why Canton for the reveal</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Same auction, same API —{" "}
            <span className="font-mono text-[11px]">
              createRound(backend: &quot;canton&quot; | &quot;fhe&quot;)
            </span>
            . Both seal bids. The reveal is where they diverge.
          </p>
        </div>
        <div className="flex gap-1">
          {(["canton", "fhe"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBackend(b)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                backend === b
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {b === "canton" ? "Canton" : "FHE (Fhenix)"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {backend === "canton" ? (
          <motion.div
            key="canton"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs space-y-1.5"
          >
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> Losing prices seen by
              no one
            </div>
            <p className="text-muted-foreground leading-relaxed">
              <span className="font-mono">CloseAndReveal</span> archives every
              losing bid in the same transaction that publishes the winner.
              Nobody decrypts a losing amount — not competitors,{" "}
              <span className="italic">not even the auctioneer</span>. Privacy is
              structural: the ledger never discloses it. (Confirm it above — even
              as Auctioneer, a revealed round returns 0 bid contracts.)
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="fhe"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-1.5"
          >
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> The manager
              sees every losing price
            </div>
            <p className="text-muted-foreground leading-relaxed">
              FHE seals the bids, but picking a winner means decrypting them. In
              our Option B flow the round manager decrypts every bid off-chain
              and publishes the result — so the auctioneer learns all losing
              prices at reveal. Better than a threshold ceremony the losers won&apos;t
              join, but sub-bidder privacy from the manager is lost. For an
              institutional RFP, that&apos;s the leak the seal was supposed to
              prevent.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
