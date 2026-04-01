import { css } from "@emotion/react";
import { designTokens } from "../tokens/designTokens";

export const commandPaletteStyles = {
  input: css`
    width: 100%;
    padding: ${designTokens.spacing[4]};
    border: none;
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
    font-size: ${designTokens.typography.fontSize.base};
    outline: none;
    background: transparent;

    &::placeholder {
      color: ${designTokens.colors.neutral[500]};
    }
  `,
  list: css`
    max-height: 400px;
    overflow-y: auto;

    @media (max-width: ${designTokens.breakpoints.md}) {
      max-height: none;
      flex: 1;
    }
  `,
  category: css`
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[600]};
    background-color: ${designTokens.colors.neutral[50]};
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  `,
  item: (isSelected: boolean) => css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    cursor: pointer;
    border-bottom: 1px solid ${designTokens.colors.neutral[100]};
    transition: all ${designTokens.animation.duration.fast} ease;

    @media (max-width: ${designTokens.breakpoints.md}) {
      padding: ${designTokens.spacing[4]};
      gap: ${designTokens.spacing[4]};
    }

    ${isSelected &&
    css`
      background-color: ${designTokens.colors.primary[50]};
      border-left: 3px solid ${designTokens.colors.primary[500]};
      padding-left: calc(${designTokens.spacing[4]} - 3px);
    `}

    &:hover {
      background-color: ${designTokens.colors.neutral[50]};
    }

    &:active {
      background-color: ${designTokens.colors.primary[100]};
    }
  `,
  icon: css`
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${designTokens.colors.neutral[600]};
  `,
  text: css`
    flex: 1;
  `,
  title: css`
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${designTokens.colors.neutral[900]};
    margin: 0 0 ${designTokens.spacing[1]} 0;
  `,
  description: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    margin: 0;
  `,
  inputContainer: css`
    position: relative;
  `,
  noResults: css`
    padding: ${designTokens.spacing[8]};
    text-align: center;
    color: ${designTokens.colors.neutral[500]};
  `,
  footer: css`
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    border-top: 1px solid ${designTokens.colors.neutral[200]};
    background-color: ${designTokens.colors.neutral[50]};
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[600]};
    display: flex;
    justify-content: space-between;
    align-items: center;

    @media (max-width: ${designTokens.breakpoints.md}) {
      flex-direction: column;
      gap: ${designTokens.spacing[2]};
      text-align: center;
      padding: ${designTokens.spacing[4]};
    }
  `,
};
