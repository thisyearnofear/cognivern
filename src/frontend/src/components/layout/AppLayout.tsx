import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore, useTheme } from '../../stores/appStore';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { designTokens } from '../../styles/designTokens';
import Sidebar from './Sidebar';
import Header from './Header';
import Toast from '../ui/Toast';
import NotificationCenter from '../ui/NotificationCenter';

export const AppLayout: React.FC = () => {
  const { preferences, error, setError } = useAppStore();
  const { effectiveTheme } = useTheme();
  const { metrics, alerts } = usePerformanceMonitor();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  const { isMobile } = useBreakpoint();

  const layoutStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile 
      ? '1fr' 
      : preferences.sidebarCollapsed ? '60px 1fr' : '280px 1fr',
    gridTemplateRows: isMobile ? '60px 1fr' : '60px 1fr',
    gridTemplateAreas: isMobile 
      ? `
        "header"
        "main"
      `
      : `
        "sidebar header"
        "sidebar main"
      `,
    minHeight: '100vh',
    backgroundColor: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[900] 
      : designTokens.colors.neutral[50],
    color: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[100] 
      : designTokens.colors.neutral[900],
    fontFamily: designTokens.typography.fontFamily.sans.join(', '),
    transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut}`,
  };

  const mainStyle: React.CSSProperties = {
    gridArea: 'main',
    overflow: 'auto',
    padding: designTokens.spacing[6],
    backgroundColor: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[800] 
      : designTokens.colors.neutral[0],
    borderRadius: `${designTokens.borderRadius.lg} 0 0 0`,
    margin: `0 ${designTokens.spacing[4]} ${designTokens.spacing[4]} 0`,
    boxShadow: designTokens.shadows.sm,
  };

  return (
    <div style={layoutStyle}>
      <Sidebar />
      <Header />
      <main style={mainStyle}>
        <Outlet />
      </main>
      
      {/* Global Toast Notifications */}
      {error && (
        <Toast
          type="error"
          message={error}
          onClose={() => setError(null)}
          duration={5000}
        />
      )}
      
      {/* Notification Center */}
      <NotificationCenter />
    </div>
  );
};

export default AppLayout;