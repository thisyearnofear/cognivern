import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AppLayout } from "./components/layout";
import SmartOnboarding from "./components/onboarding/SmartOnboarding";
import PageTransition from "./components/ui/PageTransition";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { loadingStyles } from "./styles/design-system";
import "./App.css";

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

// Enhanced loading component with animations
const PageSkeleton: React.FC = () => (
  <div css={loadingStyles.pageSkeleton.container}>
    <LoadingSpinner size="lg" text="Loading..." />
    <div css={loadingStyles.pageSkeleton.card}>
      <LoadingSpinner type="spinner" color="#3b82f6" text="Please wait..." />
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <div className="app">
        {/* Smart Onboarding - only shows when needed */}
        <SmartOnboarding />

        <Routes>
          <Route path="/" element={<AppLayout />}>
            {/* Unified Dashboard - Single source of truth */}
            <Route
              index
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <UnifiedDashboard />
                  </Suspense>
                </PageTransition>
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
    </Router>
  );
}

export default App;
