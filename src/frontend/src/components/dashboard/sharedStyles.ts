import { css } from "@emotion/react";
import { designTokens, shadowSystem } from "../../styles/design-system";

export const cardHoverStyles = css`
  border-color: ${designTokens.colors.primary[300]};
  background: ${designTokens.colors.primary[50]};
  transform: translateX(4px);
  transition: all 0.2s ease;
`;

export const cardHoverStylesNoTransform = css`
  border-color: ${designTokens.colors.primary[300]};
  background: ${designTokens.colors.primary[50]};
  transition: all 0.2s ease;
`;

export const textStyles = {
  description: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    line-height: ${designTokens.typography.lineHeight.relaxed};
  `,
  label: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    font-weight: ${designTokens.typography.fontWeight.medium};
  `,
  meta: css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[500]};
  `,
  title: css`
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[900]};
  `,
};

export const buttonStyles = {
  primary: css`
    width: 100%;
    padding: ${designTokens.spacing[3]};
    background: ${designTokens.colors.primary[500]};
    color: white;
    border: none;
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: ${designTokens.colors.primary[600]};
    }
  `,
  secondary: css`
    width: 100%;
    padding: ${designTokens.spacing[3]};
    background: transparent;
    color: ${designTokens.colors.primary[600]};
    border: 1px solid ${designTokens.colors.primary[300]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${designTokens.colors.primary[50]};
    }
  `,
};
