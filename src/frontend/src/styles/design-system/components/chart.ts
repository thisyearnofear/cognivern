import { css } from '@emotion/react';
import { designTokens } from '../tokens/designTokens';

// Consistent chart color palette
export const chartColors = [
  designTokens.colors.accent[500],
  designTokens.colors.semantic.success[500],
  designTokens.colors.semantic.warning[500],
  designTokens.colors.semantic.error[500],
  designTokens.colors.primary[500],
];

export const chartStyles = {
  container: css`
    position: relative;
    width: 100%;
    background: ${designTokens.colors.neutral[0]};
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[4]};
    transition: box-shadow 0.2s ease;
    &:hover {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
  `,
  canvas: css`
    display: block;
    max-width: 100%;
  `,
  tooltip: (x: number, y: number) => css`
    position: absolute;
    top: ${y}px;
    left: ${x}px;
    transform: translate(-50%, -100%);
    margin-top: -${designTokens.spacing[2]};
    background: rgba(15, 23, 42, 0.95);
    color: ${designTokens.colors.neutral[0]};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.xs};
    pointer-events: none;
    z-index: ${designTokens.zIndex.tooltip};
    white-space: nowrap;
    box-shadow: ${designTokens.shadows.lg};
    border: 1px solid ${designTokens.colors.neutral[700]};
    backdrop-filter: blur(8px);
  `,
  tooltipLabel: css`
    font-weight: ${designTokens.typography.fontWeight.semibold};
    margin-bottom: ${designTokens.spacing[1]};
    color: ${designTokens.colors.accent[300]};
  `,
  tooltipValue: css`
    font-weight: ${designTokens.typography.fontWeight.bold};
  `,
};
