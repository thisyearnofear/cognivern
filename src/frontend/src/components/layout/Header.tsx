import React, { useState } from 'react';
import { useAppStore, useTheme } from '../../stores/appStore';
import { designTokens } from '../../styles/designTokens';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Button } from '../ui/Button';
import CommandPalette from '../ui/CommandPalette';
import Web3Auth from '../auth/Web3Auth';

export const Header: React.FC = () => {
  const { preferences, updatePreferences, user, setUser } = useAppStore();
  const { effectiveTheme } = useTheme();
  const { isMobile, isTablet } = useBreakpoint();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  const handleThemeToggle = () => {
    const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: newTheme });
  };

  const handleWalletConnect = (address: string) => {
    setUser({ address, isConnected: true });
  };

  const handleWalletDisconnect = () => {
    setUser({ address: undefined, isConnected: false });
  };

  const headerStyle: React.CSSProperties = {
    gridArea: 'header',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${designTokens.spacing[6]}`,
    backgroundColor: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[900] 
      : designTokens.colors.neutral[0],
    borderBottom: `1px solid ${effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[700] 
      : designTokens.colors.neutral[200]}`,
    boxShadow: designTokens.shadows.sm,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.lg,
    fontWeight: designTokens.typography.fontWeight.semibold,
    color: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[100] 
      : designTokens.colors.neutral[900],
    margin: 0,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? designTokens.spacing[2] : designTokens.spacing[4],
  };

  const statusIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: designTokens.spacing[2],
    padding: `${designTokens.spacing[2]} ${designTokens.spacing[3]}`,
    backgroundColor: effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[800] 
      : designTokens.colors.neutral[50],
    borderRadius: designTokens.borderRadius.md,
    fontSize: designTokens.typography.fontSize.sm,
  };

  const getPageTitle = () => {
    const path = window.location.pathname;
    switch (path) {
      case '/':
        return 'Dashboard';
      case '/trading':
        return 'AI Trading Agents';
      case '/policies':
        return 'Policy Management';
      case '/audit':
        return 'Audit Logs';
      default:
        return 'Cognivern';
    }
  };

  return (
    <header style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing[4] }}>
        <h1 style={titleStyle}>{getPageTitle()}</h1>
        
        {/* Status Indicators */}
        <div style={statusIndicatorStyle}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: designTokens.colors.semantic.success[500],
            boxShadow: `0 0 8px ${designTokens.colors.semantic.success[300]}`,
          }} />
          <span>System Online</span>
        </div>
      </div>

      <div style={actionsStyle}>
        {/* Command Palette Trigger */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCommandPalette(true)}
            style={{ 
              padding: `${designTokens.spacing[2]} ${designTokens.spacing[3]}`,
              minHeight: 'auto',
              fontSize: designTokens.typography.fontSize.xs,
              color: designTokens.colors.neutral[500],
            }}
            title="Open command palette (Ctrl+K)"
          >
            <span style={{ marginRight: designTokens.spacing[2] }}>⌘</span>
            <span>Search</span>
          </Button>
        )}

        {/* Mobile Menu Toggle */}
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed })}
            style={{ 
              padding: designTokens.spacing[2],
              minHeight: 'auto',
            }}
            title="Toggle menu"
          >
            ☰
          </Button>
        )}

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleThemeToggle}
          style={{ 
            padding: designTokens.spacing[2],
            minHeight: 'auto',
          }}
          title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {effectiveTheme === 'dark' ? '☀️' : '🌙'}
        </Button>

        {/* Search on Mobile */}
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCommandPalette(true)}
            style={{ 
              padding: designTokens.spacing[2],
              minHeight: 'auto',
            }}
            title="Search"
          >
            🔍
          </Button>
        )}

        {/* Notifications */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            style={{ 
              padding: designTokens.spacing[2],
              minHeight: 'auto',
              position: 'relative',
            }}
            title="Notifications"
          >
            🔔
            {/* Notification badge */}
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: designTokens.colors.semantic.error[500],
              borderRadius: '50%',
              fontSize: '0',
            }}>
              •
            </span>
          </Button>
        )}

        {/* Wallet Connection */}
        <Web3Auth
          onConnect={handleWalletConnect}
          onDisconnect={handleWalletDisconnect}
        />

        {/* User Menu */}
        {user.isConnected && !isMobile && (
          <Button
            variant="ghost"
            size="sm"
            style={{ 
              padding: designTokens.spacing[2],
              minHeight: 'auto',
            }}
            title="User menu"
          >
            ⚙️
          </Button>
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
    </header>
  );
};

export default Header;