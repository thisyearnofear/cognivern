'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  KeyRound,
  Loader2,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useAgents } from '@/hooks/use-api';
import { useDemoStore } from '@/stores/demo-store';
import { trackUxEvent } from '@/lib/ux-events';
import type { GovernanceEvaluation } from '@/lib/api-client';

interface SetupChecklistProps {
  hasPolicy: boolean;
  hasAgent: boolean;
  hasApiKey: boolean;
  hasGovernedRequest: boolean;
}

type SetupStep = {
  id: string;
  label: string;
  why: string;
  complete: boolean;
  href: string;
  action: string;
  time: string;
  icon: typeof ShieldCheck;
};

/**
 * Guided setup for first-time production users. Visible until all four
 * milestones are done. Designed to answer:
 *
 *   "I just switched to production — now what?"
 *
 * Key UX decisions:
 * - Each step explains *why*, not just *what*.
 * - Time estimates set expectations (~2 min total).
 * - When steps 1-3 are done, step 4 is completable inline (no nav away).
 * - A "Quick setup" button offers a one-click guided path.
 */
export function SetupChecklist({
  hasPolicy,
  hasAgent,
  hasApiKey,
  hasGovernedRequest,
}: SetupChecklistProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const steps: SetupStep[] = [
    {
      id: 'policy',
      label: 'Set spending rules',
      why: 'Policies decide what your agents can and can\'t do. Without one, governance checks have nothing to evaluate against.',
      complete: hasPolicy,
      href: '/policies',
      action: 'Create policy',
      time: '30s',
      icon: ShieldCheck,
    },
    {
      id: 'agent',
      label: 'Register your system',
      why: 'An API identity represents the bot, script, or app that will call the governance API. It gets its own audit trail.',
      complete: hasAgent,
      href: '/agents/workshop',
      action: 'Add identity',
      time: '30s',
      icon: Users,
    },
    {
      id: 'key',
      label: 'Create an API key',
      why: 'Your system authenticates with a workspace-scoped key (starts with cvn_). Paste it into your bot\'s config.',
      complete: hasApiKey,
      href: '/integrate',
      action: 'Generate key',
      time: '15s',
      icon: KeyRound,
    },
    {
      id: 'check',
      label: 'Run a governance check',
      why: 'Fire a test evaluation to see the approved/denied/held flow end-to-end. This proves the pipeline works.',
      complete: hasGovernedRequest,
      href: '/governance/check',
      action: 'Try it now',
      time: '15s',
      icon: PlayCircle,
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const allPrereqsDone = hasPolicy && hasAgent && hasApiKey;
  const nextStep = steps.find((s) => !s.complete);

  // All done — compact success state
  if (!nextStep) {
    return (
      <motion.section
        role="status"
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3.5 sm:px-5"
      >
        {!reducedMotion && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '400%' }}
            transition={{ duration: 1.8, ease: 'easeInOut' }}
          />
        )}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
          <motion.div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            initial={reducedMotion ? false : { scale: 0.85, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </motion.div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">You&apos;re fully set up</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Policy, identity, API key, and a real governance result are all in place. Connect your production system whenever you&apos;re ready.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push('/integrate')}>
            Integration guide
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.section>
    );
  }

  return (
    <section
      aria-label="Workspace setup"
      className="rounded-xl border border-primary/20 bg-card px-4 py-5 sm:px-5"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">
              {completedCount === 0
                ? 'Get running in under 2 minutes'
                : `${completedCount} of ${steps.length} done — keep going`}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            {completedCount === 0
              ? 'Four quick steps to connect your first governed system. Each one takes seconds.'
              : nextStep.id === 'check' && allPrereqsDone
                ? 'Everything is wired up. Run a test check below to confirm the pipeline works.'
                : `Next up: ${nextStep.label.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {completedCount}/{steps.length}
          </span>
          {completedCount === 0 && (
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 text-xs"
              onClick={() => router.push(nextStep.href)}
            >
              <Zap className="h-3 w-3" />
              Quick setup
            </Button>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="mt-4 space-y-1.5">
        {steps.map((step) => {
          const Icon = step.icon;
          const isNext = step === nextStep;
          const showInline = step.id === 'check' && isNext && allPrereqsDone;

          return (
            <div key={step.id}>
              <div
                className={`rounded-lg border p-3 transition-colors ${
                  step.complete
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : isNext
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-muted/10 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {step.complete ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      aria-label="Complete"
                    />
                  ) : (
                    <Circle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${isNext ? 'text-primary' : 'text-muted-foreground/40'}`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className={`text-xs font-semibold ${step.complete ? 'line-through text-muted-foreground' : ''}`}>
                        {step.label}
                      </span>
                      {!step.complete && (
                        <span className="text-[10px] text-muted-foreground/70">~{step.time}</span>
                      )}
                    </div>
                    {isNext && !showInline && (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {step.why}
                      </p>
                    )}
                  </div>
                  {isNext && !showInline && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2.5 text-[11px] shrink-0"
                      onClick={() => router.push(step.href)}
                    >
                      {step.action}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Inline governance check when steps 1-3 are done */}
              {showInline && <InlineGovernanceCheck />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Embedded mini governance check, shown when the user has completed policy +
 * identity + key but hasn't run a check yet. Instead of sending them to a
 * different page, they can fire one right here and see the result in context.
 */
function InlineGovernanceCheck() {
  const demoMode = useDemoStore((s) => s.demoMode);
  const { data: agents } = useAgents();
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<GovernanceEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentId = agents?.[0]?.id || 'unknown';

  const runCheck = useCallback(
    async (type: string, amount: number) => {
      setEvaluating(true);
      setError(null);
      setResult(null);
      trackUxEvent('primary_action_clicked', 'setup_inline_check', type);

      try {
        if (demoMode) {
          await new Promise((r) => setTimeout(r, 600));
          setResult({
            allowed: true,
            reasoning: `Demo: ${type} of $${amount} approved`,
            policyChecks: [{ policyId: 'demo', result: true, reason: 'Within limit' }],
            timestamp: new Date().toISOString(),
          });
        } else {
          const res = await apiClient.evaluateGovernance({
            agentId,
            action: { type, description: `Setup check: ${type}`, amount, currency: 'USDC' },
          });
          if (res.data) {
            setResult(res.data);
          } else {
            setError(res.error || 'No result returned');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Check failed');
      } finally {
        setEvaluating(false);
      }
    },
    [agentId, demoMode],
  );

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mt-1.5 rounded-lg border p-3 ${
          result.allowed
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-red-500/30 bg-red-500/5'
        }`}
      >
        <div className="flex items-center gap-2">
          {result.allowed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs font-semibold">
            {result.allowed ? 'Check passed — your pipeline works!' : 'Denied (as expected from your policy)'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground pl-6">
          {result.reasoning}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-[11px] text-muted-foreground mb-2.5">
        Everything&apos;s wired up. Try a test spend to see governance in action:
      </p>
      {error && (
        <div className="mb-2 p-2 rounded bg-red-50 dark:bg-red-950/30 text-[11px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {[
          { type: 'swap', label: 'Swap $50', amount: 50 },
          { type: 'transfer', label: 'Transfer $500', amount: 500 },
          { type: 'stake', label: 'Stake $2000', amount: 2000 },
        ].map((action) => (
          <Button
            key={action.type}
            size="sm"
            variant="outline"
            disabled={evaluating}
            onClick={() => runCheck(action.type, action.amount)}
            className="h-7 gap-1.5 text-[11px]"
          >
            {evaluating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <PlayCircle className="h-3 w-3" />
            )}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
