"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Shield,
  Terminal,
  ChevronRight,
  Globe,
  Lock,
  Eye,
  FileText,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/auth-modal";
import { useDemoStore, startDemoTour } from "@/stores/demo-store";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useAccount } from "wagmi";

/* ─── Terminal typing hook ──────────────────────────────────── */

function useTypewriter(lines: string[], speed = 40, _initialDelay?: number) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentLine >= lines.length) {
        setDone(true);
        return;
      }
      const line = lines[currentLine];
      if (currentChar < line.length) {
        setDisplayed((prev) => {
          const copy = [...prev];
          if (copy.length <= currentLine) copy.push("");
          copy[currentLine] = line.slice(0, currentChar + 1);
          return copy;
        });
        setCurrentChar((c) => c + 1);
      } else {
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }
    }, currentChar === 0 && currentLine > 0 ? speed * 8 : speed);

    return () => clearTimeout(timer);
  }, [currentLine, currentChar, lines, speed]);

  return { displayed, done };
}

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

  const handleTryDemo = () => {
    startDemoTour((path) => router.push(path));
  };

  // Terminal lines
  const terminalLines = [
    "$ curl -X POST https://cognivern.thisyearnofear.com/api/spend \\",
    '  -H "x-api-key: sapience-hackathon-key" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"agentId":"demo-bot","amount":"25","asset":"USDC"}\'',
    "",
    "→ Policy: OWS Spend Governance Policy",
    "→ Evaluating rules...",
    "✓ Approved — tx broadcast to X Layer",
    "→ txHash: 0x6942...c0",
    "→ https://oklink.com/xlayer-test/tx/... ↗",
  ];

  const { displayed: terminalOutput, done: terminalDone } = useTypewriter(terminalLines, 35, 600);

  // Demo evaluation — deterministic hash based on amount
  const demoResult = (() => {
    if (demoAmount < 100) {
      const hash = ((demoAmount * 2654435761) ^ 0x6942d4bf) >>> 0;
      return { status: "approved" as const, txHash: `0x${hash.toString(16).padStart(8, "0")}...` };
    }
    return { status: "denied" as const, reason: "Amount exceeds hard limit of $100" };
  })();

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyCurl = useCallback(() => {
    navigator.clipboard.writeText(
      `curl -X POST https://cognivern.thisyearnofear.com/api/governance/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{"agentId":"demo","action":{"type":"spend","metadata":{"amount":50}}}'`,
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
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live on Arbitrum · Robinhood · X Layer
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
              Every approval writes a real on-chain transaction
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight max-w-3xl mx-auto"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Govern every agent spend.
              <br />
              <span className="text-primary">With real on-chain proof.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto mt-6 leading-relaxed"
            >
              Policy checks, wallet controls, and cryptographic audit — every approved
              transaction writes to a governed smart contract on-chain. Not a simulated
              hash. A real tx, with real gas, on X Layer testnet.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex gap-4 justify-center flex-wrap mt-8"
            >
              <Button variant="default" size="lg" onClick={handleTryDemo}>
                Try Live Demo <ArrowRight />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() =>
                  window.open(
                    "https://github.com/thisyearnofear/cognivern/blob/main/docs/ARCHITECTURE.md",
                    "_blank",
                  )
                }
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Architecture
              </Button>
            </motion.div>
          </div>

          {/* Animated Terminal */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-2xl mx-auto"
          >
            <div className="rounded-xl border border-border bg-[#0A0A0A] dark:bg-black overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-[11px] text-white/40 font-medium">
                  cognivern — spend request
                </span>
              </div>
              <div className="p-5 overflow-x-auto">
                <pre
                  className="text-sm leading-relaxed text-white/80"
                  style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
                >
                  {terminalOutput.map((line, i) => (
                    <div key={i} className="whitespace-pre">
                      {line.startsWith("→") ? (
                        <span className="text-amber-400/90">{line}</span>
                      ) : line.startsWith("✓") ? (
                        <span className="text-emerald-400">{line}</span>
                      ) : line.startsWith("$") ? (
                        <span>
                          <span className="text-emerald-400">$</span>
                          {line.slice(1)}
                        </span>
                      ) : (
                        line
                      )}
                    </div>
                  ))}
                  {!terminalDone && (
                    <span className="inline-block w-2 h-4 bg-white/60 ml-0.5 animate-pulse" />
                  )}
                  {terminalDone && (
                    <span className="text-emerald-400/60 text-xs mt-2 block">
                      ✓ Live — view on{" "}
                      <a
                        href="https://www.oklink.com/xlayer-test"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-emerald-300"
                      >
                        X Layer explorer
                      </a>
                    </span>
                  )}
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Flow Diagram ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
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
            From agent request to on-chain proof
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Every spend flows through the same pipeline. No shortcuts, no simulations.
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
            title="On-Chain Record"
            subtitle="Approved writes to GovernanceContract on X Layer. Real tx, real gas."
            index={2}
            isLast={false}
          />
          <FlowNode
            icon={Eye}
            title="Audit Trail"
            subtitle="Dual on-chain + MongoDB trail. Verifiable forever."
            index={3}
            isLast={true}
          />
        </div>
      </section>

      {/* ── Interactive Demo ── */}
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
              Try it
            </span>
            <h2
              className="text-3xl font-bold text-foreground mt-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              See the policy in action
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              Drag the slider. Watch the policy evaluate in real time.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            {/* Controls */}
            <div className="bg-background rounded-xl border border-border p-6 mb-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm font-medium text-foreground">Agent</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    cognivern-demo-agent
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">Asset</div>
                  <div className="text-xs text-muted-foreground mt-0.5">USDC</div>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Spend Amount</span>
                  <span
                    className={`font-bold text-lg ${
                      demoResult.status === "approved"
                        ? "text-emerald-500"
                        : "text-red-500"
                    }`}
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                  >
                    ${demoAmount}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={demoAmount}
                  onChange={(e) => setDemoAmount(Number(e.target.value))}
                  aria-label="Spend amount"
                  aria-valuetext={`$${demoAmount}`}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>$10</span>
                  <span>$500</span>
                </div>
              </div>
            </div>

            {/* Result */}
            <div
              className={`rounded-xl border p-5 transition-colors duration-300 ${
                demoResult.status === "approved"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    demoResult.status === "approved"
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    demoResult.status === "approved"
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {demoResult.status === "approved"
                    ? "Approved — broadcasting to X Layer"
                    : `Denied — ${demoResult.reason}`}
                </span>
              </div>
              <pre
                className="text-xs text-foreground/70 mt-2"
                style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
              >
                {demoResult.status === "approved"
                  ? `→ Policy: OWS Spend Governance Policy\n→ Rule: auto-approve (< $100)\n→ txHash: ${demoResult.txHash}`
                  : `→ Policy: OWS Spend Governance Policy\n→ Rule: deny-over-hard-limit\n→ Action: blocked`}
              </pre>
            </div>
          </motion.div>
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
              <div className="text-sm text-muted-foreground mt-1">On-chain actions recorded</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">X Layer GovernanceContract</div>
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
              <div className="text-sm text-muted-foreground mt-1">Time to first on-chain tx</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                Bootstrap wallet → API key → spend
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Multi-Chain Pipeline ── */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
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
              Network architecture
            </span>
            <h2
              className="text-3xl font-bold text-foreground mt-3"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Each network has a specific role
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                network: "Arbitrum Sepolia",
                role: "Governance",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
                desc: "GovernanceContract + GovernedVault deployed and live on Arbitrum (chain 421614). Policy-checked spends and governed execution settle on-chain.",
                status: "Live — Gov + Vault",
              },
              {
                network: "Robinhood Chain",
                role: "Governance",
                color: "text-green-400",
                bg: "bg-green-500/10",
                border: "border-green-500/20",
                desc: "Same GovernanceContract + GovernedVault deployed to Robinhood Chain Testnet, an Arbitrum Orbit chain (chain 46630). One control plane, portable across Orbit rollups.",
                status: "Live — Gov + Vault",
              },
              {
                network: "X Layer",
                role: "Execution",
                color: "text-sky-400",
                bg: "bg-sky-500/10",
                border: "border-sky-500/20",
                desc: "Governed transaction dispatch. Every approved spend writes to GovernanceContract.evaluateAction(). Real gas, real txHash, real block confirmation.",
                status: "Live — 18 txns",
              },
              {
                network: "Filecoin",
                role: "Audit Archive",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
                border: "border-purple-500/20",
                desc: "GovernanceContract deployed on FVM Calibration testnet. Audit evidence anchoring via AIGovernanceStorage in progress.",
                status: "Calibration testnet",
              },
              {
                network: "0G",
                role: "Live Audit Streaming",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
                desc: "Real-time governance decision anchoring to 0G decentralized storage for immediate availability.",
                status: "Newton testnet",
              },
              {
                network: "Fhenix / FHE",
                role: "Confidential Compute",
                color: "text-amber-400",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20",
                desc: "ConfidentialSpendPolicy deployed on Arbitrum Sepolia. FHE keeps spend amounts and wallet balances encrypted end-to-end; encrypted evaluation resumes when the Fhenix co-processor is re-exposed.",
                status: "Arb Sepolia · FHE eval pending",
              },
              {
                network: "MongoDB",
                role: "Persistent Memory",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
                desc: "Optional durable storage for agent memory, policy configurations, and run ledger alongside the JSONL hot cache.",
                status: "Atlas — Live",
              },
            ].map((net, i) => (
              <motion.div
                key={net.network}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={`flex items-start gap-4 p-4 rounded-lg ${net.bg} ${net.border} border`}
              >
                <div className="flex-shrink-0 w-24 text-right">
                  <div className={`font-semibold text-sm ${net.color}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
                    {net.network}
                  </div>
                  <div className="text-[11px] text-muted-foreground/70">{net.role}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/80 leading-relaxed">{net.desc}</p>
                </div>
                <div className="flex-shrink-0 hidden sm:block">
                  <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">
                    {net.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── "Prove It" Section ── */}
      <section className="border-t border-border bg-muted/30">
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
              Test it from your terminal
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              No signup needed. The demo API key works right now on our live endpoint.
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
curl -X POST https://cognivern.thisyearnofear.com/api/governance/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "demo",
    "action": {
      "type": "spend",
      "metadata": { "amount": 50 }
    }
  }'`}
              </pre>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-xs text-emerald-500 font-semibold mb-2">Example response:</div>
              <pre
                className="text-xs text-foreground/70 leading-relaxed"
                style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
              >
{`{
  "approved": true,
  "policyId": "policy-1781185670152",
  "checks": [{ "rule": "auto-approve", "passed": true }],
  "txHash": "0x6942d4bf..." 
}`}
              </pre>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Use Cases — Alternating Rows ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
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
            Built for agents that move value
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Any autonomous agent that spends, swaps, stakes, or transfers on-chain.
          </p>
        </motion.div>

        <div className="space-y-6">
          {[
            {
              title: "DeFi Trading Bots",
              desc: "Enforce per-trade limits, restrict to allowlisted DEXs, cap daily volume. Every swap is policy-checked before execution.",
              example: "Swap 2,000 USDC → ETH on Uniswap — approved under daily limit",
              icon: Globe,
            },
            {
              title: "Payment Agents",
              desc: "Cap per-payment and daily totals, restrict recipient addresses. Auto-deny any attempt to send to an unknown address.",
              example: "Pay 500 USDC to vendor wallet — held because amount exceeds soft limit",
              icon: Terminal,
            },
            {
              title: "Yield Optimizers",
              desc: "Approve deposit/withdraw within budget, block unknown protocols. Policies evaluated in under 100ms.",
              example: "Deposit 10,000 USDC into Aave v3 — blocked, protocol not in allowlist",
              icon: Lock,
            },
            {
              title: "DAO Treasury Agents",
              desc: "Enforce proposal-linked budgets, require multi-sig for large disbursements. Transaction recorded on-chain for public verification.",
              example: "Fund grant #42 with 3 ETH — approved, on-chain tx at 0x6942...",
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
      </section>

      {/* ── Who It's For — Inline badges ── */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl font-bold text-foreground mb-8"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Who it&apos;s for
          </motion.h2>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "Crypto Funds", desc: "Constrain trading bots to pre-approved strategies" },
              { label: "Agent Developers", desc: "Ship agents customers trust — governance built in" },
              { label: "DAOs & Multisigs", desc: "Let ops execute within proposal-linked budgets" },
            ].map((persona) => (
              <motion.div
                key={persona.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="group relative px-5 py-3 rounded-full border border-border bg-background hover:border-primary/30 transition-colors cursor-default"
              >
                <span className="text-sm font-medium text-foreground">{persona.label}</span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  {persona.desc}
                </span>
              </motion.div>
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
              See it before you set it up.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
              Watch a live spend-flow demo — see policies, governance checks, and real
              on-chain transactions. When you&apos;re ready, the same screens work with
              your own treasury.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button variant="default" size="lg" onClick={handleTryDemo}>
                Open Live Demo <ExternalLink className="h-4 w-4 ml-1" />
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
              <span>Agent Governance Platform</span>
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
                href="https://github.com/thisyearnofear/cognivern/blob/main/docs/ARCHITECTURE.md"
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

          {/* Network dots visualization */}
          <div className="flex items-center justify-center gap-6 py-4 border-t border-border">
            {[
              { name: "Arbitrum", color: "bg-blue-400" },
              { name: "Robinhood", color: "bg-green-400" },
              { name: "X Layer", color: "bg-sky-400" },
              { name: "Filecoin", color: "bg-purple-400" },
              { name: "0G", color: "bg-emerald-400" },
              { name: "Fhenix", color: "bg-amber-400" },
              { name: "MongoDB", color: "bg-emerald-500" },
            ].map((net) => (
              <div key={net.name} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${net.color} animate-pulse`} aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground/70">{net.name}</span>
              </div>
            ))}
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
