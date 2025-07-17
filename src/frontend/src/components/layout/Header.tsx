import React, { useState } from 'react';
import { css } from '@emotion/react';
import { useAppStore, useTheme } from '../../stores/appStore';
import { 
  designTokens, 
  shadowSystem, 
  colorSystem, 
  keyframeAnimations, 
  easings 
} from '../../styles/design-system';
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

  // Modern header styles
  const headerStyles = css`
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 ${designTokens.spacing[6]};
    height: 70px;
    background: ${effectiveTheme === 'dark' 
      ? `linear-gradient(135deg, ${designTokens.colors.neutral[900]} 0%, ${designTokens.colors.neutral[800]} 100%)` 
      : `linear-gradient(135deg, ${designTokens.colors.neutral[0]} 0%, ${designTokens.colors.neutral[50]} 100%)`};
    border-bottom: 1px solid ${effectiveTheme === 'dark' 
      ? designTokens.colors.neutral[700] 
      : designTokens.colors.neutral[200]};
    box-shadow: ${shadowSystem.floating};
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: ${designTokens.zIndex.sticky};
    transition: ${easings.smooth};
  `;

  const titleStyles = css`
    font-size: ${designTokens.typography.fontSize.xl};
    font-weight: ${designTokens.typography.fontWeight.bold};
    background: ${colorSystem.gradients.primary};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
    transition: ${easings.smooth};
    
    &:hover {
      transform: scale(1.05);
    }
  `;

  const actionsStyles = css`
    display: flex;
    align-items: center;
    gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[4]};
  `;

  const statusIndicatorStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
    background: ${effectiveTheme === 'dark' 
      ? `linear-gradient(135deg, ${designTokens.colors.neutral[800]} 0%, ${designTokens.colors.neutral[700]} 100%)` 
      : `linear-gradient(135deg, ${designTokens.colors.semantic.success[50]} 0%, ${designTokens.colors.semantic.success[100]} 100%)`};
    border-radius: ${designTokens.borderRadius.full};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${designTokens.colors.semantic.success[700]};
    border: 1px solid ${designTokens.colors.semantic.success[200]};
    box-shadow: ${shadowSystem.sm};
    transition: ${easings.smooth};
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: ${shadowSystem.md};
    }
  `;

  const modernButtonStyle = css`
    background: transparent;
    border: 1px solid ${designTokens.colors.neutral[300]};
    color: ${designTokens.colors.neutral[700]};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    min-height: auto;
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
    transition: ${easings.smooth};
    cursor: pointer;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${shadowSystem.md};
      background: ${designTokens.colors.neutral[50]};
    }
  `;

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
    <header css={headerStyles}>
      <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[4]};`}>
        <h1 css={titleStyles}>{getPageTitle()}</h1>
        
        {/* Status Indicators */}
        <div css={statusIndicatorStyles}>
          <span css={css`
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${designTokens.colors.semantic.success[500]};
            box-shadow: 0 0 8px ${designTokens.colors.semantic.success[300]};
            ${keyframeAnimations.pulse}
          `} />
          <span>System Online</span>
        </div>
      </div>

      <div css={actionsStyles}>
        {/* Command Palette Trigger */}
        {!isMobile && (
          <button
            css={css`
              ${modernButtonStyle}
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
              color: ${designTokens.colors.neutral[500]};
              font-size: ${designTokens.typography.fontSize.xs};
            `}
            onClick={() => setShowCommandPalette(true)}
            title="Open command palette (Ctrl+K)"
          >
            <span>⌘</span>
            <span>Search</span>
          </button>
        )}

        {/* Mobile Menu Toggle */}
        {isMobile && (
          <button
            css={modernButtonStyle}
            onClick={() => updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed })}
            title="Toggle menu"
          >
            ☰
          </button>
        )}

        {/* Theme Toggle */}
        <button
          css={modernButtonStyle}
          onClick={handleThemeToggle}
          title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {effectiveTheme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Search on Mobile */}
        {isMobile && (
          <button
            css={modernButtonStyle}
            onClick={() => setShowCommandPalette(true)}
            title="Search"
          >
            🔍
          </button>
        )}

        {/* Notifications */}
        {!isMobile && (
          <button
            css={css`
              ${modernButtonStyle}
              position: relative;
            `}
            title="Notifications"
          >
            🔔
            {/* Notification badge */}
            <span css={css`
              position: absolute;
              top: 4px;
              right: 4px;
              width: 8px;
              height: 8px;
              background: ${designTokens.colors.semantic.error[500]};
              border-radius: 50%;
              font-size: 0;
              ${keyframeAnimations.pulse}
            `}>
              •
            </span>
          </button>
        )}

        {/* Wallet Connection */}
        <Web3Auth
          onConnect={handleWalletConnect}
          onDisconnect={handleWalletDisconnect}
        />

        {/* User Menu */}
        {user.isConnected && !isMobile && (
          <button
            css={modernButtonStyle}
            title="User menu"
          >
            ⚙️
          </button>
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