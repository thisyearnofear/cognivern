import { css } from "@emotion/react";
import { designTokens, easings } from "../../styles/design-system";

export const containerStyles = (isMobile: boolean) => css`
  padding: ${isMobile ? designTokens.spacing[4] : designTokens.spacing[8]};
  max-width: 1440px;
  margin: 0 auto;
  position: relative;
  overflow-y: auto;
  height: 100%;
`;

export const statsHeaderStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

export const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: var(--section-title, ${designTokens.colors.text.primary});
  margin-bottom: ${designTokens.spacing[2]};
`;

export const statsGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile
    ? "1fr"
    : isTablet
      ? "repeat(2, 1fr)"
      : "repeat(4, 1fr)"};
  gap: ${designTokens.spacing[6]};
`;

export const mainGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile || isTablet ? "1fr" : "2fr 1fr"};
  gap: ${designTokens.spacing[8]};
`;

export const sectionStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

export const sectionHeaderStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${designTokens.spacing[4]};
`;

export const sectionTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: var(--section-title, ${designTokens.colors.text.primary});
`;

export const agentGridStyles = (columns: number) => css`
  display: grid;
  grid-template-columns: repeat(${columns}, 1fr);
  gap: ${designTokens.spacing[6]};
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

export const activityFeedStyles = (compact?: boolean) => css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[4]};
  padding: ${compact ? designTokens.spacing[2] : designTokens.spacing[4]};
`;

export const activityItemStyles = css`
  display: flex;
  gap: ${designTokens.spacing[4]};
  padding-bottom: ${designTokens.spacing[4]};
  border-bottom: 1px solid var(--divider, ${designTokens.colors.border.primary});

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

export const activityIconStyles = css`
  width: 40px;
  height: 40px;
  border-radius: ${designTokens.borderRadius.md};
  background: var(--surface-bg-alt, ${designTokens.colors.background.secondary});
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
`;

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

export const mobileActionsStyles = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${designTokens.colors.background.primary};
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid ${designTokens.colors.border.primary};
  padding: ${designTokens.spacing[2]};
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
  font-size: 10px;
  color: var(--text-secondary, ${designTokens.colors.text.secondary});
  cursor: pointer;

  &:active {
    background: var(--surface-bg-alt, ${designTokens.colors.background.secondary});
  }
`;

export const mobileActionIconStyles = css`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: var(--surface-bg-alt, ${designTokens.colors.background.secondary});
  border-radius: ${designTokens.borderRadius.sm};
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
