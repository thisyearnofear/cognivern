// Main layout components
export { ImprovedAppLayout as AppLayout } from './ImprovedAppLayout';
export { default as Sidebar } from './ImprovedSidebar';
export { default as Header } from './Header';

// Responsive layout system
export {
  LayoutProvider,
  useLayout,
  Container,
  Grid,
  GridItem,
  Flex,
  Spacer,
} from './ResponsiveLayout';

import React from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

export const DashboardWrapper = ({ children }: { children: React.ReactNode }) => (
  <div
    css={css`
      width: 100%;
      padding: ${designTokens.spacing[6]};
      @media (max-width: ${designTokens.breakpoints.sm}) {
        padding: ${designTokens.spacing[4]};
      }
    `}
  >
    {children}
  </div>
);

interface PageWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageWrapper = ({ children, title, subtitle, actions }: PageWrapperProps) => (
  <div
    css={css`
      min-height: 100%;
      background: transparent;
      padding-bottom: ${designTokens.spacing[12]};
    `}
  >
    {(title || subtitle || actions) && (
      <header
        css={css`
          margin-bottom: ${designTokens.spacing[10]};
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: ${designTokens.spacing[6]};
          flex-wrap: wrap;
          padding: 0 ${designTokens.spacing[2]};

          @media (max-width: ${designTokens.breakpoints.md}) {
            flex-direction: column;
            align-items: flex-start;
          }
        `}
      >
        <div
          css={css`
            max-width: 800px;
          `}
        >
          {title && (
            <h1
              css={css`
                font-size: ${designTokens.typography.fontSize['5xl']};
                font-weight: ${designTokens.typography.fontWeight.extrabold};
                margin: 0 0 ${designTokens.spacing[3]} 0;
                color: ${designTokens.colors.neutral[900]};
                letter-spacing: -0.04em;
                line-height: 1.1;
                background: linear-gradient(
                  to bottom right,
                  ${designTokens.colors.neutral[900]},
                  ${designTokens.colors.neutral[600]}
                );
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              `}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              css={css`
                font-size: ${designTokens.typography.fontSize.lg};
                color: ${designTokens.colors.neutral[600]};
                margin: 0;
                line-height: 1.6;
                max-width: 60ch;
              `}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div
            css={css`
              display: flex;
              gap: ${designTokens.spacing[3]};
              margin-bottom: ${designTokens.spacing[1]};
            `}
          >
            {actions}
          </div>
        )}
      </header>
    )}
    <main>{children}</main>
  </div>
);

// Types
export type {
  LayoutContextType,
  ContainerProps,
  GridProps,
  GridItemProps,
  FlexProps,
  SpacerProps,
} from './ResponsiveLayout';

// Re-export responsive utilities
export { viewport, performance, a11y } from '../../utils/responsive';

// Re-export viewport optimization utilities
export * from '../../utils/viewportOptimization';

// Re-export enhanced hooks
export { default as useSidebarState } from '../../hooks/useSidebarState';
export { default as useViewportOptimization } from '../../hooks/useViewportOptimization';
