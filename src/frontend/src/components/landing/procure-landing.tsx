"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Gavel, LockKeyhole, Shield, Zap } from "lucide-react";
import { EvidenceChain } from "@/components/brand/evidence-chain";

/**
 * Public landing for the procurement wedge: funded mandates → sealed-bid
 * rounds → atomic settlement on Canton. Same fenced-route pattern as
 * /sponsor — separate buyer story, linked from one teaser on the main
 * landing. The secondary CTA is populated client-side from the public
 * rounds endpoint and hidden when there is nothing revealed to point at.
 */

export function ProcureLanding() {
  const [proofRoundId, setProofRoundId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vendor/sealed-bid/rounds")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        const rounds = body?.data;
        if (!Array.isArray(rounds)) return;
        const revealed = rounds.find(
          (round: { status?: string }) => round.status === "revealed",
        );
        if (revealed?.roundId) setProofRoundId(revealed.roundId);
      })
      .catch(() => {
        // No live rounds reachable — the proof CTA simply stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Shield size={16} />
          </div>
          <span
            className="text-lg font-semibold text-foreground"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Cognivern
          </span>
        </Link>
        <nav
          className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground"
          aria-label="Procurement page sections"
        >
          <a href="#how-procurement-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <Link href="/verify" className="transition-colors hover:text-foreground">
            Public verification
          </Link>
          <Link href="/" className="transition-colors hover:text-foreground">
            Main site
          </Link>
        </nav>
        <Link
          href="/sealed-bid"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open live auctions
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow absolute inset-0 z-0" />
        <div className="landing-grid absolute inset-0 z-0" />

        <div className="relative z-10 max-w-5xl mx-auto pt-28 pb-16 px-6">
          <div className="text-center mb-10">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium mb-8 border border-primary/20"
            >
              For teams procuring with agents
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl font-bold text-foreground leading-[1.1] tracking-tight max-w-3xl mx-auto"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Confidential procurement for agents,{" "}
              <span className="text-primary">settled on Canton.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto mt-6 leading-relaxed"
            >
              Fund a mandate, let agents run a sealed-bid round, and settle the
              winner atomically on a Canton ledger. Competitors never see each
              other&apos;s prices — and every outcome comes with a public proof
              link.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex gap-4 justify-center flex-wrap mt-8"
            >
              <Link
                href="/sealed-bid"
                className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open live auctions <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
              {proofRoundId && (
                <Link
                  href={`/verify?round=${encodeURIComponent(proofRoundId)}`}
                  className="inline-flex h-11 items-center rounded-md bg-secondary px-8 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  See a public proof
                </Link>
              )}
            </motion.div>
          </div>

          {/* Brand motif: mandate → round → bids → settlement, ending in proof. */}
          <EvidenceChain
            stages={["Mandate", "Round", "Bids", "Settlement"]}
            labeled
            className="mt-6"
          />
        </div>
      </section>

      {/* ── Why Canton ── */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span
              className="text-xs font-semibold text-primary uppercase tracking-widest"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Why Canton
            </span>
            <h2
              className="text-3xl font-bold text-foreground mt-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Privacy the ledger enforces, not the app
            </h2>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Privacy enforced by the ledger",
                desc: "Bid visibility is a property of the Daml contracts, not a promise from our app.",
                icon: LockKeyhole,
              },
              {
                title: "Atomic settlement",
                desc: "Reveal and payment are one transaction: no window where a winner is named but unpaid.",
                icon: Zap,
              },
              {
                title: "Party-level authorization",
                desc: "Every bid is authorized by the bidder's own Canton party.",
                icon: Gavel,
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <card.icon size={18} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mt-3">{card.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
            Today, bidder parties are hosted by Cognivern and settlement uses a
            demo deposit token on Canton DevNet. Bringing your own Canton
            identity is next.
          </p>
        </div>
      </section>

      {/* ── How procurement works ── */}
      <section id="how-procurement-works" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span
            className="text-xs font-semibold text-primary uppercase tracking-widest"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            How it works
          </span>
          <h2
            className="text-3xl font-bold text-foreground mt-3"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            From mandate to settled winner
          </h2>
        </motion.div>

        <ol className="grid gap-4 md:grid-cols-4">
          {[
            {
              step: "1",
              title: "Fund a mandate",
              desc: "Set the budget, allowed assets, and policy the procurement runs under.",
            },
            {
              step: "2",
              title: "Agents open a round",
              desc: "Closing is policy-gated: minimum bids, deadline elapsed, budget within limit.",
            },
            {
              step: "3",
              title: "Bids stay sealed",
              desc: "Canton's sub-transaction privacy means each bidder sees only their own bid. Losing bids are never disclosed.",
            },
            {
              step: "4",
              title: "Settle and prove",
              desc: "The winner is paid from escrow in the same transaction that reveals them. The spend lands on the mandate's statement, and anyone can check the outcome.",
            },
          ].map((item, i) => (
            <motion.li
              key={item.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div
                className="text-2xl font-bold text-primary"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {item.step}
              </div>
              <h3 className="font-semibold text-foreground text-sm mt-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="hero-glow absolute inset-0 z-0 opacity-50" />
        <div className="landing-grid absolute inset-0 z-0 opacity-50" />
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2
              className="text-3xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Run a round under a mandate.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
              Open a live sealed-bid round, watch bids stay sealed, and settle
              the winner with a proof anyone can check.
            </p>
            <Link
              href="/sealed-bid"
              className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Run a round <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-primary font-semibold">Cognivern</span>
              <span className="text-border">|</span>
              <span>Confidential procurement, settled</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">
                Governance for agentic work
              </Link>
              <span className="hidden sm:inline">·</span>
              <Link href="/verify" className="hover:text-foreground transition-colors">
                Public verification
              </Link>
              <span className="hidden sm:inline">·</span>
              <Link href="/sealed-bid" className="hover:text-foreground transition-colors">
                Live auctions
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
