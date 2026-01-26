import { designTokens } from "../../designTokens";

// Enhanced color system with semantic meanings
export const colorSystem = {
  ...designTokens.colors,

  // Brand gradients
  gradients: {
    primary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    success: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    warning: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    danger: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    dark: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    light: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  },

  // Glass morphism colors
  glass: {
    light: "rgba(255, 255, 255, 0.25)",
    dark: "rgba(0, 0, 0, 0.25)",
    backdrop: "rgba(255, 255, 255, 0.1)",
  },
} as const;

export type ColorSystem = typeof colorSystem;
