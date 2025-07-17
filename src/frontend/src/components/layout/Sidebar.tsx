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

  const sidebarStyle: React.CSSProperties = {
    gridArea: 'sidebar',
    backgroundColor: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[900] 
      : designTokens.colors.neutral[0],
    borderRight: `1px solid ${effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[700] 
      : designTokens.colors.neutral[200]}`,
    padding: preferences.sidebarCollapsed ? designTokens.spacing[2] : designTokens.spacing[4],
    display: 'flex',
    flexDirection: 'column',
    gap: designTokens.spacing[2],
    transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut}`,
    overflow: 'hidden',
    // Mobile overlay behavior
    ...(isMobile && !preferences.sidebarCollapsed ? {
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      width: '280px',
      zIndex: designTokens.zIndex.overlay,
      boxShadow: designTokens.shadows.xl,
    } : {}),
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: designTokens.spacing[3],
    padding: designTokens.spacing[3],
    marginBottom: designTokens.spacing[4],
    borderBottom: `1px solid ${effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[700] 
      : designTokens.colors.neutral[200]}`,
  };

  const userInfoStyle: React.CSSProperties = {
    padding: designTokens.spacing[3],
    backgroundColor: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[800] 
      : designTokens.colors.neutral[50],
    borderRadius: designTokens.borderRadius.md,
    marginBottom: designTokens.spacing[4],
    display: preferences.sidebarCollapsed ? 'none' : 'block',
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: designTokens.spacing[3],
    padding: designTokens.spacing[3],
    borderRadius: designTokens.borderRadius.md,
    cursor: 'pointer',
    transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
    backgroundColor: isActive 
      ? (effectiveTheme === 'dark' 
          ? designTokens.colors.primary[800] 
          : designTokens.colors.primary[100])
      : 'transparent',
    color: isActive 
      ? (effectiveTheme === 'dark' 
          ? designTokens.colors.primary[200] 
          : designTokens.colors.primary[700])
      : (effectiveTheme === 'dark' 
          ? designTokens.colors.neutral[300] 
          : designTokens.colors.neutral[700]),
    border: isActive 
      ? `1px solid ${effectiveTheme === 'dark' 
          ? designTokens.colors.primary[700] 
          : designTokens.colors.primary[300]}`
      : '1px solid transparent',
  });

  const iconStyle: React.CSSProperties = {
    fontSize: '20px',
    minWidth: '20px',
    textAlign: 'center',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    fontWeight: designTokens.typography.fontWeight.medium,
    display: preferences.sidebarCollapsed ? 'none' : 'block',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    opacity: 0.7,
    display: preferences.sidebarCollapsed ? 'none' : 'block',
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !preferences.sidebarCollapsed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: designTokens.zIndex.overlay - 1,
          }}
          onClick={() => updatePreferences({ sidebarCollapsed: true })}
        />
      )}

      <aside style={sidebarStyle}>
        {/* Logo and Brand */}
        <div style={logoStyle}>
          <span style={{ fontSize: '24px' }}>🧠</span>
          {!preferences.sidebarCollapsed && (
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: designTokens.typography.fontSize.lg,
                fontWeight: designTokens.typography.fontWeight.bold,
                color: effectiveTheme === 'dark' 
                  ? designTokens.colors.neutral[100] 
                  : designTokens.colors.neutral[900],
              }}>
                Cognivern
              </h2>
              <p style={{ 
                margin: 0, 
                fontSize: designTokens.typography.fontSize.xs,
                color: effectiveTheme === 'dark' 
                  ? designTokens.colors.neutral[400] 
                  : designTokens.colors.neutral[500],
              }}>
                AI Governance
              </p>
            </div>
          )}
        </div>

        {/* User Info */}
        {user.isConnected && (
          <div style={userInfoStyle}>
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
                style={navItemStyle(isActive)}
                onClick={() => navigate(item.path)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = effectiveTheme === 'dark' 
                      ? designTokens.colors.neutral[800] 
                      : designTokens.colors.neutral[100];
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={iconStyle}>{item.icon}</span>
                <div>
                  <div style={labelStyle}>{item.label}</div>
                  {item.description && (
                    <div style={descriptionStyle}>{item.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Toggle */}
        <div style={{ 
          borderTop: `1px solid ${effectiveTheme === 'dark' 
            ? designTokens.colors.neutral[700] 
            : designTokens.colors.neutral[200]}`,
          paddingTop: designTokens.spacing[4],
        }}>
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