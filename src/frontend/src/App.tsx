import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { generateKeyframes } from './styles/animations';
import AppLayout from './components/layout/AppLayout';
import SmartOnboarding from './components/onboarding/SmartOnboarding';
import PageTransition from './components/ui/PageTransition';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { pageSkeletonContainerStyles, pageSkeletonCardStyles } from './styles/styles';
import './App.css';

// Lazy load components for better performance
const ModernDashboard = lazy(() => import('./components/dashboard/ModernDashboard'));
const TradingAgentDashboard = lazy(() => import('./components/trading/TradingAgentDashboard'));
const PolicyManagement = lazy(() => import('./components/policies/PolicyManagement'));
const AuditLogs = lazy(() => import('./components/AuditLogs'));

// Enhanced loading component with animations
const PageSkeleton: React.FC = () => (
  <div css={pageSkeletonContainerStyles}>
    <LoadingSpinner size="lg" text="Loading..." />
    <div css={pageSkeletonCardStyles}>
      <LoadingSpinner type="skeleton" variant="card" height="200px" />
    </div>
  </div>
);

function App() {
  const { preferences, user } = useAppStore();

  // Inject animation keyframes into the document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = generateKeyframes();
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <Router>
      <div className="app">
        {/* Smart Onboarding - only shows when needed */}
        <SmartOnboarding />
        
        <Routes>
          <Route path="/" element={<AppLayout />}>
            {/* Dashboard Route */}
            <Route 
              index 
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <ModernDashboard userType={user.userType || 'explorer'} />
                  </Suspense>
                </PageTransition>
              } 
            />
            
            {/* Trading Route */}
            <Route 
              path="trading" 
              element={
                <PageTransition type="slide">
                  <Suspense fallback={<PageSkeleton />}>
                    <TradingAgentDashboard />
                  </Suspense>
                </PageTransition>
              } 
            />
            
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
            
            {/* Redirect unknown routes to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
