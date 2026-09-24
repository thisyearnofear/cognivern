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
  RadioTower,
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
 * Navigation grouped by user job:
 *
 *   Review      — what needs attention and what happened
 *   Programs    — funded workflows and private selections
 *   Controls    — the guardrails and identities that govern actions
 *   Developers  — integration and technical operations
 *
 * One rule: an item must name which stage of the loop it serves, or it is a
 * view inside an existing destination. See docs/UX_IA_REVIEW.md.
 * Vendor/rail names belong in footnotes, not nav labels.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Review',
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
        description: 'Investigate decisions and evidence',
      },
      {
        id: 'spend-outcomes',
        label: 'Spend & Outcomes',
        icon: CircleDollarSign,
        href: '/spend',
        description: 'Fund actions, review spend, and see what it produced',
      },
    ],
  },
  {
    label: 'Programs',
    items: [
      {
        id: 'sealed-bid',
        label: 'Private selection',
        icon: Gavel,
        href: '/sealed-bid',
        description: 'Run confidential vendor selection under a mandate',
      },
      {
        id: 'telegraph-signals',
        label: 'Verified signals',
        icon: RadioTower,
        href: '/telegraph',
        description: 'Verify external intelligence before a governed action',
      },
    ],
  },
  {
    label: 'Controls',
    items: [
      {
        id: 'policies',
        label: 'Policies',
        icon: ShieldCheck,
        href: '/policies',
        description: 'Set boundaries for agent actions',
      },
      {
        id: 'agents',
        label: 'Agent identities',
        icon: Users,
        href: '/agents',
        description: 'Connect the systems that may act',
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
        description: 'Connect your control plane',
      },
      {
        id: 'observability',
        label: 'Observability',
        icon: Radar,
        href: '/observability',
        description: 'Inspect traces, metrics, and health',
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
  {
    id: 'demo-attribution',
    label: 'Funded Mandate Demo',
    icon: CircleDollarSign,
    href: '/demo/attribution',
    description: 'See the full mandate loop: fund, act, spend, outcome',
  },
];
