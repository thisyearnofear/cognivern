import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

export const tableStyles = {
  table: css`
    width: 100%;
    border-collapse: collapse;
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[900]};
  `,
  header: css`
    background-color: ${designTokens.colors.neutral[50]};
    border-bottom: 2px solid ${designTokens.colors.neutral[200]};
  `,
  headerCell: (align: "left" | "center" | "right" = "left", sortable: boolean = false) => css`
    padding: ${designTokens.spacing[4]};
    text-align: ${align};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[700]};
    white-space: nowrap;
    ${sortable &&
    css`
      cursor: pointer;
      user-select: none;
      &:hover {
        background-color: ${designTokens.colors.neutral[100]};
      }
    `}
  `,
  row: (clickable: boolean, index: number) => css`
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
    background-color: ${index % 2 === 0 ? designTokens.colors.neutral[0] : designTokens.colors.neutral[50]};
    transition: background-color ${designTokens.animation.duration.fast};

    ${clickable &&
    css`
      cursor: pointer;
      &:hover {
        background-color: ${designTokens.colors.primary[50]};
      }
    `}
  `,
  cell: (align: "left" | "center" | "right" = "left") => css`
    padding: ${designTokens.spacing[4]};
    text-align: ${align};
  `,
  pagination: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${designTokens.spacing[4]};
    border-top: 1px solid ${designTokens.colors.neutral[200]};
    background-color: ${designTokens.colors.neutral[0]};
  `,
  search: css`
    width: 100%;
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
    border: 1px solid ${designTokens.colors.neutral[300]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
    margin-bottom: ${designTokens.spacing[4]};

    &:focus {
      outline: none;
      border-color: ${designTokens.colors.primary[500]};
      box-shadow: 0 0 0 2px ${designTokens.colors.primary[100]};
    }
  `,
  mobileCard: css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[4]};
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  `,
  mobileCardTitle: css`
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[600]};
    font-size: ${designTokens.typography.fontSize.xs};
    text-transform: uppercase;
    letter-spacing: 0.025em;
  `,
  loading: css`
    padding: ${designTokens.spacing[8]};
    text-align: center;
    color: ${designTokens.colors.neutral[500]};
  `,
  paginationInfo: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
  `,
  paginationControls: css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
  `,
  paginationPageInfo: css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    margin: 0 ${designTokens.spacing[2]};
  `,
};
