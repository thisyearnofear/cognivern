import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AppLayout } from "./components/layout";
import SmartOnboarding from "./components/onboarding/SmartOnboarding";
import { useTheme, useAppStore } from "./stores/appStore";
import PageTransition from "./components/ui/PageTransition";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { loadingStyles } from "./styles/design-system";

// Lazy load components for better performance
const UnifiedDashboard = lazy(
  () => import("./components/dashboard/UnifiedDashboard"),
);
const TradingAgentDashboard = lazy(
  () => import("./components/trading/TradingAgentDashboard"),
);
const PolicyManagement = lazy(
  () => import("./components/policies/PolicyManagement"),
);
const AuditLogs = lazy(() => import("./components/audit/EnhancedAuditLogs"));
const RunLedger = lazy(() => import("./components/cre/RunLedger"));
const RunDetails = lazy(() => import("./components/cre/RunDetails"));
const AgentProfile = lazy(() => import("./components/agents/AgentProfile"));
const AgentWorkshop = lazy(() => import("./components/agents/AgentWorkshop"));
const AgentConnectionWizard = lazy(
  () => import("./components/agents/AgentConnectionWizard"),
);

// Enhanced loading component with animations
const PageSkeleton: React.FC = () => (
  <div css={loadingStyles.pageSkeleton.container}>
    <LoadingSpinner type="skeleton" variant="card" width="100%" height={200} />
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
      }}
    >
      <LoadingSpinner type="skeleton" variant="rectangular" height={150} />
      <LoadingSpinner type="skeleton" variant="rectangular" height={150} />
    </div>
    <LoadingSpinner type="skeleton" lines={3} />
  </div>
);

function App() {
  const { effectiveTheme } = useTheme();
  const setError = useAppStore((state) => state.setError);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      effectiveTheme === "dark",
    );
  }, [effectiveTheme]);

  const handleGlobalError = (error: Error) => {
    setError(error.message);
  };

  return (
    <Router>
      <ErrorBoundary componentName="Application Root" onError={handleGlobalError}>
        <div className="app">
          {/* Smart Onboarding - only shows when needed */}
          <SmartOnboarding />

          <Routes>
            <Route path="/" element={<AppLayout />}>
              {/* Unified Dashboard - Single source of truth */}
              <Route
                index
                element={
                  <ErrorBoundary componentName="Dashboard">
                    <PageTransition type="slide">
                      <Suspense fallback={<PageSkeleton />}>
                        <UnifiedDashboard />
                      </Suspense>
                    </PageTransition>
                  </ErrorBoundary>
                }
              />

            {/* Agents Route - Detailed agent management */}
            <Route
              path="agents"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <TradingAgentDashboard />
                  </Suspense>
                </PageTransition>
              }
            />

            <Route
              path="agents/:agentId"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <AgentProfile />
                  </Suspense>
                </PageTransition>
              }
            />

            <Route
              path="agents/workshop"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <AgentWorkshop />
                  </Suspense>
                </PageTransition>
              }
            />

            <Route
              path="agents/connect"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <AgentConnectionWizard />
                  </Suspense>
                </PageTransition>
              }
            />

            {/* Legacy trading route - redirect to agents */}
            <Route path="trading" element={<Navigate to="/agents" replace />} />

            {/* Policies Route */}
            <Route
              path="policies"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <PolicyManagement />
                  </Suspense>
                </PageTransition>
              }
            />

            {/* Audit Logs Route */}
            <Route
              path="audit"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <AuditLogs />
                  </Suspense>
                </PageTransition>
              }
            />

            {/* Run Ledger Routes */}
            <Route
              path="runs"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <RunLedger />
                  </Suspense>
                </PageTransition>
              }
            />

            <Route
              path="runs/:runId"
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <RunDetails />
                  </Suspense>
                </PageTransition>
              }
            />

            {/* Redirect unknown routes to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
