/**
 * Responsive Utility Classes - Mobile-first Design
 *
 * Phase 8: Improve UI/UX from 7.5 → 9
 * Provides breakpoint-based responsive utilities.
 */

import { css } from '@emotion/react';
import { designTokens } from '../tokens/designTokens';

// ===========================================
// BREAKPOINT DEFINITIONS
// ===========================================

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  xxl: '1536px',
} as const;

// ===========================================
// MEDIA QUERY HELPERS
// ===========================================

export const mediaQuery = {
  xs: (styles: TemplateStringsArray | string) => css`
    @media (max-width: ${breakpoints.xs}) {
      ${styles}
    }
  `,
  sm: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.sm}) {
      ${styles}
    }
  `,
  md: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.md}) {
      ${styles}
    }
  `,
  lg: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.lg}) {
      ${styles}
    }
  `,
  xl: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.xl}) {
      ${styles}
    }
  `,
  xxl: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.xxl}) {
      ${styles}
    }
  `,
  // Range queries
  between: (
    min: keyof typeof breakpoints,
    max: keyof typeof breakpoints,
    styles: TemplateStringsArray | string
  ) => css`
    @media (min-width: ${breakpoints[min]}) and (max-width: ${breakpoints[max]}) {
      ${styles}
    }
  `,
  mobileOnly: (styles: TemplateStringsArray | string) => css`
    @media (max-width: ${breakpoints.sm}) {
      ${styles}
    }
  `,
  tablet: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.sm}) and (max-width: ${breakpoints.lg}) {
      ${styles}
    }
  `,
  desktop: (styles: TemplateStringsArray | string) => css`
    @media (min-width: ${breakpoints.lg}) {
      ${styles}
    }
  `,
};

// ===========================================
// LAYOUT RESPONSIVE UTILITIES
// ===========================================

export const responsiveLayout = {
  // Stack direction (mobile-first)
  stack: css`
    display: flex;
    flex-direction: column;
  `,
  stackReverse: css`
    display: flex;
    flex-direction: column-reverse;
  `,
  row: css`
    display: flex;
    flex-direction: row;
  `,
  // Grid
  grid: css`
    display: grid;
  `,
  gridCols1: css`
    grid-template-columns: 1fr;
  `,
  gridCols2: css`
    grid-template-columns: repeat(2, 1fr);
  `,
  gridCols3: css`
    grid-template-columns: repeat(3, 1fr);
  `,
  gridCols4: css`
    grid-template-columns: repeat(4, 1fr);
  `,
};

// ===========================================
// SPACING RESPONSIVE UTILITIES
// ===========================================

export const responsiveSpacing = {
  // Padding
  containerPadding: css`
    padding: ${designTokens.spacing[3]};
    ${mediaQuery.md`
      padding: ${designTokens.spacing[4]};
    `}
    ${mediaQuery.lg`
      padding: ${designTokens.spacing[6]};
    `}
  `,
  sectionPadding: css`
    padding: ${designTokens.spacing[4]} 0;
    ${mediaQuery.md`
      padding: ${designTokens.spacing[6]} 0;
    `}
  `,
  cardPadding: css`
    padding: ${designTokens.spacing[3]};
    ${mediaQuery.sm`
      padding: ${designTokens.spacing[4]};
    `}
  `,
  // Gap
  flexGap: css`
    gap: ${designTokens.spacing[2]};
    ${mediaQuery.sm`
      gap: ${designTokens.spacing[3]};
    `}
    ${mediaQuery.md`
      gap: ${designTokens.spacing[4]};
    `}
  `,
  gridGap: css`
    gap: ${designTokens.spacing[3]};
    ${mediaQuery.md`
      gap: ${designTokens.spacing[4]};
    `}
    ${mediaQuery.lg`
      gap: ${designTokens.spacing[6]};
    `}
  `,
};

// ===========================================
// TYPOGRAPHY RESPONSIVE UTILITIES
// ===========================================

export const responsiveTypography = {
  heading1: css`
    font-size: ${designTokens.typography.fontSize['2xl']};
    line-height: 1.2;
    ${mediaQuery.md`
      font-size: ${designTokens.typography.fontSize['3xl']};
    `}
    ${mediaQuery.lg`
      font-size: ${designTokens.typography.fontSize['4xl']};
    `}
  `,
  heading2: css`
    font-size: ${designTokens.typography.fontSize.xl};
    line-height: 1.3;
    ${mediaQuery.md`
      font-size: ${designTokens.typography.fontSize['2xl']};
    `}
    ${mediaQuery.lg`
      font-size: ${designTokens.typography.fontSize['3xl']};
    `}
  `,
  heading3: css`
    font-size: ${designTokens.typography.fontSize.lg};
    line-height: 1.4;
    ${mediaQuery.md`
      font-size: ${designTokens.typography.fontSize.xl};
    `}
  `,
  body: css`
    font-size: ${designTokens.typography.fontSize.base};
    line-height: 1.6;
    ${mediaQuery.md`
      font-size: ${designTokens.typography.fontSize.md};
    `}
  `,
  caption: css`
    font-size: ${designTokens.typography.fontSize.xs};
    ${mediaQuery.md`
      font-size: ${designTokens.typography.fontSize.sm};
    `}
  `,
};

// ===========================================
// VISIBILITY UTILITIES
// ===========================================

export const visibility = {
  hideOnMobile: css`
    display: none;
    ${mediaQuery.md`
      display: flex;
    `}
  `,
  hideOnTablet: css`
    ${mediaQuery.sm`
      display: none;
    `}
    ${mediaQuery.lg`
      display: flex;
    `}
  `,
  hideOnDesktop: css`
    ${mediaQuery.lg`
      display: none;
    `}
  `,
  showOnMobile: css`
    display: flex;
    ${mediaQuery.md`
      display: none;
    `}
  `,
  showOnlyOnDesktop: css`
    display: none;
    ${mediaQuery.lg`
      display: flex;
    `}
  `,
};

// ===========================================
// TOUCH TARGET SIZES
// ===========================================

export const touchTargets = {
  minimum: css`
    min-height: 44px;
    min-width: 44px;
  `,
  comfortable: css`
    min-height: 48px;
    min-width: 48px;
  `,
  iconButton: css`
    height: 40px;
    width: 40px;
    padding: ${designTokens.spacing[1]};
  `,
  listItem: css`
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    min-height: 48px;
  `,
};

// ===========================================
// CONTAINER UTILITIES
// ===========================================

export const containers = {
  center: css`
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 ${designTokens.spacing[3]};
    ${mediaQuery.md`
      padding: 0 ${designTokens.spacing[4]};
    `}
    ${mediaQuery.lg`
      padding: 0 ${designTokens.spacing[6]};
    `}
  `,
  narrow: css`
    max-width: 768px;
    margin: 0 auto;
    padding: 0 ${designTokens.spacing[3]};
    ${mediaQuery.md`
      padding: 0 ${designTokens.spacing[4]};
    `}
  `,
  wide: css`
    max-width: 1536px;
    margin: 0 auto;
    padding: 0 ${designTokens.spacing[3]};
    ${mediaQuery.md`
      padding: 0 ${designTokens.spacing[4]};
    `}
  `,
};

// ===========================================
// CARD RESPONSIVE STYLES
// ===========================================

export const responsiveCard = css`
  ${responsiveSpacing.cardPadding}
  background: ${designTokens.colors.neutral[0]};
  border: 1px solid ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.lg};

  ${mediaQuery.sm`
    &:hover {
      border-color: ${designTokens.colors.neutral[300]};
      box-shadow: ${designTokens.shadows.md};
    }
  `}
`;

// ===========================================
// NAVIGATION UTILITIES
// ===========================================

export const responsiveNav = {
  sidebar: css`
    display: none;
    ${mediaQuery.lg`
      display: flex;
      width: 260px;
      flex-direction: column;
    `}
  `,
  bottomTabs: css`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    background: ${designTokens.colors.neutral[0]};
    border-top: 1px solid ${designTokens.colors.neutral[200]};
    padding: ${designTokens.spacing[2]} 0;
    z-index: 50;

    ${mediaQuery.lg`
      display: none;
    `}
  `,
};

// ===========================================
// FORM RESPONSIVE UTILITIES
// ===========================================

export const responsiveForm = {
  input: css`
    height: 44px;
    font-size: ${designTokens.typography.fontSize.base};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};

    ${mediaQuery.md`
      height: 48px;
    `}
  `,
  label: css`
    font-size: ${designTokens.typography.fontSize.sm};
    margin-bottom: ${designTokens.spacing[1]};
  `,
  error: css`
    font-size: ${designTokens.typography.fontSize.xs};
    margin-top: ${designTokens.spacing[1]};
  `,
};

// ===========================================
// EXPORT ALL RESPONSIVE UTILITIES
// ===========================================

export const responsive = {
  breakpoints,
  mediaQuery,
  layout: responsiveLayout,
  spacing: responsiveSpacing,
  typography: responsiveTypography,
  visibility,
  touchTargets,
  containers,
  card: responsiveCard,
  nav: responsiveNav,
  form: responsiveForm,
};

export default responsive;
