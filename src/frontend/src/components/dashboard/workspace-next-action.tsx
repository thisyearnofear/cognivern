'use client';

import { ArrowRight, FileCheck2, Landmark, PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trackUxEvent } from '@/lib/ux-events';
import type { WorkspaceState } from '@/lib/workspace-state';

type NextAction = {
  eyebrow: string;
  title: string;
  description: string;
  button: string;
  href: string;
  icon: typeof FileCheck2;
};

interface WorkspaceNextActionProps {
  /**
   * The shared workspace state. This card is a pure function of it, so it can
   * never contradict the AttentionSummary status object — both read the same
   * derivation (docs/ADAPTIVE_UX.md, "Reconciliation rule").
   */
  state: WorkspaceState;
  demoMode: boolean;
  /** Observable fact for the operating-state forward action. */
  mandateCount: number;
}

/**
 * The dashboard's single forward-looking action card.
 *
 * Division of labor with the status object (exactly one action per state):
 *  - `setup`     → null. SetupChecklist owns the first screen.
 *  - `attention` → null. AttentionSummary is the primary object and already
 *                  carries the one action ("review decisions").
 *  - `operating` → the forward-looking review of what the mandate produced.
 *
 * The card never re-derives its own setup ladder — that was the old source of
 * contradiction with the checklist.
 */
function chooseNextAction({ state, demoMode, mandateCount }: WorkspaceNextActionProps): NextAction | null {
  if (state !== 'operating') return null;

  if (demoMode) {
    return {
      eyebrow: 'Sample workspace',
      title: 'Explore a governed spend preview',
      description: 'See the approval boundary with sample data. Nothing in demo mode moves real funds.',
      button: 'Try the demo check',
      href: '/governance/check',
      icon: PlayCircle,
    };
  }
  if (mandateCount === 0) {
    return {
      eyebrow: 'Define the work',
      title: 'Create a spending mandate',
      description: 'A mandate connects an objective, budget, identities, and success measures so spend reviews as accountable work.',
      button: 'Open Activity',
      href: '/spend',
      icon: Landmark,
    };
  }
  return {
    eyebrow: 'Spend review',
    title: 'Review what your mandate produced',
    description: 'Connect governed spend, receipts, measured results, and cited evidence before the next allocation.',
    button: 'Open Spend & Outcomes',
    href: '/spend',
    icon: FileCheck2,
  };
}

export function WorkspaceNextAction(props: WorkspaceNextActionProps) {
  const router = useRouter();
  const action = chooseNextAction(props);
  if (!action) return null;
  const Icon = action.icon;

  return (
    <section aria-label="Next workspace action" aria-live="polite" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{action.eyebrow}</Badge>
            <span className="text-[11px] text-muted-foreground">One next step</span>
          </div>
          <h2 className="mt-2 text-base font-semibold">{action.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{action.description}</p>
        </div>
        <Button
          size="sm"
          variant="default"
          className="shrink-0 gap-1.5"
          onClick={() => {
            trackUxEvent('primary_action_clicked', 'workspace_next_action', action.title);
            router.push(action.href);
          }}
        >
          {action.button}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
