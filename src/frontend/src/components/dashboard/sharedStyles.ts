import { css } from "@emotion/react";
import { designTokens } from "../../styles/design-system";

export const cardHoverStyles = css`
  border-color: ${designTokens.colors.primary[300]};
  background: ${designTokens.colors.primary[50]};
  transform: translateX(4px);
`;

export const cardHoverStylesNoTransform = css`
  border-color: ${designTokens.colors.primary[300]};
  background: ${designTokens.colors.primary[50]};
`;

export const textStyles = {
  description: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
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
};

export const buttonStyles = {
  primary: css`
    padding: ${designTokens.spacing[3]};
    background: ${designTokens.colors.primary[500]};
    color: white;
    border: none;
    border-radius: ${designTokens.borderRadius.md};
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${designTokens.colors.primary[600]};
    }
  `,
  secondary: css`
    padding: ${designTokens.spacing[3]};
    background: transparent;
    color: ${designTokens.colors.primary[600]};
    border: 1px solid ${designTokens.colors.primary[300]};
    border-radius: ${designTokens.borderRadius.md};
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${designTokens.colors.primary[50]};
    }
  `,
};
