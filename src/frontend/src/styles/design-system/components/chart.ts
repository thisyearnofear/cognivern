import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

export const chartStyles = {
  container: css`
    position: relative;
    width: 100%;
    background-color: ${designTokens.colors.neutral[0]};
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[4]};
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
    background-color: rgba(15, 23, 42, 0.9);
    color: ${designTokens.colors.neutral[0]};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.xs};
    pointer-events: none;
    z-index: ${designTokens.zIndex.tooltip};
    white-space: nowrap;
    box-shadow: ${designTokens.shadows.lg};
  `,
};
