import { designTokens } from "../../designTokens";

// Enhanced shadow system with depth and effects
export const shadowSystem = {
  ...designTokens.shadows,

  // Neumorphism shadows
  neumorphism: {
    light: {
      raised: "8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff",
      inset: "inset 8px 8px 16px #d1d9e6, inset -8px -8px 16px #ffffff",
    },
    dark: {
      raised: "8px 8px 16px #0a0a0a, -8px -8px 16px #2a2a2a",
      inset: "inset 8px 8px 16px #0a0a0a, inset -8px -8px 16px #2a2a2a",
    },
  },

  // Glow effects
  glow: {
    primary: `0 0 20px ${designTokens.colors.primary[500]}40`,
    success: `0 0 20px ${designTokens.colors.semantic.success[500]}40`,
    warning: `0 0 20px ${designTokens.colors.semantic.warning[500]}40`,
    error: `0 0 20px ${designTokens.colors.semantic.error[500]}40`,
  },

  // Floating elements
  floating: "0 10px 30px rgba(0, 0, 0, 0.1), 0 1px 8px rgba(0, 0, 0, 0.2)",
  floatingHover:
    "0 20px 40px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.25)",
} as const;

export type ShadowSystem = typeof shadowSystem;
