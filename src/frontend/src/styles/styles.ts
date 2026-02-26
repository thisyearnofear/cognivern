import { css } from "@emotion/react";
import { designTokens } from "./designTokens";

// Button Styles
export const getButtonStyles = (
  variant: "primary" | "secondary" | "outline" | "ghost" = "primary",
  size: "sm" | "md" | "lg" = "md",
) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.md};
  font-weight: ${designTokens.typography.fontWeight.medium};
  transition: all ${designTokens.animation.duration.normal}
    ${designTokens.animation.easing.easeInOut};
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;

  ${size === "sm" &&
  css`
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    font-size: ${designTokens.typography.fontSize.sm};
    min-height: 32px;
  `}

  ${size === "md" &&
  css`
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    font-size: ${designTokens.typography.fontSize.base};
    min-height: 40px;
  `}

  ${size === "lg" &&
  css`
    padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]};
    font-size: ${designTokens.typography.fontSize.lg};
    min-height: 48px;
  `}

  ${variant === "primary" &&
  css`
    background-color: ${designTokens.colors.primary[500]};
    color: ${designTokens.colors.neutral[0]};

    &:hover {
      background-color: ${designTokens.colors.primary[600]};
      transform: translateY(-1px);
      box-shadow: ${designTokens.shadows.md};
    }

    &:active {
      background-color: ${designTokens.colors.primary[700]};
      transform: translateY(0);
    }
  `}

  ${variant === "secondary" &&
  css`
    background-color: ${designTokens.colors.secondary[100]};
    color: ${designTokens.colors.secondary[700]};

    &:hover {
      background-color: ${designTokens.colors.secondary[200]};
      transform: translateY(-1px);
      box-shadow: ${designTokens.shadows.md};
    }
  `}

  ${variant === "outline" &&
  css`
    background-color: transparent;
    color: ${designTokens.colors.primary[600]};
    border-color: ${designTokens.colors.primary[300]};

    &:hover {
      background-color: ${designTokens.colors.primary[50]};
      border-color: ${designTokens.colors.primary[400]};
    }
  `}

  ${variant === "ghost" &&
  css`
    background-color: transparent;
    color: ${designTokens.colors.secondary[700]};

    &:hover {
      background-color: ${designTokens.colors.secondary[100]};
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
`;

// Card Styles
export const getCardStyles = (
  variant: "default" | "elevated" | "outlined" = "default",
) => css`
  background-color: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.lg};
  overflow: hidden;

  ${variant === "default" &&
  css`
    box-shadow: ${designTokens.shadows.sm};
  `}

  ${variant === "elevated" &&
  css`
    box-shadow: ${designTokens.shadows.lg};
  `}

  ${variant === "outlined" &&
  css`
    border: 1px solid ${designTokens.colors.neutral[200]};
    box-shadow: none;
  `}
`;

export const cardHeaderStyles = css`
  padding: ${designTokens.spacing[6]} ${designTokens.spacing[6]}
    ${designTokens.spacing[4]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
`;

export const cardTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0 0 ${designTokens.spacing[2]} 0;
`;

export const cardDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  color: ${designTokens.colors.neutral[600]};
  margin: 0;
  line-height: ${designTokens.typography.lineHeight.relaxed};
`;

export const cardContentStyles = css`
  padding: ${designTokens.spacing[6]};
`;

export const cardFooterStyles = css`
  padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]}
    ${designTokens.spacing[6]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${designTokens.spacing[3]};
`;

// Performance Dashboard Styles
export const performanceDashboardGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${designTokens.spacing[4]};
  padding: ${designTokens.spacing[4]};
`;

export const getPerformanceScoreStyles = (scoreColor: string) => css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${scoreColor};
  text-align: center;
  margin: ${designTokens.spacing[2]} 0;
`;

export const performanceScoreDescriptionStyles = css`
  text-align: center;
  color: ${designTokens.colors.neutral[600]};
`;

export const performanceMetricRowStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${designTokens.spacing[2]} 0;
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
`;

export const performanceMetricLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[700]};
`;

export const getPerformanceMetricValueStyles = (statusColor: string) => css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${statusColor};
`;

export const performanceAlertStyles = css`
  padding: ${designTokens.spacing[3]};
  background-color: ${designTokens.colors.semantic.warning[50]};
  border: 1px solid ${designTokens.colors.semantic.warning[200]};
  border-radius: ${designTokens.borderRadius.md};
  margin-bottom: ${designTokens.spacing[2]};
`;

export const performanceAlertContentStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const performanceAlertMessageStyles = css`
  font-weight: ${designTokens.typography.fontWeight.semibold};
`;

export const performanceAlertTimestampStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
`;

export const performanceAlertMoreStyles = css`
  text-align: center;
  margin-top: ${designTokens.spacing[2]};
  color: ${designTokens.colors.neutral[600]};
`;

export const performanceControlsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  margin-bottom: ${designTokens.spacing[4]};
`;

export const performanceDetailSectionStyles = css`
  margin-top: ${designTokens.spacing[4]};
`;

export const performanceDetailItemStyles = css`
  padding: ${designTokens.spacing[2]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  font-size: ${designTokens.typography.fontSize.xs};
`;

export const performanceDetailItemTitleStyles = css`
  font-weight: ${designTokens.typography.fontWeight.semibold};
`;

export const performanceDetailItemValueStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
`;

export const pageSkeletonContainerStyles = css`
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 2rem;
`;

export const pageSkeletonCardStyles = css`
  width: 100%;
  max-width: 600px;
`;

// Command Palette Styles
export const commandPaletteInputStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[4]};
  border: none;
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  font-size: ${designTokens.typography.fontSize.base};
  outline: none;
  background: transparent;

  &::placeholder {
    color: ${designTokens.colors.neutral[500]};
  }
`;

export const commandPaletteListStyles = css`
  max-height: 400px;
  overflow-y: auto;
`;

export const commandPaletteCategoryStyles = css`
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[600]};
  background-color: ${designTokens.colors.neutral[50]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
`;

export const getCommandPaletteItemStyles = (isSelected: boolean) => css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  cursor: pointer;
  border-bottom: 1px solid ${designTokens.colors.neutral[100]};

  ${isSelected &&
  css`
    background-color: ${designTokens.colors.primary[50]};
    border-left: 3px solid ${designTokens.colors.primary[500]};
  `}

  &:hover {
    background-color: ${designTokens.colors.neutral[50]};
  }
`;

export const commandPaletteIconStyles = css`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${designTokens.colors.neutral[600]};
`;

export const commandPaletteTextStyles = css`
  flex: 1;
`;

export const commandPaletteTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.medium};
  color: ${designTokens.colors.neutral[900]};
  margin: 0 0 ${designTokens.spacing[1]} 0;
`;

export const commandPaletteDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  margin: 0;
`;

export const commandPaletteInputContainerStyles = css`
  position: relative;
`;

export const commandPaletteNoResultsStyles = css`
  padding: ${designTokens.spacing[8]};
  text-align: center;
  color: ${designTokens.colors.neutral[500]};
`;

export const commandPaletteFooterStyles = css`
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
  background-color: ${designTokens.colors.neutral[50]};
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[600]};
  display: flex;
  justify-content: space-between;
`;

// Loading Spinner Styles
export const loadingSpinnerContainerStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${designTokens.spacing[3]};
`;

export const getLoadingSpinnerStyles = (size: "sm" | "md" | "lg" = "md") => css`
  border: 2px solid ${designTokens.colors.neutral[200]};
  border-top: 2px solid ${designTokens.colors.primary[500]};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  ${size === "sm" &&
  css`
    width: 16px;
    height: 16px;
  `}

  ${size === "md" &&
  css`
    width: 24px;
    height: 24px;
  `}

  ${size === "lg" &&
  css`
    width: 32px;
    height: 32px;
  `}

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export const getLoadingDotsStyles = (
  color: string = designTokens.colors.primary[500],
) => css`
  display: flex;
  gap: ${designTokens.spacing[1]};

  & > div {
    width: 8px;
    height: 8px;
    background-color: ${color};
    border-radius: 50%;
    animation: loadingDots 1.4s ease-in-out infinite both;
  }

  & > div:nth-of-type(1) {
    animation-delay: -0.32s;
  }
  & > div:nth-of-type(2) {
    animation-delay: -0.16s;
  }

  @keyframes loadingDots {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
`;

export const getLoadingPulseStyles = (
  color: string = designTokens.colors.primary[500],
) => css`
  width: 40px;
  height: 40px;
  background-color: ${color};
  border-radius: 50%;
  animation: loadingPulse 1s ease-in-out infinite;

  @keyframes loadingPulse {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
`;

export const getLoadingBarsStyles = (
  color: string = designTokens.colors.primary[500],
) => css`
  display: flex;
  gap: ${designTokens.spacing[1]};

  & > div {
    width: 4px;
    height: 20px;
    background-color: ${color};
    animation: loadingBars 1.2s ease-in-out infinite;
  }

  & > div:nth-of-type(1) {
    animation-delay: -1.1s;
  }
  & > div:nth-of-type(2) {
    animation-delay: -1s;
  }
  & > div:nth-of-type(3) {
    animation-delay: -0.9s;
  }

  @keyframes loadingBars {
    0%,
    40%,
    100% {
      transform: scaleY(0.4);
    }
    20% {
      transform: scaleY(1);
    }
  }
`;

export const getLoadingSpinnerTextStyles = (
  size: "sm" | "md" | "lg" = "md",
) => css`
  font-size: ${size === "sm"
    ? designTokens.typography.fontSize.sm
    : size === "lg"
      ? designTokens.typography.fontSize.lg
      : designTokens.typography.fontSize.base};
  color: ${designTokens.colors.neutral[600]};
  text-align: center;
`;

// Modal Styles
export const modalOverlayStyles = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${designTokens.zIndex.modal};
  padding: ${designTokens.spacing[4]};
`;

export const getModalStyles = (size: "sm" | "md" | "lg" | "xl" = "md") => css`
  background-color: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.lg};
  box-shadow: ${designTokens.shadows["2xl"]};
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  ${size === "sm" &&
  css`
    width: 100%;
    max-width: 400px;
  `}

  ${size === "md" &&
  css`
    width: 100%;
    max-width: 500px;
  `}

  ${size === "lg" &&
  css`
    width: 100%;
    max-width: 700px;
  `}

  ${size === "xl" &&
  css`
    width: 100%;
    max-width: 900px;
  `}
`;

export const modalHeaderStyles = css`
  padding: ${designTokens.spacing[6]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const modalTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0;
`;

export const modalContentStyles = css`
  padding: ${designTokens.spacing[6]};
  overflow-y: auto;
  flex: 1;
`;

export const modalFooterStyles = css`
  padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]}
    ${designTokens.spacing[6]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${designTokens.spacing[3]};
`;

export const modalCloseButtonStyles = css`
  background: none;
  border: none;
  font-size: ${designTokens.typography.fontSize.xl};
  color: ${designTokens.colors.neutral[500]};
  cursor: pointer;
  padding: ${designTokens.spacing[1]};
  border-radius: ${designTokens.borderRadius.sm};

  &:hover {
    background-color: ${designTokens.colors.neutral[100]};
    color: ${designTokens.colors.neutral[700]};
  }
`;

// Notification Styles
export const getNotificationContainerStyles = (
  position:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left" = "top-right",
) => css`
  position: fixed;
  z-index: ${designTokens.zIndex.toast};
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
  max-width: 400px;

  ${position === "top-right" &&
  css`
    top: ${designTokens.spacing[4]};
    right: ${designTokens.spacing[4]};
  `}

  ${position === "top-left" &&
  css`
    top: ${designTokens.spacing[4]};
    left: ${designTokens.spacing[4]};
  `}

  ${position === "bottom-right" &&
  css`
    bottom: ${designTokens.spacing[4]};
    right: ${designTokens.spacing[4]};
  `}

  ${position === "bottom-left" &&
  css`
    bottom: ${designTokens.spacing[4]};
    left: ${designTokens.spacing[4]};
  `}
`;

export const getNotificationItemStyles = (
  type: "success" | "error" | "warning" | "info" = "info",
) => css`
  background-color: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.md};
  box-shadow: ${designTokens.shadows.lg};
  padding: ${designTokens.spacing[4]};
  display: flex;
  align-items: flex-start;
  gap: ${designTokens.spacing[3]};
  min-width: 300px;
  border-left: 4px solid;

  ${type === "success" &&
  css`
    border-left-color: ${designTokens.colors.semantic.success[500]};
  `}

  ${type === "error" &&
  css`
    border-left-color: ${designTokens.colors.semantic.error[500]};
  `}

  ${type === "warning" &&
  css`
    border-left-color: ${designTokens.colors.semantic.warning[500]};
  `}

  ${type === "info" &&
  css`
    border-left-color: ${designTokens.colors.semantic.info[500]};
  `}
`;

export const getNotificationIconStyles = (
  type: "success" | "error" | "warning" | "info" = "info",
) => css`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;

  ${type === "success" &&
  css`
    background-color: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[600]};
  `}

  ${type === "error" &&
  css`
    background-color: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[600]};
  `}

  ${type === "warning" &&
  css`
    background-color: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[600]};
  `}

  ${type === "info" &&
  css`
    background-color: ${designTokens.colors.semantic.info[100]};
    color: ${designTokens.colors.semantic.info[600]};
  `}
`;

export const notificationContentStyles = css`
  flex: 1;
`;

export const notificationTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0 0 ${designTokens.spacing[1]} 0;
`;

export const notificationMessageStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  margin: 0;
  line-height: ${designTokens.typography.lineHeight.relaxed};
`;

export const notificationTimestampStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  margin-top: ${designTokens.spacing[2]};
`;

export const notificationCloseButtonStyles = css`
  background: none;
  border: none;
  color: ${designTokens.colors.neutral[500]};
  cursor: pointer;
  padding: ${designTokens.spacing[1]};
  border-radius: ${designTokens.borderRadius.sm};
  flex-shrink: 0;

  &:hover {
    background-color: ${designTokens.colors.neutral[100]};
    color: ${designTokens.colors.neutral[700]};
  }
`;

export const notificationActionStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  margin-top: ${designTokens.spacing[3]};
`;

export const notificationClearAllButtonContainerStyles = css`
  display: flex;
  justify-content: center;
  padding: ${designTokens.spacing[2]};
`;

// Page Transition Styles
export const pageTransitionContainerStyles = css`
  width: 100%;
  height: 100%;
`;

export const getPageTransitionContentStyles = (
  type: "fade" | "slide" | "scale" = "fade",
  isEntering: boolean = true,
) => css`
  width: 100%;
  height: 100%;
  transition: all ${designTokens.animation.duration.normal}
    ${designTokens.animation.easing.easeInOut};

  ${type === "fade" &&
  css`
    opacity: ${isEntering ? 1 : 0};
  `}

  ${type === "slide" &&
  css`
    transform: translateX(${isEntering ? "0" : "20px"});
    opacity: ${isEntering ? 1 : 0};
  `}

  ${type === "scale" &&
  css`
    transform: scale(${isEntering ? 1 : 0.95});
    opacity: ${isEntering ? 1 : 0};
  `}
`;

// Toast Styles
export const getToastItemStyles = (
  type: "success" | "error" | "warning" | "info" = "info",
) => css`
  background-color: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.md};
  box-shadow: ${designTokens.shadows.lg};
  padding: ${designTokens.spacing[4]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  min-width: 300px;
  max-width: 500px;
  border-left: 4px solid;

  ${type === "success" &&
  css`
    border-left-color: ${designTokens.colors.semantic.success[500]};
  `}

  ${type === "error" &&
  css`
    border-left-color: ${designTokens.colors.semantic.error[500]};
  `}

  ${type === "warning" &&
  css`
    border-left-color: ${designTokens.colors.semantic.warning[500]};
  `}

  ${type === "info" &&
  css`
    border-left-color: ${designTokens.colors.semantic.info[500]};
  `}
`;

export const getToastIconStyles = (
  type: "success" | "error" | "warning" | "info" = "info",
) => css`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;

  ${type === "success" &&
  css`
    background-color: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[600]};
  `}

  ${type === "error" &&
  css`
    background-color: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[600]};
  `}

  ${type === "warning" &&
  css`
    background-color: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[600]};
  `}

  ${type === "info" &&
  css`
    background-color: ${designTokens.colors.semantic.info[100]};
    color: ${designTokens.colors.semantic.info[600]};
  `}
`;

export const toastContentStyles = css`
  flex: 1;
`;

export const toastMessageStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[700]};
  margin: 0;
  line-height: ${designTokens.typography.lineHeight.relaxed};
`;

export const toastActionsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  margin-left: ${designTokens.spacing[2]};
`;

export const toastActionButtonStyles = css`
  background: none;
  border: none;
  color: ${designTokens.colors.primary[600]};
  cursor: pointer;
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.sm};

  &:hover {
    background-color: ${designTokens.colors.primary[50]};
  }
`;

export const toastCloseButtonStyles = css`
  background: none;
  border: none;
  color: ${designTokens.colors.neutral[500]};
  cursor: pointer;
  padding: ${designTokens.spacing[1]};
  border-radius: ${designTokens.borderRadius.sm};
  flex-shrink: 0;

  &:hover {
    background-color: ${designTokens.colors.neutral[100]};
    color: ${designTokens.colors.neutral[700]};
  }
`;

export const toastInAnimation = css`
  animation: toastSlideIn 0.3s ease-out;

  @keyframes toastSlideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

export const toastOutAnimation = css`
  animation: toastSlideOut 0.3s ease-in;

  @keyframes toastSlideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;

// Data Table Styles
export const dataTableStyles = css`
  width: 100%;
  border-collapse: collapse;
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[900]};
`;

export const dataTableHeaderStyles = css`
  background-color: ${designTokens.colors.neutral[50]};
  border-bottom: 2px solid ${designTokens.colors.neutral[200]};
`;

export const getDataTableHeaderCellStyles = (
  align: "left" | "center" | "right" = "left",
  sortable: boolean = false,
) => css`
  padding: ${designTokens.spacing[4]};
  text-align: ${align};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[700]};
  white-space: nowrap;
  ${sortable &&
  css`
    cursor: pointer;
    user-select: none;
    &:hover {
      background-color: ${designTokens.colors.neutral[100]};
    }
  `}
`;

export const getDataTableRowStyles = (clickable: boolean, index: number) => css`
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  background-color: ${index % 2 === 0
    ? designTokens.colors.neutral[0]
    : designTokens.colors.neutral[50]};
  transition: background-color ${designTokens.animation.duration.fast};

  ${clickable &&
  css`
    cursor: pointer;
    &:hover {
      background-color: ${designTokens.colors.primary[50]};
    }
  `}
`;

export const getDataTableCellStyles = (
  align: "left" | "center" | "right" = "left",
) => css`
  padding: ${designTokens.spacing[4]};
  text-align: ${align};
`;

export const dataTablePaginationStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${designTokens.spacing[4]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
  background-color: ${designTokens.colors.neutral[0]};
`;

export const dataTableSearchStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
  border: 1px solid ${designTokens.colors.neutral[300]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.sm};
  margin-bottom: ${designTokens.spacing[4]};

  &:focus {
    outline: none;
    border-color: ${designTokens.colors.primary[500]};
    box-shadow: 0 0 0 2px ${designTokens.colors.primary[100]};
  }
`;

export const dataTableMobileCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[4]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
`;

export const dataTableMobileCardTitleStyles = css`
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.xs};
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

export const dataTableLoadingStyles = css`
  padding: ${designTokens.spacing[8]};
  text-align: center;
  color: ${designTokens.colors.neutral[500]};
`;

export const dataTablePaginationInfoStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
`;

export const dataTablePaginationControlsStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
`;

export const dataTablePaginationPageInfoStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  margin: 0 ${designTokens.spacing[2]};
`;

// Chart Styles
export const chartContainerStyles = css`
  position: relative;
  width: 100%;
  background-color: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.lg};
  padding: ${designTokens.spacing[4]};
`;

export const chartCanvasStyles = css`
  display: block;
  max-width: 100%;
`;

export const getChartTooltipStyles = (x: number, y: number) => css`
  position: absolute;
  top: ${y}px;
  left: ${x}px;
  transform: translate(-50%, -100%);
  margin-top: -${designTokens.spacing[2]};
  background-color: rgba(15, 23, 42, 0.9);
  color: ${designTokens.colors.neutral[0]};
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.xs};
  pointer-events: none;
  z-index: ${designTokens.zIndex.tooltip};
  white-space: nowrap;
  box-shadow: ${designTokens.shadows.lg};
`;
