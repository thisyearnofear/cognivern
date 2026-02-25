import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

/**
 * Form Design System Components
 *
 * CORE PRINCIPLES:
 * - MODULAR: Clear separation between container, groups, and inputs
 * - PERFORMANT: Lean CSS-in-JS using design tokens
 * - DRY: Single source of truth for all form-related styles
 */

export const formStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[6]};
  width: 100%;
`;

export const getFormFieldGroupStyles = (layout: "vertical" | "horizontal" = "vertical") => css`
  display: flex;
  flex-direction: ${layout === "vertical" ? "column" : "row"};
  gap: ${layout === "vertical" ? designTokens.spacing[2] : designTokens.spacing[4]};
  align-items: ${layout === "vertical" ? "flex-start" : "center"};
  width: 100%;
`;

export const getFormLabelStyles = (layout: "vertical" | "horizontal" = "vertical") => css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[700]};
  min-width: ${layout === "horizontal" ? "120px" : "auto"};
  cursor: pointer;
  user-select: none;
`;

export const getFormInputStyles = (hasError: boolean = false) => css`
  width: 100%;
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  font-size: ${designTokens.typography.fontSize.base};
  font-family: ${designTokens.typography.fontFamily.sans.join(", ")};
  color: ${designTokens.colors.neutral[900]};
  background-color: ${designTokens.colors.neutral[0]};
  border: 1px solid ${hasError ? designTokens.colors.semantic.error : designTokens.colors.neutral[300]};
  border-radius: ${designTokens.borderRadius.md};
  transition: all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut};
  outline: none;

  &::placeholder {
    color: ${designTokens.colors.neutral[400]};
  }

  &:focus {
    border-color: ${hasError ? designTokens.colors.semantic.error : designTokens.colors.primary[500]};
    box-shadow: 0 0 0 3px ${hasError ? `${designTokens.colors.semantic.error}20` : `${designTokens.colors.primary[500]}20`};
  }

  &:disabled {
    background-color: ${designTokens.colors.neutral[100]};
    color: ${designTokens.colors.neutral[500]};
    cursor: not-allowed;
  }

  /* Specific styles for select and textarea */
  &[type="select"] {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right ${designTokens.spacing[3]} center;
    background-size: 1.5rem;
    padding-right: ${designTokens.spacing[10]};
  }

  textarea& {
    min-height: 100px;
    resize: vertical;
  }
`;

export const formErrorStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.semantic.error};
  margin-top: ${designTokens.spacing[1]};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

export const formDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  margin-top: ${designTokens.spacing[1]};
  line-height: ${designTokens.typography.lineHeight.normal};
`;

export const formSubmitContainerStyles = css`
  display: flex;
  justify-content: flex-end;
  gap: ${designTokens.spacing[3]};
  margin-top: ${designTokens.spacing[4]};
`;
