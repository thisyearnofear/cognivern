'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck,
  Wallet,
  Users,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '@/hooks/use-auth';

const STEPS = [
  {
    id: 'wallet',
    title: 'Connect Wallet',
    description: 'Link your wallet to start governing agent spend',
    icon: Wallet,
  },
  {
    id: 'policy',
    title: 'Create First Policy',
    description: 'Set up guardrails for agent spending',
    icon: ShieldCheck,
  },
  {
    id: 'agent',
    title: 'Register Agent',
    description: 'Give an agent a wallet and budget',
    icon: Users,
  },
  {
    id: 'done',
    title: 'Ready to Go',
    description: 'Your treasury is up and running',
    icon: PlayCircle,
  },
];

const POLICY_TEMPLATES = [
  { id: 'strict', name: 'Strict', desc: 'Max $100/day, manual approval above $500' },
  { id: 'moderate', name: 'Moderate', desc: 'Max $500/day, auto-approve under $1,000' },
  { id: 'relaxed', name: 'Relaxed', desc: 'Max $2,000/day, auto-approve all' },
];

export function OnboardingWizard() {
  const router = useRouter();
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const { isConnected, address } = useAccount();
  const { signIn } = useAuth();
  const user = useAppStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [selectedPolicy, setSelectedPolicy] = useState('moderate');
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    if (isConnected && !user.isConnected && address) {
      signIn().catch(() => {});
    }
  }, [isConnected, user.isConnected, address, signIn]);

  function handleFinish() {
    updatePreferences({ onboardingCompleted: true });
    router.push('/dashboard');
  }

  function handleSkip() {
    updatePreferences({ onboardingCompleted: true });
    router.push('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Set Up Your Treasury</h1>
        <p className="text-muted-foreground mt-2">
          Configure governance for your agent team in 3 steps
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <s.icon className="h-3.5 w-3.5" />
              )}
              {s.title}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Wallet className="h-12 w-12 mx-auto mb-3 text-primary opacity-70" />
                <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Link a wallet to create and manage governance policies
                </p>
              </div>
              {user.isConnected ? (
                <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="font-medium">
                    Wallet connected: {user.walletAddress?.slice(0, 6)}...
                    {user.walletAddress?.slice(-4)}
                  </span>
                </div>
              ) : (
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-primary opacity-70" />
                <h2 className="text-xl font-semibold">Choose a Policy Template</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Start with a preset or customize later
                </p>
              </div>
              <div className="grid gap-3">
                {POLICY_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedPolicy(t.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedPolicy === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-sky-200'
                    }`}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <Users className="h-12 w-12 mx-auto mb-3 text-primary opacity-70" />
                <h2 className="text-xl font-semibold">Name Your First Agent</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This agent will be governed by your policy
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="agent-name" className="text-sm font-medium">
                  Agent Name
                </label>
                <Input
                  id="agent-name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. MyTrader-01"
                />
              </div>
              {agentName && (
                <div className="p-3 rounded-lg bg-muted/30 text-sm">
                  <div className="font-medium text-xs text-muted-foreground mb-1">Summary</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{agentName}</Badge>
                    <span className="text-muted-foreground">with</span>
                    <Badge>{POLICY_TEMPLATES.find((t) => t.id === selectedPolicy)?.name}</Badge>
                    <span className="text-muted-foreground">policy</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-semibold">All Set!</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your treasury is configured with a{' '}
                {POLICY_TEMPLATES.find((t) => t.id === selectedPolicy)?.name.toLowerCase()} policy
                {agentName ? ` and agent "${agentName}"` : ''}.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Policy active
                <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-2" /> Agent registered
                <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-2" /> Ready to govern
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleSkip}>
          Skip setup
        </Button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish}>
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
