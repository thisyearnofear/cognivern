import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

export const performanceStyles = {
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: ${designTokens.spacing[4]};
    padding: ${designTokens.spacing[4]};
  `,
  score: (scoreColor: string) => css`
    font-size: ${designTokens.typography.fontSize["3xl"]};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${scoreColor};
    text-align: center;
    margin: ${designTokens.spacing[2]} 0;
  `,
  scoreDescription: css`
    text-align: center;
    color: ${designTokens.colors.neutral[600]};
  `,
  metricRow: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${designTokens.spacing[2]} 0;
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  `,
  metricLabel: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[700]};
  `,
  metricValue: (statusColor: string) => css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${statusColor};
  `,
  alert: css`
    padding: ${designTokens.spacing[3]};
    background-color: ${designTokens.colors.semantic.warning[50]};
    border: 1px solid ${designTokens.colors.semantic.warning[200]};
    border-radius: ${designTokens.borderRadius.md};
    margin-bottom: ${designTokens.spacing[2]};
  `,
  alertContent: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  alertMessage: css`
    font-weight: ${designTokens.typography.fontWeight.semibold};
  `,
  alertTimestamp: css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[500]};
  `,
  alertMore: css`
    text-align: center;
    margin-top: ${designTokens.spacing[2]};
    color: ${designTokens.colors.neutral[600]};
  `,
  controls: css`
    display: flex;
    gap: ${designTokens.spacing[2]};
    margin-bottom: ${designTokens.spacing[4]};
  `,
  detailSection: css`
    margin-top: ${designTokens.spacing[4]};
  `,
  detailItem: css`
    padding: ${designTokens.spacing[2]};
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
    font-size: ${designTokens.typography.fontSize.xs};
  `,
  detailItemTitle: css`
    font-weight: ${designTokens.typography.fontWeight.semibold};
  `,
  detailItemValue: css`
    font-size: ${designTokens.typography.fontSize.xs};
  `,
};
