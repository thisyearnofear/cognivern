import React from 'react';
import { css } from '@emotion/react';
import { useAppStore } from '../../stores/appStore';
import { designTokens, easings } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Vault, CheckCircle2, Circle } from 'lucide-react';

interface ConnectionStatusBadgeProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Shared connection status component for Header, Sidebar, and MobileNav.
 * Single source of truth for displaying 3-way wallet connection state.
 */
export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  showLabel = true,
  size = 'md',
  interactive = false,
  onClick,
  className,
}) => {
  const { user } = useAppStore();
  const { isMobile } = useBreakpoint();

  // Calculate connection state
  const connections = {
    wallet: user.isConnected,
    treasury: user.owsWalletConnected,
    fhenix: user.fhenixConnected,
  };
  const connectedCount = Object.values(connections).filter(Boolean).length;
  const isFullyConnected = connectedCount === 3;

  // Styles
  const badgeStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${size === 'sm'
      ? `${designTokens.spacing[1]} ${designTokens.spacing[2]}`
      : `${designTokens.spacing[2]} ${designTokens.spacing[3]}`};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${size === 'sm'
      ? designTokens.typography.fontSize.xs
      : designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    transition: ${easings.smooth};
    background: ${connectedCount > 0
      ? designTokens.colors.neutral[100]
      : 'transparent'};
    border: 1px solid ${connectedCount > 0
      ? designTokens.colors.neutral[200]
      : designTokens.colors.neutral[300]};
    color: ${connectedCount > 0
      ? designTokens.colors.neutral[800]
      : designTokens.colors.neutral[600]};
    ${interactive ? `
      cursor: pointer;
      &:hover {
        background: ${designTokens.colors.neutral[50]};
        border-color: ${designTokens.colors.neutral[300]};
      }
      &:active {
        transform: scale(0.98);
      }
    ` : ''}
  `;

  const iconSize = size === 'sm' ? 14 : 16;
  const dotSize = size === 'sm' ? 4 : 6;

  // Mobile: show dots only
  if (isMobile) {
    return (
      <div css={badgeStyles} onClick={onClick} className={className}>
        <Vault size={iconSize} />
        <span css={css`
          display: flex;
          gap: 2px;
          align-items: center;
        `}>
          {connections.wallet && (
            <Circle size={dotSize} fill={designTokens.colors.semantic.success[500]} color={designTokens.colors.semantic.success[500]} />
          )}
          {connections.treasury && (
            <Circle size={dotSize} fill={designTokens.colors.semantic.success[500]} color={designTokens.colors.semantic.success[500]} />
          )}
          {connections.fhenix && (
            <Circle size={dotSize} fill={designTokens.colors.semantic.success[500]} color={designTokens.colors.semantic.success[500]} />
          )}
          {!connections.wallet && !connections.treasury && !connections.fhenix && (
            <span css={css`
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${designTokens.colors.neutral[400]};
            `}>
              0/3
            </span>
          )}
        </span>
      </div>
    );
  }

  // Desktop: show label + status
  return (
    <div css={badgeStyles} onClick={onClick} className={className}>
      <Vault size={iconSize} />
      {showLabel && (
        <span>
          {connectedCount > 0
            ? isFullyConnected
              ? 'All Connected'
              : `${connectedCount}/3 Connected`
            : 'Connect Wallet'}
        </span>
      )}
      {connectedCount > 0 && (
        <CheckCircle2
          size={iconSize}
          color={isFullyConnected
            ? designTokens.colors.semantic.success[500]
            : designTokens.colors.neutral[400]}
        />
      )}
    </div>
  );
};

export default ConnectionStatusBadge;
