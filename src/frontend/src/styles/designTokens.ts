// Design tokens for consistent styling across the application
export const designTokens = {
  colors: {
    // Primary brand colors
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
    },
    
    // Secondary colors
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    
    // Semantic colors
    semantic: {
      success: {
        50: '#f0fdf4',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        900: '#14532d',
      },
      warning: {
        50: '#fffbeb',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        900: '#78350f',
      },
      error: {
        50: '#fef2f2',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        900: '#7f1d1d',
      },
      info: {
        50: '#f0f9ff',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        900: '#1e3a8a',
      },
    },
    
    // Neutral grays
    neutral: {
      0: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
      1000: '#000000',
    },
  },
  
  // Spacing scale
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
    32: '128px',
    40: '160px',
    48: '192px',
    56: '224px',
    64: '256px',
  },
  
  // Typography scale
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
      '5xl': '48px',
      '6xl': '60px',
    },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    lineHeight: {
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
  },
  
  // Border radius
  borderRadius: {
    none: '0px',
    sm: '4px',
    base: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },
  
  // Z-index scale
  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
  
  // Animation durations
  animation: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      linear: 'linear',
    },
  },
  
  // Breakpoints for responsive design
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// Type helpers
export type ColorScale = keyof typeof designTokens.colors.primary;
export type SemanticColor = keyof typeof designTokens.colors.semantic;
export type SpacingValue = keyof typeof designTokens.spacing;
export type FontSize = keyof typeof designTokens.typography.fontSize;
export type FontWeight = keyof typeof designTokens.typography.fontWeight;
export type BorderRadius = keyof typeof designTokens.borderRadius;
export type Shadow = keyof typeof designTokens.shadows;

// Utility functions for accessing design tokens
export const getColor = (color: string, shade?: number | string) => {
  const colorPath = color.split('.');
  let value: any = designTokens.colors;
  
  for (const path of colorPath) {
    value = value[path];
  }
  
  if (shade && typeof value === 'object') {
    return value[shade];
  }
  
  return value;
};

export const getSpacing = (value: SpacingValue) => designTokens.spacing[value];
export const getFontSize = (size: FontSize) => designTokens.typography.fontSize[size];
export const getShadow = (shadow: Shadow) => designTokens.shadows[shadow];

// Responsive mixins for consistent breakpoint usage
export const responsive = {
  mobile: (styles: string) => `
    @media (max-width: ${designTokens.breakpoints.sm}) {
      ${styles}
    }
  `,
  
  tablet: (styles: string) => `
    @media (min-width: ${designTokens.breakpoints.sm}) and (max-width: ${designTokens.breakpoints.lg}) {
      ${styles}
    }
  `,
  
  desktop: (styles: string) => `
    @media (min-width: ${designTokens.breakpoints.lg}) {
      ${styles}
    }
  `,
  
  maxMd: (styles: string) => `
    @media (max-width: ${designTokens.breakpoints.md}) {
      ${styles}
    }
  `,
  
  maxLg: (styles: string) => `
    @media (max-width: ${designTokens.breakpoints.lg}) {
      ${styles}
    }
  `,
};

// Container utilities for consistent layouts
export const containers = {
  standard: `
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 ${designTokens.spacing[4]};
    
    ${responsive.maxMd(`
      padding: 0 ${designTokens.spacing[3]};
    `)}
  `,
  
  wide: `
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 ${designTokens.spacing[4]};
    
    ${responsive.maxMd(`
      padding: 0 ${designTokens.spacing[3]};
    `)}
  `,
  
  fluid: `
    width: 100%;
    padding: 0 ${designTokens.spacing[4]};
    
    ${responsive.maxMd(`
      padding: 0 ${designTokens.spacing[3]};
    `)}
  `,
};

// Trading-specific design patterns
export const tradingStyles = {
  // Glass morphism card pattern used across trading components
  glassCard: `
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: ${designTokens.borderRadius.xl};
    padding: ${designTokens.spacing[8]};
    margin-bottom: ${designTokens.spacing[8]};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    
    ${responsive.maxMd(`
      padding: ${designTokens.spacing[6]};
      margin-bottom: ${designTokens.spacing[6]};
    `)}
  `,
  
  // Trading dashboard container
  dashboardContainer: `
    padding: ${designTokens.spacing[8]};
    max-width: 1400px;
    margin: 0 auto;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: white;
    
    ${responsive.maxMd(`
      padding: ${designTokens.spacing[4]};
    `)}
  `,
  
  // Common header pattern
  sectionHeader: `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${designTokens.spacing[8]};
    
    h3 {
      font-size: ${designTokens.typography.fontSize.xl};
      color: white;
      margin: 0;
    }
    
    ${responsive.maxMd(`
      flex-direction: column;
      gap: ${designTokens.spacing[4]};
      align-items: flex-start;
    `)}
  `,
};