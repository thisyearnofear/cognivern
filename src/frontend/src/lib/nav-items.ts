import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

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
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        id: "policies",
        label: "Policies",
        icon: ShieldCheck,
        href: "/policies",
      },
      {
        id: "agents",
        label: "Agents",
        icon: Users,
        href: "/agents",
      },
      {
        id: "governance",
        label: "Test a Spend",
        icon: PlayCircle,
        href: "/governance/check",
        description: "Test a spend against your policy",
      },
      {
        id: "copilot",
        label: "Copilot",
        icon: Bot,
        href: "/copilot",
        description: "Agent mission console",
      },
      {
        id: "sealed-bid",
        label: "Sealed Bids",
        icon: Gavel,
        href: "/sealed-bid",
        description: "Confidential vendor RFPs — Canton privacy",
      },
    ],
  },
  {
    label: "History",
    items: [
      {
        id: "audit",
        label: "Audit",
        icon: FileSearch,
        href: "/audit",
      },
      {
        id: "runs",
        label: "Runs",
        icon: Activity,
        href: "/runs",
      },
    ],
  },
  {
    label: "Developer",
    items: [
      {
        id: "integrate",
        label: "Integrate",
        icon: Code2,
        href: "/integrate",
      },
      {
        id: "os",
        label: "Terminal",
        icon: Sparkles,
        href: "/os",
        description: "Terminal UI",
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const DEMO_NAV_ITEMS: NavItem[] = [
  {
    id: "demo-spend",
    label: "Spend Flow Demo",
    icon: PlayCircle,
    href: "/demo/spend",
    description: "Watch the spend flow in action",
  },
];
