"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Shield,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";
import { EvidenceChain } from "@/components/brand/evidence-chain";
import { useDemoStore } from "@/stores/demo-store";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { DecisionPreview } from "@/components/governance/decision-preview";
import { BoundaryBar } from "@/components/primitives/boundary-bar";
import { DecisionStamp } from "@/components/primitives/decision-stamp";
import { ProofFlip } from "@/components/landing/proof-flip";
import { LoopExplorer } from "@/components/landing/loop-explorer";
import { UseCaseApi } from "@/components/landing/usecase-api";
import { AudienceDoors } from "@/components/landing/audience-doors";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAccount } from "wagmi";
import {
  DEMO_APPROVE_THRESHOLD,
  DEMO_HARD_LIMIT,
  resolveDemoDecision,
  type DemoDecision,
} from "@cognivern/shared";
import { decisionLabel } from "@/lib/decision-language";

/* ─── Main landing page ─────────────────────────────────────── */

export function LandingPage() {
  const router = useRouter();
  const demoMode = useDemoStore((s) => s.demoMode);
  const onboardingCompleted = usePreferencesStore((s) => s.onboardingCompleted);
  const isAppAuthenticated = useAuthStore((s) => s.isConnected);
  const walletAddress = useAuthStore((s) => s.walletAddress);
  const hasHydrated = useAuthHydrated();
  const { isConnected: walletConnected } = useAccount();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [demoAmount, setDemoAmount] = useState(50);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  // The landing page is only for visitors. As soon as a user is signed
  // in (app session OR demo mode OR completed onboarding) we send them
  // to the dashboard. We wait for rehydration so a returning user
  // doesn't briefly see the landing page before the redirect fires.
  useEffect(() => {
    if (!hasHydrated) return;
    if (isAppAuthenticated || demoMode || onboardingCompleted) {
      router.push("/dashboard");
    }
  }, [hasHydrated, isAppAuthenticated, demoMode, onboardingCompleted, router]);

  const handleTryDemo = () => {
    // Start in the denied band so the visitor immediately sees one of
    // Cognivern's three clear answers, while the slider makes the full
    // approve / hold / stop boundary explorable in place.
    setDemoAmount(DEMO_HARD_LIMIT + 500);
    // Smooth-scroll the interactive panel into view so the stamp lands
    // in the visitor's viewport.
    document
      .getElementById("live-demo")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Demo evaluation uses the SAME bands as the backend demo tier
  // (@cognivern/shared/demo-policy) so the landing-page story and the
  // in-app demo never disagree: < $100 approved, ≥ $100 held,
  // > $3000 denied.
  const demoResult: { status: DemoDecision; reason: string } = {
    status: resolveDemoDecision(demoAmount),
    reason:
      demoAmount >= DEMO_HARD_LIMIT
        ? `Over the $${DEMO_HARD_LIMIT} hard limit. Your agent cannot send this payment.`
        : demoAmount >= DEMO_APPROVE_THRESHOLD
          ? `At or above the $${DEMO_APPROVE_THRESHOLD} review threshold. Held for an operator.`
          : "Within the automatic approval limit.",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Shield size={16} />
          </div>
          <span className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Cognivern
          </span>
        </div>
        <nav className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Landing sections">
          <a href="#proof" className="transition-colors hover:text-foreground">
            Proof
          </a>
          <a href="#the-loop" className="transition-colors hover:text-foreground">
            The loop
          </a>
          <a href="#use-cases" className="transition-colors hover:text-foreground">
            Use cases
          </a>
          <a href="#api" className="transition-colors hover:text-foreground">
            API
          </a>
          <Link href="/verify" className="transition-colors hover:text-foreground">
            Verify
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live governance controls
          </span>
          <ThemeToggle />
          {hasHydrated && (isAppAuthenticated || walletConnected) ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              {isAppAuthenticated
                ? "Open Dashboard"
                : walletAddress
                  ? `Continue as ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                  : "Open Dashboard"}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAuthModal(true)}
            >
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* ── Band 1: Hero + interactive boundary instrument ── */}
      <motion.section style={{ opacity: heroOpacity }} className="relative overflow-hidden">
        {/* Background */}
        <div className="hero-glow absolute inset-0 z-0" />
        <div className="landing-grid absolute inset-0 z-0" />

        <div className="relative z-10 max-w-5xl mx-auto pt-28 pb-8 px-6">
          <div className="text-center mb-8">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium mb-8 border border-primary/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Governance for agentic work
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight max-w-3xl mx-auto"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Delegate consequential work.
              <br />
              <span className="text-primary">Keep judgment in the loop.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto mt-6 leading-relaxed"
            >
              Set the limits once. Agents handle routine spend; exceptions pause
              for your call — with public proof.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex gap-4 justify-center flex-wrap mt-8"
            >
              <Button variant="default" size="lg" onClick={handleTryDemo}>
                Try a governed request <ArrowRight />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => router.push("/verify?report=supplier-diligence")}
              >
                Inspect a live run <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          </div>

          {/* Interactive first-use moment */}
          <motion.div
            id="live-demo"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-3xl mx-auto scroll-mt-24"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold">Incoming agent request</p>
                  <p className="text-xs text-muted-foreground">Pay an approved vendor</p>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  aria-live="polite"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      demoResult.status === "approved"
                        ? "bg-emerald-500"
                        : demoResult.status === "held"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    aria-hidden
                  />
                  {decisionLabel(demoResult.status)}
                </span>
              </div>
              <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                <div className="p-5 md:border-r md:border-border">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Requested amount</span>
                    <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>${demoAmount}</span>
                  </div>
                  <BoundaryBar
                    className="mt-6"
                    approveLimit={DEMO_APPROVE_THRESHOLD}
                    hardLimit={DEMO_HARD_LIMIT}
                    maxDisplay={5000}
                    value={demoAmount}
                    interactive
                    onChange={setDemoAmount}
                  />
                </div>
                <div className="relative p-5">
                  <div className="pointer-events-none absolute right-3 top-3 z-10">
                    <DecisionStamp decision={demoResult.status} />
                  </div>
                  <DecisionPreview
                    decision={demoResult.status}
                    amount={demoAmount}
                    reasoning={demoResult.reason}
                  />
                  <div className="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                    {demoResult.status === "approved" ? "Recorded for review" : "Reason recorded for review"}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Brand motif: every governed action is a link in a chain of
              evidence that ends in a tamper-evident record. */}
          <EvidenceChain
            stages={["Mandate", "Action", "Spend", "Evidence"]}
            labeled
            className="mt-10"
          />
        </div>
      </motion.section>

      {/* ── Band 2: Proof, not promise ── */}
      <ProofFlip />

      {/* ── Band 3: Interactive loop explorer ── */}
      <LoopExplorer />

      {/* ── Band 4: Use cases + developer API ── */}
      <UseCaseApi />

      {/* ── Band 5: Audience doors ── */}
      <AudienceDoors />

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="hero-glow absolute inset-0 z-0 opacity-50" />
        <div className="landing-grid absolute inset-0 z-0 opacity-50" />
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2
              className="text-3xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Start with one governed action.
            </h2>
            <div className="flex gap-4 justify-center flex-wrap mt-8">
              <Button variant="default" size="lg" onClick={handleTryDemo}>
                Run a governed request <ExternalLink className="h-4 w-4 ml-1" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() =>
                  hasHydrated && (isAppAuthenticated || walletConnected)
                    ? router.push("/dashboard")
                    : setShowAuthModal(true)
                }
              >
                {hasHydrated && (isAppAuthenticated || walletConnected)
                  ? "Open Dashboard"
                  : "Sign In"}{" "}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-primary font-semibold">Cognivern</span>
              <span className="text-border">|</span>
              <span>Governance for agentic work</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a
                href="https://github.com/thisyearnofear/cognivern"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <span className="hidden sm:inline">·</span>
              <a
                href="https://github.com/thisyearnofear/cognivern/blob/main/docs/DEV.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Architecture
              </a>
              <span className="hidden sm:inline">·</span>
              <a
                href="https://github.com/thisyearnofear/cognivern/blob/main/docs/DEPLOYMENT.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Deploy
              </a>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground/60 pt-4">
            Built for autonomous agent governance
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
