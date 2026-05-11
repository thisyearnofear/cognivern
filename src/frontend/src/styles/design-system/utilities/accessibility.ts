/**
 * Accessibility Utilities - Centralized ARIA and Focus Patterns
 *
 * Phase 4 Enhancement: DRY + CLEAN principles
 * Provides reusable accessibility patterns for components.
 */

import { designTokens } from '../tokens/designTokens';

// ===========================================
// COLOR CONTRAST UTILITIES
// ===========================================

/**
 * WCAG Color Contrast Checker
 * Returns contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Calculate relative luminance of a color
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null;
}

/**
 * Check if contrast meets WCAG AA standards (4.5:1 for normal text)
 */
export function meetsWCAGAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standards (7:1 for enhanced)
 */
export function meetsWCAGAAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 7;
}

/**
 * Get optimal text color for a given background
 */
export function getOptimalTextColor(bgColor: string): string {
  const ratio = getContrastRatio(bgColor, designTokens.colors.text.primary);
  return ratio >= 4.5 ? designTokens.colors.text.primary : designTokens.colors.text.inverse;
}

// ===========================================
// ARIA PROPS HELPERS
// ===========================================

/**
 * Create ARIA live region attributes for dynamic content
 */
export const ariaLive = {
  polite: () => ({
    'aria-live': 'polite' as const,
    'aria-atomic': 'true' as const,
  }),
  assertive: () => ({
    'aria-live': 'assertive' as const,
    'aria-atomic': 'true' as const,
  }),
  off: () => ({
    'aria-live': 'off' as const,
  }),
};

/**
 * Create ARIA relationship attributes
 */
export const ariaRelationships = {
  describedBy: (id: string) => ({ 'aria-describedby': id }),
  labelledBy: (id: string) => ({ 'aria-labelledby': id }),
  controls: (id: string) => ({ 'aria-controls': id }),
  owns: (id: string) => ({ 'aria-owns': id }),
};

/**
 * Create ARIA expanded attributes for collapsible content
 */
export const ariaExpanded = {
  true: () => ({ 'aria-expanded': 'true' as const }),
  false: () => ({ 'aria-expanded': 'false' as const }),
  toggle: (expanded: boolean) => ({ 'aria-expanded': expanded as const }),
};

/**
 * Create ARIA busy/loading attributes
 */
export const ariaBusy = {
  true: () => ({ 'aria-busy': 'true' as const }),
  false: () => ({ 'aria-busy': 'false' as const }),
  toggle: (busy: boolean) => ({ 'aria-busy': busy as const }),
};

// ===========================================
// FOCUS STYLES
// ===========================================

/**
 * Focus visible styles for keyboard navigation
 */
export const focusVisible = {
  outline: `2px solid ${designTokens.colors.primary[500]}`,
  outlineOffset: '2px',
  borderRadius: designTokens.borderRadius.sm,
};

/**
 * Focus ring CSS for Emotion
 */
export const focusRingStyles = `
  &:focus-visible {
    outline: 2px solid ${designTokens.colors.primary[500]};
    outline-offset: 2px;
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }
`;

// ===========================================
// SEMANTIC ROLES
// ===========================================

/**
 * ARIA role assignments for common patterns
 */
export const roles = {
  alert: () => ({ role: 'alert' as const }),
  log: () => ({ role: 'log' as const }),
  status: () => ({ role: 'status' as const }),
  progressbar: () => ({ role: 'progressbar' as const }),
  dialog: () => ({ role: 'dialog' as const, 'aria-modal': 'true' as const }),
  article: () => ({ role: 'article' as const }),
  figure: () => ({ role: 'figure' as const }),
  navigation: () => ({ role: 'navigation' as const }),
  main: () => ({ role: 'main' as const }),
  button: () => ({ role: 'button' as const }),
  checkbox: () => ({ role: 'checkbox' as const }),
  switch: () => ({ role: 'switch' as const }),
};

// ===========================================
// SCREEN READER UTILITIES
// ===========================================

/**
 * Visually hidden but accessible to screen readers
 */
export const visuallyHiddenStyles = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

/**
 * Skip to main content link styles
 */
export const skipLinkStyles = `
  position: absolute;
  top: -40px;
  left: 0;
  background: ${designTokens.colors.primary[500]};
  color: white;
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
  z-index: 100;
  transition: top 0.2s ease;

  &:focus {
    top: 0;
  }
`;

// ===========================================
// COMBINED PATTERNS
// ===========================================

/**
 * Create accessible button-like element (e.g., div with onClick)
 */
export const accessibleButton = {
  ...roles.button(),
  tabIndex: 0,
};

/**
 * Create accessible loading state
 */
export const loadingState = (isLoading: boolean) => ({
  ...ariaBusy.toggle(isLoading),
  ...(isLoading ? ariaLive.polite() : {}),
});

/**
 * Create accessible collapsible section
 */
export const collapsibleSection = {
  trigger: (expanded: boolean, contentId: string) => ({
    ...ariaExpanded.toggle(expanded),
    'aria-controls': contentId,
  }),
  content: (id: string, hidden: boolean) => ({
    id,
    'aria-hidden': hidden,
  }),
};
