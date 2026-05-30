"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  Zap,
  Globe,
  Lock,
  Eye,
  Shield,
  Sparkles,
  FileText,
  HelpCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShieldLogo } from "@/components/landing/shield-logo";
import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/stores/app-store";

export function LandingPage() {
  const router = useRouter();
  const { signIn, loading } = useAuth();
  const enableDemoMode = useAppStore((s) => s.enableDemoMode);
  const demoMode = useAppStore((s) => s.demoMode);
  const onboardingCompleted = useAppStore(
    (s) => s.preferences.onboardingCompleted,
  );
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Redirect onboarded or demo-mode users straight to the dashboard
  useEffect(() => {
    if (demoMode || onboardingCompleted) {
      router.push("/dashboard");
    }
  }, [demoMode, onboardingCompleted, router]);

  const handleConnectWallet = async () => {
    try {
      await signIn();
      router.push("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleTryDemo = () => {
    enableDemoMode();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Shield className="h-6 w-6 text-primary" />
          Cognivern
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-full text-xs group relative">
            <Shield size={10} />
            OWS
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Open Wallet Standard — decentralized key custody for agents
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900 dark:border-t-stone-100"></span>
            </span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-full text-xs">
            ✦ Cogni-vern: governance for the cognitive age
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAuthModal(true)}
            className="gap-1.5"
          >
            <User className="h-4 w-4" />
            Sign In
          </Button>
          {loading ? (
            <Button variant="default" size="sm" disabled>
              Connecting...
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleConnectWallet}>
              Connect Wallet
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto pt-32 pb-20 px-6 text-center">
        {/* Shield Logo */}
        <motion.div
          className="w-24 h-28 mx-auto mb-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <ShieldLogo />
        </motion.div>

        <span className="inline-block px-3 py-1.5 bg-stone-900 dark:bg-stone-50 text-sky-400 dark:text-sky-500 rounded-full text-sm font-semibold mb-6">
          For teams running AI agents that move money
        </span>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-stone-900 dark:text-stone-50 leading-tight mb-4">
          Govern every agent transaction.{" "}
          <span className="text-primary">Without slowing builders down.</span>
        </h1>

        <p className="text-lg text-stone-500 max-w-lg mx-auto mb-8">
          Checks every spend against your policy, holds risky moves for review,
          and gives you cryptographic audit evidence — in under 100ms.
        </p>

        <div className="flex gap-4 justify-center flex-wrap mb-8">
          <Button
            variant="default"
            size="lg"
            onClick={handleConnectWallet}
            className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-lg"
          >
            Connect Wallet <ArrowRight />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/onboarding")}
          >
            Set Up My Treasury <Zap />
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleTryDemo}
            className="border-sky-200 dark:border-sky-800"
          >
            <Sparkles className="h-4 w-4 mr-1" /> Try Demo
          </Button>
        </div>

        <div className="text-xs text-stone-400 mb-12">
          <span className="text-emerald-500">✓</span> Demo opens instantly.
          <span className="font-semibold text-primary">
            {" "}
            No signup, no wallet
          </span>{" "}
          — sample data to explore the flow.
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-10 flex-wrap mb-16">
          {[
            { label: "Multi-Chain", value: "4 Networks" },
            { label: "Avg. Response", value: "<100ms" },
            { label: "Wallet Setup", value: "<2 min" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-sm text-stone-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          {[
            {
              title: "Governed Wallet Access",
              desc: "Connect your treasury and let agents request spend within a controlled approval flow.",
              icon: Globe,
            },
            {
              title: "Policy Guardrails",
              desc: "Set limits, require approvals, block risky actions before money moves.",
              icon: ShieldLogo,
            },
            {
              title: "Scoped Permissions",
              desc: "Grant agents limited access with revocable keys.",
              icon: Lock,
            },
            {
              title: "Audit Evidence",
              desc: "Review every governed decision with cryptographic proof.",
              icon: Eye,
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl bg-white dark:bg-stone-900 border border-border hover:border-sky-200 dark:hover:border-sky-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950 flex items-center justify-center text-primary mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-stone-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Use Cases */}
        <div className="mt-16 text-left">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Built for agents that move value
          </h2>
          <p className="text-sm text-stone-500 mb-6">
            Any autonomous agent that spends, swaps, stakes, or transfers
            on-chain can be governed by Cognivern.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: "DeFi Trading Bots",
                desc: "Enforce per-trade limits, restrict to allowlisted DEXs, cap daily volume.",
                example: "Swap 2,000 USDC → ETH on Uniswap",
              },
              {
                title: "Yield Optimizers",
                desc: "Approve deposit/withdraw within budget, block unknown protocols.",
                example: "Deposit 10,000 USDC into Aave v3",
              },
              {
                title: "Portfolio Rebalancers",
                desc: "Gate rebalances above a threshold, require multi-sig for large moves.",
                example: "Rebalance $50k across 4 vaults",
              },
              {
                title: "Payment Agents",
                desc: "Cap per-payment and daily totals, restrict recipient addresses.",
                example: "Pay 500 USDC to vendor wallet",
              },
              {
                title: "DAO Treasury Agents",
                desc: "Enforce proposal-linked budgets, require quorum for large disbursements.",
                example: "Fund grant #42 with 3 ETH",
              },
              {
                title: "Cross-Chain Bridges",
                desc: "Limit bridge amounts, restrict destination chains, flag unusual routes.",
                example: "Bridge 5,000 USDC to Arbitrum",
              },
            ].map((uc) => (
              <div
                key={uc.title}
                className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-border hover:border-primary/30 transition-colors"
              >
                <h3 className="font-semibold text-sm text-foreground mb-1">
                  {uc.title}
                </h3>
                <p className="text-xs text-stone-500 mb-3">{uc.desc}</p>
                <div className="text-[11px] font-mono text-primary/70 bg-primary/5 rounded px-2 py-1.5">
                  {uc.example}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Who is this for + Trust signals merged */}
        <div className="mt-16 text-left">
          <h2 className="text-xl font-bold text-foreground mb-6">
            Who uses Cognivern?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                who: "Crypto Funds",
                why: "Constrain trading bots to pre-approved strategies and limits before they touch the treasury.",
                signal: "Cryptographic audit proof for every decision",
              },
              {
                who: "Agent Developers",
                why: "Ship autonomous agents that customers trust — governance is built in, not bolted on.",
                signal: "Real-time policy enforcement in <100ms",
              },
              {
                who: "DAOs & Multisigs",
                why: "Let operational agents execute within proposal-linked budgets without manual signing.",
                signal: "Human-in-the-loop for high-value moves",
              },
            ].map((persona) => (
              <div
                key={persona.who}
                className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-border space-y-3"
              >
                <div className="text-sm font-semibold text-foreground">
                  {persona.who}
                </div>
                <p className="text-xs text-stone-500">{persona.why}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <div className="text-emerald-600 flex-shrink-0 text-xs">
                    ✓
                  </div>
                  <span className="text-[11px] text-stone-500">
                    {persona.signal}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Chain */}
        <div className="mt-16 p-8 rounded-2xl bg-stone-900 dark:bg-stone-900 border border-stone-800 text-left">
          <div className="flex items-center gap-2 mb-6">
            <Globe size={20} className="text-sky-400" />
            <h2 className="text-lg font-semibold text-sky-400">
              Multi-Chain Architecture
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { chain: "X Layer", role: "Execution", color: "text-sky-400" },
              {
                chain: "Filecoin",
                role: "Audit Archive",
                color: "text-purple-400",
              },
              {
                chain: "0G Network",
                role: "Live Audit",
                color: "text-emerald-400",
              },
              {
                chain: "Fhenix",
                role: "Confidential Compute",
                color: "text-amber-400",
              },
            ].map((c) => (
              <div key={c.chain} className="flex items-start gap-2">
                <div>
                  <span className={`font-semibold text-sm ${c.color}`}>
                    {c.chain}
                  </span>
                  <span className="text-stone-500 text-sm ml-1">
                    ({c.role})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FHE Education */}
        <div className="mt-16 text-left">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={20} className="text-primary" />
            <h2 className="text-xl font-bold text-foreground">
              Built on Confidential Computing
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-white dark:bg-stone-900 border border-border">
              <h3 className="font-semibold text-foreground mb-3">
                What is FHE?
              </h3>
              <p className="text-sm text-stone-500 mb-4">
                Fully Homomorphic Encryption lets computations run on encrypted data 
                without ever decrypting it. Your financial data stays private — 
                even from Cognivern servers.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-xs rounded-md">
                  Privacy by default
                </span>
                <span className="px-2 py-1 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-xs rounded-md">
                  Cryptographically secure
                </span>
                <span className="px-2 py-1 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 text-xs rounded-md">
                  &lt;100ms evaluation
                </span>
              </div>
            </div>
            <div className="p-6 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-100 dark:border-sky-800">
              <h3 className="font-semibold text-foreground mb-3">
                How it protects you
              </h3>
              <ul className="space-y-2 text-sm text-stone-500">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  Transaction amounts encrypted end-to-end
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  Wallet balances never exposed to servers
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  Policy logic evaluated on encrypted inputs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  Verifiable proofs without data exposure
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("https://docs.cognivern.xyz/fhe", "_blank")}
              className="gap-2 text-sky-600 dark:text-sky-400"
            >
              <HelpCircle className="h-4 w-4" />
              Learn more about FHE
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("https://docs.cognivern.xyz/architecture", "_blank")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Technical docs
            </Button>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">
            See it before you set it up.
          </h2>
          <p className="text-stone-500 max-w-md mx-auto mb-6">
            Watch a live spend-flow demo — see how policies, governance checks,
            and audit trails work in real-time. When you&apos;re ready, the same
            screens work with your own treasury.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="default"
              size="lg"
              onClick={handleTryDemo}
              className="bg-gradient-to-r from-sky-600 to-blue-600"
            >
              Open Live Demo →
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center">
        <div className="flex justify-center gap-6 mb-4 flex-wrap text-sm">
          <a
            href="https://github.com/thisyearnofear/cognivern"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GitHub
          </a>
          <span className="text-stone-500">
            Multi-Chain: X Layer + Filecoin + 0G + Fhenix
          </span>
          <span className="text-stone-500">Open Wallet Standard Compliant</span>
        </div>
        <div className="text-sm text-stone-500">
          <span className="text-primary font-semibold">
            Powered by ChainGPT AI
          </span>{" "}
          — Built for autonomous agent governance
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
