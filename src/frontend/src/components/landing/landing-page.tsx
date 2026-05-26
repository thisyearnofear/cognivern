'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, Zap, Globe, Lock, Eye, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShieldLogo } from '@/components/landing/shield-logo';
import { useAuth } from '@/hooks/use-auth';

export function LandingPage() {
  const router = useRouter();
  const { signIn, loading } = useAuth();

  const handleConnectWallet = async () => {
    try {
      await signIn();
      router.push('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleTryDemo = () => {
    router.push('/demo/spend');
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
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-full text-xs">
            <Shield size={10} />
            OWS
          </span>
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
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <ShieldLogo />
        </motion.div>

        <span className="inline-block px-3 py-1.5 bg-stone-900 dark:bg-stone-50 text-sky-400 dark:text-sky-500 rounded-full text-sm font-semibold mb-6">
          For teams running AI agents that move money
        </span>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-stone-900 dark:text-stone-50 leading-tight mb-4">
          Govern every agent transaction.{' '}
          <span className="text-primary">Without slowing builders down.</span>
        </h1>

        <p className="text-lg text-stone-500 max-w-lg mx-auto mb-8">
          Checks every spend against your policy, holds risky moves for review, and gives you
          cryptographic audit evidence — in under 100ms.
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
          <Button variant="outline" size="lg" onClick={() => router.push('/onboarding')}>
            Set Up My Treasury <Zap />
          </Button>
        </div>

        <div className="text-xs text-stone-400 mb-12">
          <span className="text-emerald-500">✓</span> Demo opens instantly.
          <span className="font-semibold text-primary"> No signup, no wallet</span> — sample data to
          explore the flow.
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-10 flex-wrap mb-16">
          {[
            { label: 'Multi-Chain', value: '4 Networks' },
            { label: 'Avg. Response', value: '<100ms' },
            { label: 'Wallet Setup', value: '<2 min' },
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
              title: 'Governed Wallet Access',
              desc: 'Connect your treasury and let agents request spend within a controlled approval flow.',
              icon: Globe,
            },
            {
              title: 'Policy Guardrails',
              desc: 'Set limits, require approvals, block risky actions before money moves.',
              icon: ShieldLogo,
            },
            {
              title: 'Scoped Permissions',
              desc: 'Grant agents limited access with revocable keys.',
              icon: Lock,
            },
            {
              title: 'Audit Evidence',
              desc: 'Review every governed decision with cryptographic proof.',
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
            Any autonomous agent that spends, swaps, stakes, or transfers on-chain can be governed
            by Cognivern.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: 'DeFi Trading Bots',
                desc: 'Enforce per-trade limits, restrict to allowlisted DEXs, cap daily volume.',
                example: 'Swap 2,000 USDC → ETH on Uniswap',
              },
              {
                title: 'Yield Optimizers',
                desc: 'Approve deposit/withdraw within budget, block unknown protocols.',
                example: 'Deposit 10,000 USDC into Aave v3',
              },
              {
                title: 'Portfolio Rebalancers',
                desc: 'Gate rebalances above a threshold, require multi-sig for large moves.',
                example: 'Rebalance $50k across 4 vaults',
              },
              {
                title: 'Payment Agents',
                desc: 'Cap per-payment and daily totals, restrict recipient addresses.',
                example: 'Pay 500 USDC to vendor wallet',
              },
              {
                title: 'DAO Treasury Agents',
                desc: 'Enforce proposal-linked budgets, require quorum for large disbursements.',
                example: 'Fund grant #42 with 3 ETH',
              },
              {
                title: 'Cross-Chain Bridges',
                desc: 'Limit bridge amounts, restrict destination chains, flag unusual routes.',
                example: 'Bridge 5,000 USDC to Arbitrum',
              },
            ].map((uc) => (
              <div
                key={uc.title}
                className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-border hover:border-primary/30 transition-colors"
              >
                <h3 className="font-semibold text-sm text-foreground mb-1">{uc.title}</h3>
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
          <h2 className="text-xl font-bold text-foreground mb-6">Who uses Cognivern?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                who: 'Crypto Funds',
                why: 'Constrain trading bots to pre-approved strategies and limits before they touch the treasury.',
                signal: 'Cryptographic audit proof for every decision',
              },
              {
                who: 'Agent Developers',
                why: 'Ship autonomous agents that customers trust — governance is built in, not bolted on.',
                signal: 'Real-time policy enforcement in <100ms',
              },
              {
                who: 'DAOs & Multisigs',
                why: 'Let operational agents execute within proposal-linked budgets without manual signing.',
                signal: 'Human-in-the-loop for high-value moves',
              },
            ].map((persona) => (
              <div
                key={persona.who}
                className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-border space-y-3"
              >
                <div className="text-sm font-semibold text-foreground">{persona.who}</div>
                <p className="text-xs text-stone-500">{persona.why}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <div className="text-emerald-600 flex-shrink-0 text-xs">✓</div>
                  <span className="text-[11px] text-stone-500">{persona.signal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Chain */}
        <div className="mt-16 p-8 rounded-2xl bg-stone-900 dark:bg-stone-900 border border-stone-800 text-left">
          <div className="flex items-center gap-2 mb-6">
            <Globe size={20} className="text-sky-400" />
            <h2 className="text-lg font-semibold text-sky-400">Multi-Chain Architecture</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { chain: 'X Layer', role: 'Execution', color: 'text-sky-400' },
              { chain: 'Filecoin', role: 'Audit Archive', color: 'text-purple-400' },
              { chain: '0G Network', role: 'Live Audit', color: 'text-emerald-400' },
              { chain: 'Fhenix', role: 'Confidential Compute', color: 'text-amber-400' },
            ].map((c) => (
              <div key={c.chain} className="flex items-start gap-2">
                <div>
                  <span className={`font-semibold text-sm ${c.color}`}>{c.chain}</span>
                  <span className="text-stone-500 text-sm ml-1">({c.role})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">See it before you set it up.</h2>
          <p className="text-stone-500 max-w-md mx-auto mb-6">
            Watch a live spend-flow demo — see how policies, governance checks, and audit trails work in real-time.
            When you&apos;re ready, the same screens work with your own treasury.
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
          <span className="text-stone-500">Multi-Chain: X Layer + Filecoin + 0G + Fhenix</span>
          <span className="text-stone-500">Open Wallet Standard Compliant</span>
        </div>
        <div className="text-sm text-stone-500">
          <span className="text-primary font-semibold">Powered by ChainGPT AI</span> — Built for
          autonomous agent governance
        </div>
      </footer>
    </div>
  );
}
