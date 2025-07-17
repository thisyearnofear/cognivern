import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore, useTheme } from '../../stores/appStore';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { designTokens } from '../../styles/designTokens';
import { Button } from '../ui/Button';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  description?: string;
}

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    path: '/',
    description: 'Overview and metrics',
  },
  {
    id: 'trading',
    label: 'AI Trading',
    icon: '🤖',
    path: '/trading',
    description: 'Trading agents',
  },
  {
    id: 'policies',
    label: 'Policies',
    icon: '📋',
    path: '/policies',
    description: 'Governance rules',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    icon: '📝',
    path: '/audit',
    description: 'Activity history',
  },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences, updatePreferences, user } = useAppStore();
  const { effectiveTheme } = useTheme();
  const { isMobile, isTablet } = useBreakpoint();

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile && !preferences.sidebarCollapsed) {
      updatePreferences({ sidebarCollapsed: true });
    }
  }, [isMobile, preferences.sidebarCollapsed, updatePreferences]);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) {
      updatePreferences({ sidebarCollapsed: true });
    }
  }, [location.pathname, isMobile, updatePreferences]);

  const toggleSidebar = () => {
    updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
  };

  const sidebarClasses = [
    'sidebar',
    isMobile ? 'is-mobile' : 'is-desktop',
    preferences.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded',
  ].join(' ');

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !preferences.sidebarCollapsed && (
        <div
          className="sidebar-overlay"
          onClick={() => updatePreferences({ sidebarCollapsed: true })}
        />
      )}

      <aside className={sidebarClasses}>
        {/* Logo and Brand */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🧠</span>
          {!preferences.sidebarCollapsed && (
            <div className="sidebar-logo-text">
              <h2>Cognivern</h2>
              <p>AI Governance</p>
            </div>
          )}
        </div>

        {/* User Info */}
        {user.isConnected && (
          <div className={`sidebar-user-info ${preferences.sidebarCollapsed ? 'collapsed' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing[2] }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: designTokens.colors.primary[500],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.bold,
              }}>
                {user.userType?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!preferences.sidebarCollapsed && (
                <div>
                  <div style={{ 
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.medium,
                  }}>
                    {user.userType || 'User'}
                  </div>
                  {user.address && (
                    <div style={{ 
                      fontSize: designTokens.typography.fontSize.xs,
                      opacity: 0.7,
                      fontFamily: designTokens.typography.fontFamily.mono.join(', '),
                    }}>
                      {user.address.slice(0, 6)}...{user.address.slice(-4)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1 }}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <div
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <div>
                  <div className="sidebar-nav-label">{item.label}</div>
                  {item.description && (
                    <div className="sidebar-nav-description">{item.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Toggle */}
        <div className="sidebar-toggle">
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              style={{ width: '100%', justifyContent: preferences.sidebarCollapsed ? 'center' : 'flex-start' }}
            >
              <span>{preferences.sidebarCollapsed ? '→' : '←'}</span>
              {!preferences.sidebarCollapsed && <span>Collapse</span>}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;