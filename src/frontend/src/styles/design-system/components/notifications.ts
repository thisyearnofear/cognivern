import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

export type StatusType = "success" | "error" | "warning" | "info";
export type Position = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export const notificationStyles = {
  container: (position: Position = "top-right") => css`
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
  `,
  item: (type: StatusType = "info") => css`
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
  `,
  icon: (type: StatusType = "info") => css`
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
  `,
  content: css`
    flex: 1;
  `,
  title: css`
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[900]};
    margin: 0 0 ${designTokens.spacing[1]} 0;
  `,
  message: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    margin: 0;
    line-height: ${designTokens.typography.lineHeight.relaxed};
  `,
  timestamp: css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[500]};
    margin-top: ${designTokens.spacing[2]};
  `,
  closeButton: css`
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
  `,
  actions: css`
    display: flex;
    gap: ${designTokens.spacing[2]};
    margin-top: ${designTokens.spacing[3]};
  `,
  clearAllContainer: css`
    display: flex;
    justify-content: center;
    padding: ${designTokens.spacing[2]};
  `,
};

export const toastStyles = {
  item: (type: StatusType = "info") => css`
    ${notificationStyles.item(type)}
    align-items: center;
    max-width: 500px;
  `,
  icon: (type: StatusType = "info") => notificationStyles.icon(type),
  content: notificationStyles.content,
  message: notificationStyles.message,
  actions: css`
    display: flex;
    gap: ${designTokens.spacing[2]};
    margin-left: ${designTokens.spacing[2]};
  `,
  actionButton: css`
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
  `,
  closeButton: notificationStyles.closeButton,
  animations: {
    in: css`
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
    `,
    out: css`
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
    `,
  },
};
