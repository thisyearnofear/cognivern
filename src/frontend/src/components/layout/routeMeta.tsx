import React from 'react';
import {
  Activity,
  FileSearch,
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';

export interface AppRouteMeta {
  id: string;
  label: string;
  shortLabel?: string;
  title: string;
  description?: string;
  path: string;
  icon: React.ReactNode;
  showInNav?: boolean;
  showInMobileNav?: boolean;
  badge?: string | number;
}

export const appRouteMeta: AppRouteMeta[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    title: 'Dashboard',
    description: 'Overview',
    path: '/dashboard',
    icon: <LayoutDashboard size={20} />,
    showInNav: true,
    showInMobileNav: true,
  },
  {
    id: 'agents',
    label: 'Agents',
    shortLabel: 'Agents',
    title: 'Agents',
    description: 'Managed operations',
    path: '/agents',
    icon: <Users size={20} />,
    showInNav: true,
    showInMobileNav: true,
  },
  {
    id: 'policies',
    label: 'Policies',
    shortLabel: 'Policies',
    title: 'Policies',
    description: 'Rules and guardrails',
    path: '/policies',
    icon: <ShieldCheck size={20} />,
    showInNav: true,
    showInMobileNav: true,
  },
  {
    id: 'audit',
    label: 'Audit',
    shortLabel: 'Audit',
    title: 'Audit',
    description: 'Evidence and logs',
    path: '/audit',
    icon: <FileSearch size={20} />,
    showInNav: true,
    showInMobileNav: true,
  },
  {
    id: 'runs',
    label: 'Runs',
    shortLabel: 'Runs',
    title: 'Runs',
    description: 'Agent activity log',
    path: '/runs',
    icon: <Activity size={20} />,
    showInNav: true,
    showInMobileNav: true,
  },
  {
    id: 'governance-check',
    label: 'Governance Check',
    shortLabel: 'Check',
    title: 'Governance Playground',
    description: 'Test policies and evaluate agent actions live',
    path: '/governance/check',
    icon: <PlayCircle size={20} />,
    showInNav: true,
    showInMobileNav: true,
  },
  {
    id: 'add-agent',
    label: 'Add Agent',
    title: 'Add Agent',
    description: 'Create or connect an agent',
    path: '/agents/workshop',
    icon: <PlusCircle size={20} />,
    showInNav: true,
    showInMobileNav: false,
  },
];

export const primaryNavItems = appRouteMeta.filter((route) => route.showInNav);
export const mobileNavItems = appRouteMeta.filter((route) => route.showInMobileNav);

export const getRouteMetaByPath = (pathname: string): AppRouteMeta | undefined => {
  if (pathname === '/') {
    return appRouteMeta.find((route) => route.path === '/dashboard');
  }

  return appRouteMeta.find((route) => {
    if (route.path === pathname) return true;
    return pathname.startsWith(`${route.path}/`);
  });
};
