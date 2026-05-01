/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react';
import { Card, CardContent } from './Card';
import { designTokens } from '../../styles/design-system';
import { AnimatedCounter } from './Animations';

export interface StatCardProps {
  label: string;
  value: string | number;
  total?: number;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'error' | 'info';
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
}

/**
 * StatCard - A high-density, centralized component for displaying metrics.
 *
 * CORE PRINCIPLES:
 * - MODULAR: Independent, reusable metric block
 * - PERFORMANT: Lean CSS-in-JS using design tokens
 * - ENHANCEMENT FIRST: Consolidates scattered stat implementations across the dashboard
 */

const statCardStyles = css`
  height: 100%;
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;

  &:hover {
    transform: translateY(-3px);
    box-shadow: ${designTokens.shadows.md};
  }

  &:active {
    transform: translateY(-1px);
  }
`;

const statCardContentStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
`;

const statIconStyles = (color: 'primary' | 'success' | 'error' | 'info') => {
  const colorMap = {
    primary: designTokens.colors.primary[500],
    success: designTokens.colors.semantic.success[600],
    error: designTokens.colors.semantic.error[600],
    info: designTokens.colors.primary[400],
  };

  const bgMap = {
    primary: `${designTokens.colors.primary[500]}15`,
    success: `${designTokens.colors.semantic.success[500]}15`,
    error: `${designTokens.colors.semantic.error[500]}15`,
    info: `${designTokens.colors.primary[400]}15`,
  };

  return css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: ${bgMap[color]};
    color: ${colorMap[color]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: 1rem;
    flex-shrink: 0;
    touch-action: manipulation;
    user-select: none;

    /* Ensure minimum touch target */
    min-width: 44px;
    min-height: 44px;

    svg {
      width: 20px;
      height: 20px;
    }
  `;
};

const statDetailsStyles = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const statValueContainerStyles = css`
  display: flex;
  align-items: baseline;
  gap: ${designTokens.spacing[1]};
`;

const statValueStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: var(--stat-value, ${designTokens.colors.neutral[900]});
  line-height: 1.2;
`;

const statTotalStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: var(--text-muted, ${designTokens.colors.neutral[500]});
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const statLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: var(--stat-label, ${designTokens.colors.neutral[600]});
  font-weight: ${designTokens.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: ${designTokens.spacing[1]};
`;

const trendStyles = (isPositive: boolean) => css`
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${isPositive
    ? designTokens.colors.semantic.success[600]
    : designTokens.colors.semantic.error[600]};
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: ${designTokens.spacing[1]};
`;

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  total,
  icon,
  color = 'primary',
  trend,
}) => {
  // Convert to number if possible for animation
  const numericValue = typeof value === 'number' ? value : parseFloat(value as string);

  return (
    <Card css={statCardStyles} interactive>
      <CardContent css={statCardContentStyles}>
        <div css={statIconStyles(color)}>{icon}</div>
        <div css={statDetailsStyles}>
          <div css={statValueContainerStyles}>
            {typeof value === 'number' ? (
              <AnimatedCounter value={value} format={(v) => v.toLocaleString()} />
            ) : (
              <span css={statValueStyles}>{value}</span>
            )}
            {total !== undefined && (
              <span css={statTotalStyles}>
                / {typeof total === 'number' ? total.toLocaleString() : total}
              </span>
            )}
          </div>
          <span css={statLabelStyles}>{label}</span>
          {trend && (
            <div css={trendStyles(trend.isPositive)}>
              {trend.isPositive ? '▲' : '▼'} {trend.value}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
