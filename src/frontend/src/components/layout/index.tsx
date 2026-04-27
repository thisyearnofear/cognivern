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

// Layout helpers (inline to avoid deleted ContentWrapper)
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

export const DashboardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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

export const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    css={css`
      min-height: 100%;
      background: transparent;
    `}
  >
    {children}
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
export { viewport, responsive, layout, performance, a11y } from '../../utils/responsive';

// Re-export viewport optimization utilities
export * from '../../utils/viewportOptimization';

// Re-export enhanced hooks
export { default as useSidebarState } from '../../hooks/useSidebarState';
export { default as useViewportOptimization } from '../../hooks/useViewportOptimization';
