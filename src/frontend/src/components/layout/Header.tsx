import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Search,
  Bell,
  Settings,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Vault,
} from 'lucide-react';
import { useAppStore, useTheme } from '../../stores/appStore';
import { agentApi } from '../../services/apiService';
import { useIntentStore } from '../../stores/intentStore';
import { designTokens, easings } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSidebarState } from '../../hooks/useSidebarState';
import CommandPalette from '../ui/CommandPalette';
import { ConnectionModal } from '../web3/ConnectionModal';

export const Header: React.FC = () => {
  const { user, setUser, updatePreferences } = useAppStore();
  const { effectiveTheme } = useTheme();
  const { isMobile } = useBreakpoint();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { setIsOpen } = useIntentStore();
  const { toggleSidebar } = useSidebarState();
  const [isSystemOnline, setIsSystemOnline] = useState<boolean | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  useEffect(() => {
    const checkSystemStatus = async () => {
      const isOnline = await agentApi.checkHealth();
      setIsSystemOnline(isOnline);
    };

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  const handleThemeToggle = () => {
    const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: newTheme });
  };

  // Calculate connected count
  const connectedCount = [user.isConnected, user.owsWalletConnected, user.fhenixConnected].filter(Boolean).length;

  // Modern header styles
  const headerStyles = css`
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 ${isMobile ? designTokens.spacing[3] : designTokens.spacing[6]};
    height: ${isMobile ? '60px' : designTokens.layout.headerHeight};
    background: ${effectiveTheme === 'dark'
      ? `linear-gradient(135deg, ${designTokens.colors.neutral[900]} 0%, ${designTokens.colors.neutral[800]} 100%)`
      : `linear-gradient(135deg, ${designTokens.colors.neutral[0]} 0%, ${designTokens.colors.neutral[50]} 100%)`};
    border-bottom: 1px solid
      ${effectiveTheme === 'dark'
        ? designTokens.colors.neutral[700]
        : designTokens.colors.neutral[200]};
    box-shadow: ${designTokens.shadowSystem.floating};
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: ${designTokens.zIndex.sticky};
    transition: ${easings.smooth};
  `;

  const titleStyles = css`
    font-size: ${isMobile
      ? designTokens.typography.fontSize.lg
      : designTokens.typography.fontSize.xl};
    font-weight: ${designTokens.typography.fontWeight.bold};
    background: ${designTokens.colorSystem.gradients.primary};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
    transition: ${easings.smooth};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: ${isMobile ? '120px' : 'none'};
  `;

  const actionsStyles = css`
    display: flex;
    align-items: center;
    gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[4]};
  `;

  const addAgentButtonStyle = css`
    background: ${designTokens.colorSystem.gradients.primary};
    border: none;
    color: white;
    padding: ${isMobile ? '6px 12px' : '8px 16px'};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.bold};
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    transition: ${easings.smooth};
    cursor: pointer;
    box-shadow: ${designTokens.shadows.md};
    white-space: nowrap;

    &:hover {
      transform: translateY(-2px);
      box-shadow: ${designTokens.shadows.lg};
      opacity: 0.9;
    }

    &:active {
      transform: translateY(0);
    }
  `;

  const statusIndicatorStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${isMobile
      ? designTokens.spacing[1]
      : `${designTokens.spacing[2]} ${designTokens.spacing[4]}`};
    background: ${effectiveTheme === 'dark'
      ? `linear-gradient(135deg, ${designTokens.colors.neutral[800]} 0%, ${designTokens.colors.neutral[700]} 100%)`
      : isMobile
        ? 'transparent'
        : `linear-gradient(135deg, ${designTokens.colors.semantic.success[50]} 0%, ${designTokens.colors.semantic.success[100]} 100%)`};
    border-radius: ${designTokens.borderRadius.full};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${designTokens.colors.semantic.success[700]};
    border: ${isMobile ? 'none' : `1px solid ${designTokens.colors.semantic.success[200]}`};
    box-shadow: ${isMobile ? 'none' : designTokens.shadows.sm};
    transition: ${easings.smooth};
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
      box-shadow: ${designTokens.shadows.md};
      background: ${designTokens.colors.neutral[50]};
    }
  `;

  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return 'Dashboard';
      case '/agents':
        return isMobile ? 'Agents' : 'Governed Agents';
      case '/policies':
        return isMobile ? 'Policies' : 'Spend Policies';
      case '/audit':
        return isMobile ? 'Audit' : 'Audit Logs';
      case '/runs':
        return isMobile ? 'Runs' : 'Run Ledger';
      default:
        return 'Cognivern';
    }
  };

  return (
    <header css={headerStyles}>
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[4]};
          flex-shrink: 0;
        `}
      >
        <h1 css={titleStyles}>{getPageTitle()}</h1>

        {/* Status Indicators */}
        <div
          css={statusIndicatorStyles}
          title={
            isSystemOnline === false
              ? 'System Offline'
              : isSystemOnline === true
                ? 'System Online'
                : 'Checking Status...'
          }
        >
          <span
            css={css`
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${isSystemOnline === false
                ? designTokens.colors.semantic.error[500]
                : isSystemOnline === true
                  ? designTokens.colors.semantic.success[500]
                  : designTokens.colors.neutral[400]};
              box-shadow: 0 0 8px
                ${isSystemOnline === false
                  ? designTokens.colors.semantic.error[300]
                  : isSystemOnline === true
                    ? designTokens.colors.semantic.success[300]
                    : 'transparent'};
            `}
          />
          {!isMobile && (
            <span
              style={{
                color:
                  isSystemOnline === false ? designTokens.colors.semantic.error[700] : 'inherit',
              }}
            >
              {isSystemOnline === false
                ? 'System Offline'
                : isSystemOnline === true
                  ? 'System Online'
                  : 'Checking Status...'}
            </span>
          )}
          {isSystemOnline === false ? (
            <ShieldAlert size={14} color={designTokens.colors.semantic.error[500]} />
          ) : isSystemOnline === true ? (
            <ShieldCheck size={14} color={designTokens.colors.semantic.success[500]} />
          ) : null}
        </div>
      </div>

      <div css={actionsStyles}>
        {/* Add Agent Button */}
        <button
          css={addAgentButtonStyle}
          onClick={() => navigate('/agents/connect')}
          title="Connect a new agent"
        >
          <Plus size={18} />
          {!isMobile && <span>Add Agent</span>}
        </button>

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
            onClick={() => setIsOpen(true)}
            title="Open command palette (Ctrl+K)"
          >
            <ChevronRight size={14} />
            <span>Search</span>
          </button>
        )}

        {/* Mobile Menu Toggle */}
        {isMobile && (
          <button css={modernButtonStyle} onClick={toggleSidebar} title="Toggle menu">
            <Menu size={20} />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          css={modernButtonStyle}
          onClick={handleThemeToggle}
          title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {effectiveTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Search on Mobile */}
        {isMobile && (
          <button css={modernButtonStyle} onClick={() => setIsOpen(true)} title="Search">
            <Search size={20} />
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
            <Bell size={20} />
            {/* Notification badge - only show if there are actual notifications */}
            {/* For now, we follow the instruction to remove fake pulsing dots */}
          </button>
        )}

        {/* Connection Center Toggle */}
        <button
          onClick={() => setIsConnectionModalOpen(true)}
          css={css`
            ${modernButtonStyle}
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
            background: ${connectedCount > 0
              ? (effectiveTheme === 'dark' ? designTokens.colors.neutral[800] : designTokens.colors.neutral[100])
              : 'transparent'};
            border: 1px solid ${connectedCount > 0
              ? (effectiveTheme === 'dark' ? designTokens.colors.neutral[700] : designTokens.colors.neutral[200])
              : designTokens.colors.neutral[300]};
            color: ${connectedCount > 0
              ? (effectiveTheme === 'dark' ? designTokens.colors.neutral[100] : designTokens.colors.neutral[900])
              : designTokens.colors.neutral[700]};
          `}
          title="Connection Center"
        >
          <Vault size={16} />
          {!isMobile && <span>{connectedCount > 0 ? `${connectedCount}/3 Connected` : 'Connect'}</span>}
        </button>

        {/* User Menu */}
        {user.isConnected && (
          <button
            css={modernButtonStyle}
            onClick={() => setIsOpen(true)}
            title="User Settings (Search commands)"
          >
            <Settings size={20} />
          </button>
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette />

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
      />
    </header>
  );
};

export default Header;
