import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

export const containerStyles = (isMobile: boolean) => css`
  padding: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[8]};
  padding-bottom: ${isMobile
    ? 'calc(72px + env(safe-area-inset-bottom))'
    : designTokens.spacing[8]};
  max-width: 1440px;
  margin: 0 auto;
  position: relative;
  overflow-y: auto;
  height: 100%;
  background: ${designTokens.colors.secondary[50]};

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

export const statsHeaderStyles = css`
  margin-bottom: ${designTokens.spacing[4]};
`;

export const titleStyles = css`
  font-size: ${designTokens.typography.fontSize['2xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: var(--section-title, ${designTokens.colors.text.primary});
  margin-bottom: ${designTokens.spacing[2]};
  letter-spacing: -0.025em;
`;

export const statsGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile
    ? 'repeat(2, 1fr)'
    : isTablet
      ? 'repeat(2, 1fr)'
      : 'repeat(4, 1fr)'};
  gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[6]};
  margin-bottom: ${isMobile ? designTokens.spacing[4] : designTokens.spacing[8]};
`;

export const mainGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile ? '1fr' : isTablet ? '1fr' : '3fr 2fr'};
  gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[8]};
  align-items: start;
`;

export const chartsGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile ? '1fr' : isTablet ? '1fr' : 'repeat(2, 1fr)'};
  gap: ${isMobile ? designTokens.spacing[2] : designTokens.spacing[6]};
  margin-bottom: ${isMobile ? designTokens.spacing[4] : designTokens.spacing[8]};
`;

export const sectionStyles = css`
  margin-bottom: ${designTokens.spacing[4]};
`;

export const sectionHeaderStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${designTokens.spacing[4]};
`;

export const sectionTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: var(--section-title, ${designTokens.colors.text.primary});
`;

export const agentGridStyles = (columns: number) => css`
  display: grid;
  grid-template-columns: repeat(${columns}, 1fr);
  gap: ${designTokens.spacing[3]};
`;

export const carouselStyles = css`
  display: flex;
  overflow-x: auto;
  gap: ${designTokens.spacing[4]};
  padding-bottom: ${designTokens.spacing[4]};
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }

  & > * {
    flex: 0 0 85%;
    scroll-snap-align: center;
  }
`;

export const activityFeedStyles = (_compact?: boolean) => css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[2]};
  max-height: 300px;
  overflow-y: auto;
`;

export const activityItemStyles = css`
  display: flex;
  align-items: flex-start;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[2]} 0;
  border-bottom: 1px solid var(--divider, ${designTokens.colors.border.primary});

  &:last-child {
    border-bottom: none;
  }
`;

export const activityIconStyles = (type?: string) => {
  const colorMap = {
    success: designTokens.colors.semantic.success[500],
    warning: designTokens.colors.semantic.warning[500],
    error: designTokens.colors.semantic.error[500],
    info: designTokens.colors.primary[500],
  };

  const bgMap = {
    success: `${designTokens.colors.semantic.success[500]}15`,
    warning: `${designTokens.colors.semantic.warning[500]}15`,
    error: `${designTokens.colors.semantic.error[500]}15`,
    info: `${designTokens.colors.primary[500]}15`,
  };

  const statusType = (type || 'info') as keyof typeof colorMap;

  return css`
    width: 40px;
    height: 40px;
    border-radius: ${designTokens.borderRadius.md};
    background: ${bgMap[statusType] || bgMap.info};
    color: ${colorMap[statusType] || colorMap.info};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  `;
};

export const activityDetailsStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[1]};
`;

export const activityTextStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: var(--section-title, ${designTokens.colors.text.primary});
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

export const activityTimeStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: var(--text-secondary, ${designTokens.colors.text.secondary});
`;

export const showMoreButtonStyles = css`
  background: none;
  border: none;
  color: ${designTokens.colors.primary[600]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  cursor: pointer;
  padding: ${designTokens.spacing[2]};
  text-align: center;
  width: 100%;

  &:hover {
    text-decoration: underline;
  }
`;

export const emptyStateStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${designTokens.spacing[12]};
  color: var(--text-secondary, ${designTokens.colors.text.secondary});
  text-align: center;
  gap: ${designTokens.spacing[2]};

  & svg {
    margin-bottom: ${designTokens.spacing[2]};
    opacity: 0.5;
  }
`;

export const loadingStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${designTokens.spacing[12]};
  color: var(--text-secondary, ${designTokens.colors.text.secondary});
`;

export const pullToRefreshIndicatorStyles = (distance: number) => css`
  position: absolute;
  top: ${distance - 40}px;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${designTokens.typography.fontSize.xs};
  color: var(--text-secondary, ${designTokens.colors.text.secondary});
  transition: top 0.1s ease-out;
  z-index: 10;
`;

export const refreshingIndicatorStyles = css`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: ${designTokens.colors.primary[500]};
  z-index: 20;
  animation: loading-bar 2s infinite ease-in-out;

  @keyframes loading-bar {
    0% {
      transform: scaleX(0);
      transform-origin: left;
    }
    50% {
      transform: scaleX(1);
      transform-origin: left;
    }
    51% {
      transform: scaleX(1);
      transform-origin: right;
    }
    100% {
      transform: scaleX(0);
      transform-origin: right;
    }
  }
`;

export const liveIndicatorStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.text.secondary};
  background: var(--surface-bg-alt, ${designTokens.colors.background.secondary});
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.full};
  border: 1px solid var(--divider, ${designTokens.colors.border.primary});
`;

export const pulseDotStyles = css`
  width: 8px;
  height: 8px;
  background-color: ${designTokens.colors.semantic.success[500]};
  border-radius: 50%;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: inherit;
    border-radius: 50%;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    70% {
      transform: scale(2.5);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
`;

export const badgeContainerStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  align-items: center;
`;

export const systemBadgeStyles = (color: 'success' | 'warning' | 'error' | 'info' = 'info') => {
  const colorMap = {
    success: designTokens.colors.semantic.success[600],
    warning: designTokens.colors.semantic.warning[600],
    error: designTokens.colors.semantic.error[600],
    info: designTokens.colors.primary[600],
  };

  const bgMap = {
    success: `${designTokens.colors.semantic.success[500]}15`,
    warning: `${designTokens.colors.semantic.warning[500]}15`,
    error: `${designTokens.colors.semantic.error[500]}15`,
    info: `${designTokens.colors.primary[500]}15`,
  };

  return css`
    font-size: 10px;
    font-weight: ${designTokens.typography.fontWeight.bold};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: ${designTokens.borderRadius.sm};
    background: ${bgMap[color]};
    color: ${colorMap[color]};
    white-space: nowrap;
  `;
};

export const mobileActionsStyles = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card-bg, ${designTokens.colors.background.primary});
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--divider, ${designTokens.colors.border.primary});
  padding: ${designTokens.spacing[2]};
  padding-bottom: calc(${designTokens.spacing[2]} + env(safe-area-inset-bottom));
  z-index: 100;
  box-shadow: ${designTokens.shadows.lg};
`;

export const mobileActionButtonStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${designTokens.spacing[1]};
  background: none;
  border: none;
  padding: ${designTokens.spacing[2]};
  font-size: 11px;
  font-weight: ${designTokens.typography.fontWeight.medium};
  color: var(--text-secondary, ${designTokens.colors.text.secondary});
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  border-radius: ${designTokens.borderRadius.md};
  transition: background 0.15s;

  &:active {
    background: var(--surface-bg-alt, ${designTokens.colors.background.secondary});
  }
`;

export const mobileActionIconStyles = css`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary, ${designTokens.colors.text.primary});
`;

export const minimalContainerStyles = css`
  padding: ${designTokens.spacing[4]};
  background: #111;
  color: #0f0;
  font-family: monospace;
  height: 100%;
  overflow: auto;
`;

export const jsonDisplayStyles = css`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
`;
