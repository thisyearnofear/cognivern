"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Shield,
  Terminal,
  ChevronRight,
  Globe,
  Lock,
  Eye,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";
import { useDemoStore } from "@/stores/demo-store";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { DecisionPreview } from "@/components/governance/decision-preview";
import { useAccount } from "wagmi";
import {
  DEMO_APPROVE_THRESHOLD,
  DEMO_HARD_LIMIT,
  resolveDemoDecision,
  type DemoDecision,
} from "@cognivern/shared";

/**
 * Canonical public API origin for user-facing snippets (curl examples,
 * copy buttons, docs links). The frontend itself proxies /api/* through
 * Next.js rewrites, but external developers calling from their terminal
 * hit the backend directly — so display strings must point here, not at
 * the Vercel origin or the dead api.cognivern.xyz hostname.
 */
const PUBLIC_API_ORIGIN = "https://api.cognivern.persidian.com";

/* ─── Flow node component ───────────────────────────────────── */

function FlowNode({
  icon: Icon,
  title,
  subtitle,
  index,
  isLast,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="flex items-start gap-4 sm:gap-0 sm:flex-col sm:items-center sm:text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ delay: index * 0.15, duration: 0.5 }}
        className="flex items-center gap-4 sm:flex-col sm:items-center"
      >
        <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center text-primary border border-primary/20">
          <Icon size={22} />
        </div>
        <div className="sm:mt-3">
          <div className="font-semibold text-foreground text-base">{title}</div>
          <div className="text-sm text-muted-foreground mt-0.5 max-w-[220px]">
            {subtitle}
          </div>
        </div>
      </motion.div>
      {!isLast && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: index * 0.15 + 0.25, duration: 0.4 }}
          className="hidden sm:flex items-center justify-center w-12 flex-shrink-0"
        >
          <div className="w-8 h-px bg-primary/30" />
        </motion.div>
      )}
      {!isLast && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: index * 0.15 + 0.25 }}
          className="sm:hidden mt-1 ml-7"
        >
          <ChevronRight size={16} className="text-muted-foreground/40 rotate-90" />
        </motion.div>
      )}
    </div>
  );
}

/* ─── Counter animation hook ────────────────────────────────── */

function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration, start]);

  return count;
}

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
  const [copyFeedback, setCopyFeedback] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);

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

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 },
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const txCount = useCountUp(18, 2500, statsVisible);
  const policiesCount = useCountUp(3, 1500, statsVisible);

  const handleTryDemo = () => {            // Start in the denied band so the visitor immediately sees one of
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

  // Delight: a "decision stamp" pops over the live demo when the outcome
  // changes (e.g. dragging the slider past the $100 limit). Keyed by a
  // counter so every flip re-runs the stamp animation. Skipped entirely on
  // first render so the panel loads quietly.
  const reduceMotion = useReducedMotion();
  const [stampKey, setStampKey] = useState(0);
  const prevOutcomeRef = useRef(demoResult.status);

  useEffect(() => {
    if (prevOutcomeRef.current !== demoResult.status) {
      prevOutcomeRef.current = demoResult.status;
      setStampKey((k) => k + 1);
    }
  }, [demoResult.status]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyCurl = useCallback(() => {
    navigator.clipboard.writeText(
      `curl -X POST ${PUBLIC_API_ORIGIN}/api/governance/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{"agentId":"demo","action":{"type":"spend","metadata":{"amount":50}}}'`,
    );
    setCopyFeedback(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyFeedback(false), 2000);
  }, []);

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
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#use-cases" className="transition-colors hover:text-foreground">
            Use cases
          </a>
          <a href="#api" className="transition-colors hover:text-foreground">
            API
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live governance controls
          </span>
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

      {/* ── Hero ── */}
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
              Set the boundaries, let agents handle routine work, and step in when a
              decision needs judgment. Every action leaves a clear record.
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
                onClick={() =>
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                <ArrowRight className="h-4 w-4 mr-1.5 rotate-90" />
                See how it works
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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Checking policy
                </span>
              </div>
              <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                <div className="p-5 md:border-r md:border-border">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Requested amount</span>
                    <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>${demoAmount}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={5000}
                    step={10}
                    value={demoAmount}
                    onChange={(e) => setDemoAmount(Number(e.target.value))}
                    aria-label="Requested amount"
                    aria-valuetext={`$${demoAmount}`}
                    className="mt-6 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg"
                  />
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>$10</span><span>$5,000</span></div>
                  <p className="mt-5 text-sm text-muted-foreground">Drag past ${DEMO_APPROVE_THRESHOLD} to hold a request for review, or past ${DEMO_HARD_LIMIT.toLocaleString()} to stop it outright.</p>
                </div>
                <div className="relative p-5">
                  {stampKey > 0 && (
                    <motion.div
                      key={stampKey}
                      initial={reduceMotion ? false : { opacity: 0, scale: 2.4, rotate: -18 }}
                      animate={{ opacity: 1, scale: 1, rotate: -8 }}
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 22, mass: 0.8 }}
                      aria-hidden
                      className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center rounded-md border-2 border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-primary shadow-sm"
                    >
                      Decision updated
                    </motion.div>
                  )}
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
        </div>
      </motion.section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
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
            From agent request to accountable action
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Every consequential action follows the same clear path: define the
            boundary, evaluate the request, decide what happens, and keep the record.
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-center gap-8 sm:gap-0">
          <FlowNode
            icon={Terminal}
            title="Agent Request"
            subtitle="Agent sends spend intent with amount, asset, and recipient"
            index={0}
            isLast={false}
          />
          <FlowNode
            icon={Shield}
            title="Policy Evaluation"
            subtitle="Real-time rule checks — deny, approve, or hold for review"
            index={1}
            isLast={false}
          />
          <FlowNode
            icon={Globe}
            title="Accountable Record"
            subtitle="Approved spends receive a tamper-evident record your team can review."
            index={2}
            isLast={false}
          />
          <FlowNode
            icon={Eye}
            title="Audit Trail"
            subtitle="A durable activity trail for reviews, investigations, and reporting."
            index={3}
            isLast={true}
          />
        </div>
      </section>

      {/* ── Jobs to be done ── */}
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
              Built for the moments that matter
            </span>
            <h2
              className="text-3xl font-bold text-foreground mt-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Let agents handle more. Keep judgment where it matters.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              Cognivern gives teams a clear answer at the moment an agent asks to do something consequential — without turning every routine action into a meeting.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Shield, title: "Set limits", body: "Give every agent a clear budget, approved recipients, and actions it can take without asking.", note: "Stop overspending before it starts." },
              { icon: Eye, title: "Review exceptions", body: "Route high-risk or unusual actions to the right person instead of blindly letting them through.", note: "Keep human judgment for the moments that need it." },
              { icon: Terminal, title: "Investigate decisions", body: "See what the agent attempted, which policy applied, and the evidence behind every decision.", note: "Answer “what happened?” without guesswork." },
            ].map((job, index) => (
              <motion.div
                key={job.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><job.icon size={18} /></div>
                <h3 className="mt-4 text-lg font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>{job.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{job.body}</p>
                <p className="mt-5 border-t border-border pt-3 text-xs font-medium text-foreground">{job.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section ref={statsRef} className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex justify-center gap-12 sm:gap-24 flex-wrap">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div
                className="text-4xl font-bold text-primary"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {txCount}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Agent decisions recorded</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">A clear record for review</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div
                className="text-4xl font-bold text-primary"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {policiesCount}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Active policies</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                Enforcing spend rules in real-time
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div
                className="text-4xl font-bold text-primary"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {"<"}1min
              </div>
              <div className="text-sm text-muted-foreground mt-1">Time to first governed action</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                Sign up → set a policy → try a scenario
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── "Prove It" Section ── */}
      <section id="api" className="border-t border-border bg-muted/30 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span
              className="text-xs font-semibold text-primary uppercase tracking-widest"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              For developers
            </span>
            <h2
              className="text-3xl font-bold text-foreground mt-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Connect the control plane to your system
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Add one governance check before an agent takes a consequential action. Sign in to get an API key for your workspace, or try the live demo to see the decision boundary first.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="rounded-xl border border-border bg-[#0A0A0A] dark:bg-black overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <span className="text-[11px] text-white/40 font-medium">bash</span>
                <button
                  onClick={handleCopyCurl}
                  aria-label="Copy curl command"
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  {copyFeedback ? (
                    <span className="text-emerald-400 text-xs">Copied!</span>
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              <pre
                className="p-5 text-sm leading-relaxed text-white/80 overflow-x-auto"
                style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
              >
{`# Evaluate a spend against the active policy
# Replace $KEY with your workspace API key (x-api-key header)
curl -X POST ${PUBLIC_API_ORIGIN}/api/governance/evaluate \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $KEY" \\
  -d '{
    "agentId": "demo",
    "action": {
      "type": "spend",
      "amount": 50,
      "currency": "USDC"
    }
  }'`}
              </pre>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-xs text-emerald-500 font-semibold mb-2">Example response (amount under $100 → approved):</div>
              <pre
                className="text-xs text-foreground/70 leading-relaxed"
                style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
              >
{`{
  "success": true,
  "data": {
    "allowed": true,
    "decision": "approved",
    "reasoning": "Approved — passed 2 policy check(s)",
    "policyChecks": [
      { "policyId": "policy-budget", "result": true, "reason": "Within $3000 hard limit" },
      { "policyId": "policy-approval", "result": true, "reason": "Under $100 auto-approval threshold" }
    ],
    "auditLogId": "log-demo-2026-07-25T12-00-00",
    "timestamp": "2026-07-25T12:00:00.000Z"
  }
}`}
              </pre>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Connect the systems you already run. Cognivern governs the action before it moves and preserves the evidence afterward.{" "}
              <a
                href="https://github.com/thisyearnofear/cognivern/blob/main/docs/DEV.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                See the architecture &amp; deployed networks →
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Use Cases — Alternating Rows ── */}
      <section id="use-cases" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span
            className="text-xs font-semibold text-primary uppercase tracking-widest"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Use cases
          </span>
          <h2
            className="text-3xl font-bold text-foreground mt-3"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
              Delegate the work you already understand
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Begin with one consequential workflow, prove the guardrails work, then expand with confidence.
          </p>
        </motion.div>

        <div className="space-y-6">
          {[
            {
              title: "Payment agents",
              desc: "Set per-payment and daily limits, restrict recipients, and hold unusual requests for review.",
              example: "Pay a new vendor $500 — held for approval",
              icon: Globe,
            },
            {
              title: "Procurement agents",
              desc: "Run confidential vendor selections with a clear record of the process and outcome.",
              example: "Select a security vendor — competing bids stay private",
              icon: Terminal,
            },
            {
              title: "Operations agents",
              desc: "Let routine work proceed automatically while sensitive changes and purchases require the right review.",
              example: "Upgrade a customer plan — approved within the agent's limit",
              icon: Lock,
            },
            {
              title: "Financial agents",
              desc: "Apply strict rules to trading, treasury, and transfer workflows without slowing every routine decision.",
              example: "Move $2,000 to a new protocol — blocked by policy",
              icon: Eye,
            },
          ].map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`flex flex-col sm:flex-row gap-5 p-6 ${
                i % 2 === 0 ? "" : "sm:flex-row-reverse"
              }`}
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <uc.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-foreground text-base"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {uc.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{uc.desc}</p>
              </div>
              <div className="flex-shrink-0 sm:w-64">
                <div className="text-[11px] font-mono text-primary/70 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 leading-relaxed">
                  {uc.example}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 border-t border-border pt-10">
          <span
            className="text-xs font-semibold text-primary uppercase tracking-widest"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Who it&apos;s for
          </span>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { label: "AI product teams", desc: "Ship agents that customers can trust with consequential work" },
              { label: "Operations teams", desc: "Delegate routine work without surrendering oversight" },
              { label: "Financial teams", desc: "Keep spending agents inside explicit limits" },
            ].map((persona) => (
              <div
                key={persona.label}
                className="rounded-xl border border-border bg-card p-5 text-center"
              >
                <h3 className="text-sm font-semibold text-foreground">{persona.label}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{persona.desc}</p>
              </div>
            ))}
          </div>
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
              Start with one governed action.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
              Prove the boundary with a realistic request, then connect the same
              controls to your own agents and workflows.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
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
            Built for autonomous agent governance · Powered by{" "}
            <a
              href="https://chaingpt.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ChainGPT AI
            </a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
