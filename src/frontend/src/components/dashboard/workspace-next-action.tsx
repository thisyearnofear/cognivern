'use client';

import { ArrowRight, CircleAlert, FileCheck2, KeyRound, Landmark, PlayCircle, ShieldCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trackUxEvent } from '@/lib/ux-events';
import type { FundedMandate } from '@/lib/api-client';

type NextAction = {
  eyebrow: string;
  title: string;
  description: string;
  button: string;
  href: string;
  icon: typeof ShieldCheck;
  tone: 'primary' | 'attention' | 'neutral';
};

interface WorkspaceNextActionProps {
  demoMode: boolean;
  hasPolicy: boolean;
  hasAgent: boolean;
  hasApiKey: boolean;
  hasGovernedRequest: boolean;
  mandates: FundedMandate[];
  attentionCount: number;
}

function chooseNextAction({
  demoMode,
  hasPolicy,
  hasAgent,
  hasApiKey,
  hasGovernedRequest,
  mandates,
  attentionCount,
}: WorkspaceNextActionProps): NextAction {
  if (demoMode) {
    return {
      eyebrow: 'Sample workspace',
      title: 'Try a governed spend preview',
      description: 'Explore the approval boundary with sample data. Nothing in demo mode moves real funds.',
      button: 'Try the demo check',
      href: '/governance/check',
      icon: PlayCircle,
      tone: 'neutral',
    };
  }
  if (!hasPolicy) {
    return {
      eyebrow: 'Start with control',
      title: 'Set your spending rules',
      description: 'Give every governed identity a clear boundary before it can request capital.',
      button: 'Create a policy',
      href: '/policies',
      icon: ShieldCheck,
      tone: 'primary',
    };
  }
  if (!hasAgent) {
    return {
      eyebrow: 'Connect the actor',
      title: 'Register the system that will spend',
      description: 'Create an API identity for the bot, script, or agent so its actions have an accountable trail.',
      button: 'Add an identity',
      href: '/agents/workshop',
      icon: Users,
      tone: 'primary',
    };
  }
  if (!hasApiKey) {
    return {
      eyebrow: 'Make it usable',
      title: 'Create a workspace API key',
      description: 'Your agent uses a scoped key to call Cognivern without sharing a human session.',
      button: 'Generate a key',
      href: '/integrate',
      icon: KeyRound,
      tone: 'primary',
    };
  }
  if (mandates.length === 0) {
    return {
      eyebrow: 'Define the work',
      title: 'Create a spending mandate',
      description: 'A mandate connects an objective, budget, agents, and success measures so spend can be reviewed as accountable work.',
      button: 'Open Capital',
      href: '/capital',
      icon: Landmark,
      tone: 'primary',
    };
  }
  if (!hasGovernedRequest) {
    return {
      eyebrow: 'Prove the loop',
      title: 'Run your first governed check',
      description: 'Preview one request through the policy boundary before connecting a production agent.',
      button: 'Run a governance check',
      href: '/governance/check',
      icon: PlayCircle,
      tone: 'primary',
    };
  }
  if (attentionCount > 0) {
    return {
      eyebrow: 'Needs your review',
      title: 'Resolve held or denied decisions',
      description: 'Clear the decisions waiting for an operator before you allocate more capital.',
      button: 'Review decisions',
      href: '/audit?status=needs_attention',
      icon: CircleAlert,
      tone: 'attention',
    };
  }
  return {
    eyebrow: 'Capital review',
    title: 'Review what your mandate produced',
    description: 'Connect governed spend, receipts, measured results, and cited evidence before the next allocation.',
    button: 'Open Capital',
    href: '/capital',
    icon: FileCheck2,
    tone: 'neutral',
  };
}

export function WorkspaceNextAction(props: WorkspaceNextActionProps) {
  const router = useRouter();
  const action = chooseNextAction(props);
  const Icon = action.icon;
  const toneClasses = action.tone === 'attention'
    ? 'border-amber-500/30 bg-amber-500/5'
    : action.tone === 'primary'
      ? 'border-primary/25 bg-primary/[.035]'
      : 'border-border bg-card';

  return (
    <section aria-label="Next workspace action" aria-live="polite" className={`rounded-xl border p-4 sm:p-5 ${toneClasses}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.tone === 'attention' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={action.tone === 'attention' ? 'outline' : 'secondary'}>{action.eyebrow}</Badge>
            <span className="text-[11px] text-muted-foreground">One next step</span>
          </div>
          <h2 className="mt-2 text-base font-semibold">{action.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{action.description}</p>
        </div>
        <Button
          size="sm"
          variant={action.tone === 'attention' ? 'outline' : 'default'}
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
