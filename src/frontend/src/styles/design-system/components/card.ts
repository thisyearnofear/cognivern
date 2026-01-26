import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";
import { shadowSystem } from "../tokens/shadows";
import { easings } from "../animations/keyframes";

// Card component variants
export type CardVariant = "default" | "elevated" | "glass" | "outlined";

export const cardStyles = {
  base: css`
    background: ${designTokens.colors.neutral[0]};
    border-radius: ${designTokens.borderRadius.xl};
    transition: ${easings.smooth};
    overflow: hidden;
  `,

  variants: {
    default: css`
      box-shadow: ${designTokens.shadows.lg};
      border: 1px solid ${designTokens.colors.neutral[200]};

      &:hover {
        transform: translateY(-2px);
        box-shadow: ${shadowSystem.floating};
        border-color: ${designTokens.colors.primary[300]};
      }
    `,

    elevated: css`
      box-shadow: ${shadowSystem.floating};
      border: 1px solid ${designTokens.colors.neutral[200]};

      &:hover {
        transform: translateY(-4px);
        box-shadow: ${shadowSystem.floatingHover};
        border-color: ${designTokens.colors.primary[300]};
      }
    `,

    glass: css`
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.18);

      &:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.35);
      }
    `,

    outlined: css`
      background: transparent;
      border: 2px solid ${designTokens.colors.neutral[200]};

      &:hover {
        border-color: ${designTokens.colors.primary[400]};
        background: ${designTokens.colors.primary[50]};
      }
    `,
  },
} as const;

// Card utility function
export const getCardStyles = (variant: CardVariant = "default") => css`
  ${cardStyles.base}
  ${cardStyles.variants[variant]}
`;
