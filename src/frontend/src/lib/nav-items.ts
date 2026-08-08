import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileSearch,
  Activity,
  Bot,
  PlayCircle,
  Code2,
  Sparkles,
  Gavel,
  Radar,
  CircleDollarSign,
  Fingerprint,
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
        id: 'runs',
        label: 'Runs',
        icon: Activity,
        href: '/runs',
        description: 'Resolve active and failed executions',
      },
      {
        id: 'capital',
        label: 'Capital',
        icon: CircleDollarSign,
        href: '/capital',
        description: 'See what governed agent capital produced',
      },
      {
        id: 'verified-capital',
        label: 'Verified Capital',
        icon: Fingerprint,
        href: '/verified-capital',
        description: 'Cleanverse CVI/CVA spend rail on Monad',
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
        label: 'API Identities',
        icon: Users,
        href: '/agents',
        description: 'Control which systems can spend',
      },
    ],
  },
  {
    label: 'Test',
    items: [
      {
        id: 'governance',
        label: 'Governance Check',
        icon: PlayCircle,
        href: '/governance/check',
        description: 'Test a spend against your policy',
      },
      {
        id: 'copilot',
        label: 'Copilot',
        icon: Bot,
        href: '/copilot',
        description: 'Agent mission console',
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
    label: 'Build',
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
        label: 'Tracing',
        icon: Radar,
        href: '/observability',
        description: 'SigNoz distributed tracing & metrics',
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
