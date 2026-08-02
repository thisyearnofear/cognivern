'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';

interface GovernanceMomentProps {
  outcome: 'approved' | 'held' | 'denied';
  amount?: number;
  asset?: string;
  compact?: boolean;
}

const MOMENTS = {
  approved: {
    label: 'Guardrails held',
    detail: 'Cognivern cleared this spend with confidence.',
    icon: CheckCircle2,
    tone: 'emerald',
  },
  held: {
    label: 'Cognivern paused the moment',
    detail: 'The spend is safe to review before anything moves.',
    icon: Clock3,
    tone: 'amber',
  },
  denied: {
    label: 'Cognivern held the line',
    detail: 'The policy stopped a risky spend before execution.',
    icon: XCircle,
    tone: 'red',
  },
} as const;

const toneClasses = {
  emerald: {
    wrapper: 'border-emerald-500/25 bg-emerald-500/5',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    accent: 'bg-emerald-400',
  },
  amber: {
    wrapper: 'border-amber-500/25 bg-amber-500/5',
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-400',
  },
  red: {
    wrapper: 'border-red-500/25 bg-red-500/5',
    icon: 'bg-red-500/10 text-red-600 dark:text-red-400',
    accent: 'bg-red-400',
  },
} as const;

/** A small emotional payoff for the product's central promise: every spend
 * gets a clear, explainable answer before it becomes an incident. */
export function GovernanceMoment({
  outcome,
  amount,
  asset = 'USDC',
  compact = false,
}: GovernanceMomentProps) {
  const reducedMotion = useReducedMotion();
  const moment = MOMENTS[outcome];
  const Icon = moment.icon;
  const tone = toneClasses[moment.tone];

  return (
    <motion.div
      role="status"
      initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-xl border ${tone.wrapper} ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
    >
      {outcome === 'approved' && !reducedMotion && (
        <motion.span
          aria-hidden="true"
          className={`absolute left-0 top-0 h-0.5 ${tone.accent}`}
          initial={{ width: 0, opacity: 0.4 }}
          animate={{ width: '100%', opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
        />
      )}
      <div className="flex items-center gap-3">
        <motion.div
          className={`flex shrink-0 items-center justify-center rounded-lg ${tone.icon} ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
          initial={reducedMotion ? false : { rotate: -8 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold">{moment.label}</span>
            {typeof amount === 'number' && (
              <span className="font-mono text-[11px] text-muted-foreground">
                ${amount.toLocaleString()} {asset}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{moment.detail}</p>
        </div>
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      </div>
    </motion.div>
  );
}
