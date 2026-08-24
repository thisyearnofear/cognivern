"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Shield, Users, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";
import { useAccount } from "wagmi";
import { EvidenceChain } from "@/components/brand/evidence-chain";

/**
 * Public landing for the sponsored-cohorts wedge (hackathon / workshop
 * organisers). Kept on its own route — separate buyer, separate narrative —
 * with a fenced teaser on the main landing linking here. See
 * docs/UX_IA_REVIEW.md ("one hierarchy rule").
 */
export function SponsorLanding() {
  const router = useRouter();
  const isAppAuthenticated = useAuthStore((s) => s.isConnected);
  const { isConnected: walletConnected } = useAccount();
  const hasHydrated = useAuthHydrated();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const signedIn = hasHydrated && (isAppAuthenticated || walletConnected);

  const openConsole = () => {
    if (signedIn) router.push("/sponsor/credits");
    else setShowAuthModal(true);
  };

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
          aria-label="Sponsor page sections"
        >
          <a href="#how-sponsoring-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <Link href="/verify" className="transition-colors hover:text-foreground">
            Public verification
          </Link>
          <Link href="/" className="transition-colors hover:text-foreground">
            Main site
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="default" size="sm" onClick={openConsole}>
            {signedIn ? "Open sponsor console" : "Sign In"}
          </Button>
        </div>
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
              For organisers
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl font-bold text-foreground leading-[1.1] tracking-tight max-w-3xl mx-auto"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Sponsor a cohort at cost.
              <br />
              <span className="text-primary">Prove every cent.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto mt-6 leading-relaxed"
            >
              Hand out inference budgets for your hackathon or workshop. Cognivern
              charges 0% on the throughput — you pay inference at provider cost —
              because the product is the evidence of what that spend did, not a
              take-rate on a commodity.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex gap-4 justify-center flex-wrap mt-8"
            >
              <Button variant="default" size="lg" onClick={openConsole}>
                Open the sponsor console <ArrowRight />
              </Button>
              <Link
                href="/credits"
                className="inline-flex h-11 items-center rounded-md bg-secondary px-8 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Have a key? Check your credits
              </Link>
            </motion.div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Participants need no account — balance, disclosure and receipts are self-service.
            </p>
          </div>

          {/* Brand motif: the sponsor's chain ends in a checkable receipt. */}
          <EvidenceChain
            stages={["Budget", "Keys", "Spend", "Receipt"]}
            labeled
            className="mt-6"
          />
        </div>
      </section>

      {/* ── What the console gives you ── */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Keys in one paste",
                desc: "Paste a participant list, mint every budgeted key in one atomic batch, hand them out with one CSV.",
                icon: Users,
              },
              {
                title: "0% fees, pass-through pricing",
                desc: "Every call is metered at provider pricing into an append-only ledger. No markup, no spread — reconcilable at any time.",
                icon: Eye,
              },
              {
                title: "A receipt anyone can check",
                desc: "Balances are committed to a Merkle root anchored on public networks. Drop the verification link in your recap.",
                icon: Shield,
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
                <h2 className="font-semibold text-foreground text-sm mt-3">{card.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How sponsoring works ── */}
      <section id="how-sponsoring-works" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
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
            From budget to verifiable receipt
          </h2>
        </motion.div>

        <ol className="grid gap-4 md:grid-cols-4">
          {[
            { step: "1", title: "Create a program", desc: "Set the pool, per-participant allocation, allowed models, and window." },
            { step: "2", title: "Paste your cohort", desc: "One list of handles mints every budgeted key in a single batch." },
            { step: "3", title: "Meter at cost", desc: "Calls flow through the gateway at provider pricing — nothing marked up." },
            { step: "4", title: "Anchor & share", desc: "Commit balances to a Merkle root, anchor it publicly, share the verify link." },
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

        <div className="mt-10 rounded-xl border border-border bg-muted/30 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Anyone can check the math without trusting you — the{" "}
            <Link href="/verify" className="text-primary hover:underline">
              public verification page
            </Link>{" "}
            verifies inclusion against the anchored root.
          </p>
        </div>
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
              Fund the cohort. Keep the evidence.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
              Set up a sponsored program in minutes, then hand every participant a
              key and a receipt they can verify themselves.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button variant="default" size="lg" onClick={openConsole}>
                Open the sponsor console <ExternalLink className="h-4 w-4 ml-1" />
              </Button>
              <Link
                href="/credits"
                className="inline-flex h-11 items-center rounded-md bg-secondary px-8 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Check your credits
              </Link>
            </div>
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
              <span>Sponsored cohorts, verified</span>
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
              <Link href="/credits" className="hover:text-foreground transition-colors">
                Participant self-service
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
