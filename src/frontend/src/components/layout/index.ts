// Main layout components
export { default as AppLayout } from "./ImprovedAppLayout";
export { default as Sidebar } from "./ImprovedSidebar";
export { default as Header } from "./Header";

// Responsive layout system
export {
  LayoutProvider,
  useLayout,
  Container,
  Grid,
  GridItem,
  Flex,
  Spacer,
} from "./ResponsiveLayout";

// Content wrappers
export {
  ContentWrapper,
  DashboardWrapper,
  PageWrapper,
  ModalContentWrapper,
} from "./ContentWrapper";

// Types
export type {
  LayoutContextType,
  ContainerProps,
  GridProps,
  GridItemProps,
  FlexProps,
  SpacerProps,
} from "./ResponsiveLayout";

export type { ContentWrapperProps } from "./ContentWrapper";

// Re-export responsive utilities
export {
  viewport,
  responsive,
  layout,
  performance,
  a11y,
} from "../../utils/responsive";

// Re-export viewport optimization utilities
export * from "../../utils/viewportOptimization";

// Re-export enhanced hooks
export { default as useSidebarState } from "../../hooks/useSidebarState";
export { default as useViewportOptimization } from "../../hooks/useViewportOptimization";
