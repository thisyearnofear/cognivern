import React, { Suspense, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Activity,
  FileSearch,
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import PageTransition from '../ui/PageTransition';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { loadingStyles } from '../../styles/design-system';

export type UserPersona = 'healthcare' | 'defi' | 'enterprise' | 'developer';

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
  /** When set, this route is only shown for the listed personas. Omit = always shown. */
  personas?: UserPersona[];
}

const PageSkeleton: React.FC = () => (
  <div css={loadingStyles.pageSkeleton.container}>
    <LoadingSpinner type="skeleton" variant="card" width="100%" height={200} />
    <div
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
      }}
    >
      <LoadingSpinner type="skeleton" variant="rectangular" height={150} />
      <LoadingSpinner type="skeleton" variant="rectangular" height={150} />
    </div>
    <LoadingSpinner type="skeleton" lines={3} />
  </div>
);

interface RouteShellProps {
  componentName: string;
  children: React.ReactNode;
}

export const RouteShell: React.FC<RouteShellProps> = ({ componentName, children }) => (
  <ErrorBoundary componentName={componentName}>
    <PageTransition type="slide">
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </PageTransition>
  </ErrorBoundary>
);

interface AuthGuardProps {
  isAuthenticated: boolean;
  redirectTo?: string;
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  isAuthenticated,
  redirectTo = '/',
  children,
}) => {
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
};

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
    personas: ['healthcare', 'developer'],
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

/** Filter nav items by persona. Items without a `personas` list are always shown. */
export const getNavItemsForPersona = (items: AppRouteMeta[], userType?: string): AppRouteMeta[] => {
  if (!userType) return items;
  return items.filter((r) => !r.personas || r.personas.includes(userType as UserPersona));
};

export const getRouteMetaByPath = (pathname: string): AppRouteMeta | undefined => {
  if (pathname === '/') {
    return appRouteMeta.find((route) => route.path === '/dashboard');
  }

  return appRouteMeta.find((route) => {
    if (route.path === pathname) return true;
    return pathname.startsWith(`${route.path}/`);
  });
};
