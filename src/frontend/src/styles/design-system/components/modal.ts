import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export const modalStyles = {
  overlay: css`
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
    backdrop-filter: blur(4px);
  `,
  container: (size: ModalSize = "md") => css`
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
  `,
  header: css`
    padding: ${designTokens.spacing[6]};
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  title: css`
    font-size: ${designTokens.typography.fontSize.xl};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[900]};
    margin: 0;
  `,
  content: css`
    padding: ${designTokens.spacing[6]};
    overflow-y: auto;
    flex: 1;
  `,
  footer: css`
    padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]}
      ${designTokens.spacing[6]};
    border-top: 1px solid ${designTokens.colors.neutral[200]};
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${designTokens.spacing[3]};
  `,
  closeButton: css`
    background: none;
    border: none;
    font-size: ${designTokens.typography.fontSize.xl};
    color: ${designTokens.colors.neutral[500]};
    cursor: pointer;
    padding: ${designTokens.spacing[1]};
    border-radius: ${designTokens.borderRadius.sm};
    transition: all ${designTokens.animation.duration.fast} ease;

    &:hover {
      background-color: ${designTokens.colors.neutral[100]};
      color: ${designTokens.colors.neutral[700]};
    }
  `,
};
