'use client';

import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  KeyRound,
  PlayCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SetupChecklistProps {
  hasPolicy: boolean;
  hasAgent: boolean;
  hasApiKey: boolean;
  hasGovernedRequest: boolean;
}

type SetupStep = {
  label: string;
  description: string;
  complete: boolean;
  href: string;
  action: string;
  icon: typeof ShieldCheck;
};

/**
 * The shortest safe path from an empty live workspace to a useful first
 * result. The checklist remains visible until all four milestones are true,
 * so users can resume setup after visiting another route.
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
      label: 'Create an active policy',
      description: 'Define the guardrails that decide whether a spend is allowed.',
      complete: hasPolicy,
      href: '/policies',
      action: 'Create policy',
      icon: ShieldCheck,
    },
    {
      label: 'Add an API identity',
      description: 'Give the external system a governed identity to act through.',
      complete: hasAgent,
      href: '/agents/workshop',
      action: 'Create identity',
      icon: Users,
    },
    {
      label: 'Generate an access key',
      description: 'Create the workspace-scoped credential your system will use.',
      complete: hasApiKey,
      href: '/integrate',
      action: 'Generate key',
      icon: KeyRound,
    },
    {
      label: 'Run the first governed check',
      description: 'Test a spend and see the approved, held, or denied outcome.',
      complete: hasGovernedRequest,
      href: '/governance/check',
      action: 'Run a check',
      icon: PlayCircle,
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const nextStep = steps.find((step) => !step.complete);

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
            <h2 className="text-sm font-semibold">Your governed path is ready</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Policy, identity, access, and a real governance result are all in place.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push('/integrate')}>
            Connect a system
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.section>
    );
  }

  return (
    <section
      aria-label="Workspace setup"
      className="rounded-xl border border-primary/20 bg-card px-4 py-4 sm:px-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Get your first governed system running</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow the safe path from guardrails to your first verified decision.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {completedCount}/{steps.length} complete
        </span>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isNext = step === nextStep;
          return (
            <div
              key={step.label}
              className={`relative rounded-lg border p-3 ${
                isNext
                  ? 'border-primary/40 bg-primary/5'
                  : step.complete
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-border bg-muted/20'
              }`}
            >
              {index < steps.length - 1 && (
                <ArrowRight
                  className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 bg-card text-muted-foreground lg:block"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-start gap-2.5">
                {step.complete ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                    aria-label="Complete"
                  />
                ) : (
                  <Circle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${isNext ? 'text-primary' : 'text-muted-foreground/50'}`}
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs font-semibold">{step.label}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                  {isNext && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 gap-1 px-2 text-[11px]"
                      onClick={() => router.push(step.href)}
                    >
                      {step.action}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
