import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore, useTheme } from '../../stores/appStore';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import './AppLayout.css';
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

  const layoutClasses = [
    'app-layout',
    isMobile ? 'is-mobile' : 'is-desktop',
    preferences.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded',
  ].join(' ');

  return (
    <div className={layoutClasses}>
      <Sidebar />
      <Header />
      <main className="app-main">
        <div className="app-content-wrapper">
          <Outlet />
        </div>
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