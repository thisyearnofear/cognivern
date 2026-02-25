import React from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/designTokens";

export interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | "default"
    | "success"
    | "error"
    | "warning"
    | "secondary"
    | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const badgeBaseStyles = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${designTokens.borderRadius.full};
  font-weight: ${designTokens.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.025em;
  transition: all 0.2s ease;
`;

const badgeVariantStyles = {
  default: css`
    background: ${designTokens.colors.neutral[100]};
    color: ${designTokens.colors.neutral[700]};
    border: 1px solid ${designTokens.colors.neutral[200]};
  `,
  success: css`
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
    border: 1px solid ${designTokens.colors.semantic.success[200]};
  `,
  error: css`
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
    border: 1px solid ${designTokens.colors.semantic.error[200]};
  `,
  warning: css`
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
    border: 1px solid ${designTokens.colors.semantic.warning[200]};
  `,
  secondary: css`
    background: ${designTokens.colors.primary[100]};
    color: ${designTokens.colors.primary[700]};
    border: 1px solid ${designTokens.colors.primary[200]};
  `,
  outline: css`
    background: transparent;
    color: ${designTokens.colors.neutral[600]};
    border: 1px solid ${designTokens.colors.neutral[300]};
  `,
};

const badgeSizeStyles = {
  sm: css`
    padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
    font-size: ${designTokens.typography.fontSize.xs};
  `,
  md: css`
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    font-size: ${designTokens.typography.fontSize.sm};
  `,
  lg: css`
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    font-size: ${designTokens.typography.fontSize.base};
  `,
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className,
}) => {
  return (
    <span
      css={[
        badgeBaseStyles,
        badgeVariantStyles[variant],
        badgeSizeStyles[size],
      ]}
      className={className}
    >
      {children}
    </span>
  );
};
