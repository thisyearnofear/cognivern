import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShieldCheck,
  FileSearch,
  CircleDollarSign,
  Gavel,
  Code2,
  Radar,
  Sparkles,
  Users,
  CreditCard,
  PlayCircle,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Navigation grouped by job, mapped to the vision loop
 * (fund → act → spend → evidence → outcome):
 *
 *   Operate     — the daily loop: what needs me, what happened, what was spent
 *   Configure   — the guardrails: who may spend, under what rules
 *   Developers  — the tooling: integrate, observe, drive from a terminal
 *
 * One rule: an item must name which stage of the loop it serves, or it is a
 * view inside an existing destination. See docs/UX_IA_REVIEW.md.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operate',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
        description: 'See what needs attention',
      },
      {
        id: 'audit',
        label: 'Audit',
        icon: FileSearch,
        href: '/audit',
        description: 'Investigate decisions and proof',
      },
      {
        id: 'spend-outcomes',
        label: 'Spend & Outcomes',
        icon: CircleDollarSign,
        href: '/capital',
        description: 'Runs, attribution, and verified spend',
      },
      {
        id: 'sealed-bid',
        label: 'Sealed Bids',
        icon: Gavel,
        href: '/sealed-bid',
        description: 'Run private vendor selections without exposing bids',
      },
    ],
  },
  {
    label: 'Configure',
    items: [
      {
        id: 'policies',
        label: 'Policies',
        icon: ShieldCheck,
        href: '/policies',
        description: 'Set spending rules',
      },
      {
        id: 'agents',
        label: 'Identities',
        icon: Users,
        href: '/agents',
        description: 'Control which systems can spend',
      },
      {
        id: 'sponsored-credits',
        label: 'Sponsored Credits',
        icon: CreditCard,
        href: '/sponsor/credits',
        description: 'Fund a cohort and meter its inference',
      },
    ],
  },
  {
    label: 'Developers',
    items: [
      {
        id: 'integrate',
        label: 'Integrate',
        icon: Code2,
        href: '/integrate',
        description: 'Connect your first governed system',
      },
      {
        id: 'observability',
        label: 'Observability',
        icon: Radar,
        href: '/observability',
        description: 'Traces, metrics, and dashboards',
      },
      {
        id: 'os',
        label: 'Terminal',
        icon: Sparkles,
        href: '/os',
        description: 'Terminal UI',
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const DEMO_NAV_ITEMS: NavItem[] = [
  {
    id: 'demo-spend',
    label: 'Spend Flow Demo',
    icon: PlayCircle,
    href: '/demo/spend',
    description: 'Watch the spend flow in action',
  },
];
