import React, { lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout, RouteShell, AuthGuard } from './components/layout';
import SmartOnboarding from './components/onboarding/SmartOnboarding';
import LandingPage from './components/landing/LandingPage';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
const LazyFhenixProvider = lazy(() => import('./components/blockchain/FhenixProvider').then(m => ({ default: m.FhenixProvider })));

function Web3Gate({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user);
  const needsWeb3 = user.owsWalletConnected || user.fhenixConnected;

  if (!needsWeb3) {
    return <>{children}</>;
  }

  return (
    <React.Suspense fallback={children}>
      <LazyFhenixProvider>{children}</LazyFhenixProvider>
    </React.Suspense>
  );
}

const UnifiedDashboard = lazy(() => import('./components/dashboard/UnifiedDashboard'));
const TradingAgentDashboard = lazy(() => import('./components/trading/TradingAgentDashboard'));
const PolicyManagement = lazy(() => import('./components/policies/PolicyManagement'));
const AuditLogs = lazy(() => import('./components/audit/EnhancedAuditLogs'));
const RunLedger = lazy(() => import('./components/cre/RunLedger'));
const RunDetails = lazy(() => import('./components/cre/RunDetails'));
const AgentProfile = lazy(() => import('./components/agents/AgentProfile'));
const AgentWorkshop = lazy(() => import('./components/agents/AgentWorkshop'));
const GovernancePlayground = lazy(() => import('./components/governance/GovernancePlayground'));
const SpendFlowDemo = lazy(() => import('./components/demo/SpendFlowDemo').then(m => ({ default: m.SpendFlowDemo })));

function App() {
  const setError = useAppStore((state) => state.setError);
  const preferences = useAppStore((state) => state.preferences);
  const isOnboarded = preferences.onboardingCompleted;
  const isInDemo = preferences.demoExplored;

  // Demo users can access the dashboard without completing onboarding.
  // The demo banner inside the dashboard nudges them to set up for real.
  const canAccessApp = isOnboarded || isInDemo;

  const handleGlobalError = (error: Error) => {
    setError(error.message);
  };

  return (
    <Router>
      <ErrorBoundary componentName="Application Root" onError={handleGlobalError}>
        <div className="app">
          <Routes>
            <Route
              path="/"
              element={
                <AuthGuard isAuthenticated={!canAccessApp} redirectTo="/dashboard">
                  <LandingPage />
                </AuthGuard>
              }
            />

            <Route
              path="/onboarding"
              element={
                <AuthGuard isAuthenticated={!isOnboarded} redirectTo="/dashboard">
                  <ErrorBoundary componentName="Onboarding" showRetry>
                    <SmartOnboarding />
                  </ErrorBoundary>
                </AuthGuard>
              }
            />

            <Route
              path="/"
              element={
                <AuthGuard isAuthenticated={canAccessApp} redirectTo="/">
                  <Web3Gate>
                    <AppLayout />
                  </Web3Gate>
                </AuthGuard>
              }
            >
              <Route path="dashboard" element={<RouteShell componentName="Dashboard"><UnifiedDashboard /></RouteShell>} />
              <Route path="agents" element={<RouteShell componentName="Agents"><TradingAgentDashboard /></RouteShell>} />
              <Route path="agents/:agentId" element={<RouteShell componentName="Agent Profile"><AgentProfile /></RouteShell>} />
              <Route path="agents/workshop" element={<RouteShell componentName="Agent Workshop"><AgentWorkshop /></RouteShell>} />
              <Route path="agents/connect" element={<Navigate to="/agents/workshop" replace />} />
              <Route path="trading" element={<Navigate to="/agents" replace />} />
              <Route path="policies" element={<RouteShell componentName="Policies"><PolicyManagement /></RouteShell>} />
              <Route path="audit" element={<RouteShell componentName="Audit"><AuditLogs /></RouteShell>} />
              <Route path="runs" element={<RouteShell componentName="Runs"><RunLedger /></RouteShell>} />
              <Route path="runs/:runId" element={<RouteShell componentName="Run Details"><RunDetails /></RouteShell>} />
              <Route path="governance/check" element={<RouteShell componentName="Governance Playground"><GovernancePlayground /></RouteShell>} />
              <Route path="demo/spend" element={<RouteShell componentName="Spend Flow Demo"><SpendFlowDemo /></RouteShell>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
