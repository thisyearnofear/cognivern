import React, { createContext, useContext, useEffect, useState } from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/designTokens";
import { useBreakpoint, useMediaQuery } from "../../hooks/useMediaQuery";

// Layout Context for managing responsive state
export interface LayoutContextType {
  sidebarWidth: number;
  contentMaxWidth: number;
  containerPadding: string;
  isCompactMode: boolean;
  sidebarState: "expanded" | "collapsed" | "hidden" | "overlay";
  setSidebarState: (
    state: "expanded" | "collapsed" | "hidden" | "overlay",
  ) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
};

// Improved responsive layout configuration with better viewport utilization
const getLayoutConfig = (
  breakpoint: string,
  isTouch: boolean,
  viewportWidth: number,
) => {
  // Calculate optimal sidebar width as percentage of viewport for better space utilization
  const getSidebarWidth = (
    basePercentage: number,
    minWidth: number,
    maxWidth: number,
  ) => {
    const calculatedWidth = Math.floor(viewportWidth * basePercentage);
    return Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
  };

  const configs = {
    xs: {
      sidebarWidth: 0,
      contentMaxWidth: "100%",
      containerPadding: designTokens.spacing[4],
      isCompactMode: true,
      defaultSidebarState: "hidden" as const,
    },
    sm: {
      sidebarWidth: isTouch ? 0 : getSidebarWidth(0.25, 200, 280),
      contentMaxWidth: "100%",
      containerPadding: designTokens.spacing[4],
      isCompactMode: true,
      defaultSidebarState: isTouch ? "overlay" : ("collapsed" as const),
    },
    md: {
      sidebarWidth: getSidebarWidth(0.22, 240, 320),
      contentMaxWidth: "100%",
      containerPadding: designTokens.spacing[6],
      isCompactMode: false,
      defaultSidebarState:
        viewportWidth < 900 ? "collapsed" : ("expanded" as const),
    },
    lg: {
      sidebarWidth: getSidebarWidth(0.2, 260, 360),
      contentMaxWidth: "100%", // Remove artificial limits for better space utilization
      containerPadding: designTokens.spacing[8],
      isCompactMode: false,
      defaultSidebarState: "expanded" as const,
    },
    xl: {
      sidebarWidth: getSidebarWidth(0.18, 280, 400),
      contentMaxWidth: "100%", // Let content use full available space
      containerPadding: designTokens.spacing[10],
      isCompactMode: false,
      defaultSidebarState: "expanded" as const,
    },
    "2xl": {
      sidebarWidth: getSidebarWidth(0.16, 300, 420),
      contentMaxWidth: "100%", // Maximum space utilization
      containerPadding: designTokens.spacing[12],
      isCompactMode: false,
      defaultSidebarState: "expanded" as const,
    },
  };

  return configs[breakpoint as keyof typeof configs] || configs.lg;
};

// Layout Provider Component
interface LayoutProviderProps {
  children: React.ReactNode;
  initialSidebarState?: "expanded" | "collapsed" | "hidden" | "overlay";
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({
  children,
  initialSidebarState,
}) => {
  const { current: breakpoint } = useBreakpoint();
  const isTouch = useMediaQuery("(pointer: coarse)");
  const [sidebarState, setSidebarState] = useState<
    "expanded" | "collapsed" | "hidden" | "overlay"
  >("expanded");
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  // Track viewport width changes for responsive calculations
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const config = getLayoutConfig(breakpoint, isTouch, viewportWidth);

  // Auto-adjust sidebar state based on breakpoint and viewport
  useEffect(() => {
    if (!initialSidebarState) {
      setSidebarState(config.defaultSidebarState);
    }
  }, [
    breakpoint,
    config.defaultSidebarState,
    initialSidebarState,
    viewportWidth,
  ]);

  // Initialize sidebar state
  useEffect(() => {
    if (initialSidebarState) {
      setSidebarState(initialSidebarState);
    }
  }, [initialSidebarState]);

  const contextValue: LayoutContextType = {
    sidebarWidth: config.sidebarWidth,
    contentMaxWidth: config.contentMaxWidth,
    containerPadding: config.containerPadding,
    isCompactMode: config.isCompactMode,
    sidebarState,
    setSidebarState,
  };

  return (
    <LayoutContext.Provider value={contextValue}>
      {children}
    </LayoutContext.Provider>
  );
};

// Container Component for consistent content width and spacing
export interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: string;
  padding?: string;
  className?: string;
  fluid?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth,
  padding,
  className = "",
  fluid = false,
}) => {
  const { contentMaxWidth, containerPadding } = useLayout();

  const containerStyles = css`
    width: 100%;
    max-width: ${fluid ? "100%" : maxWidth || contentMaxWidth};
    margin: 0 auto;
    padding: 0 ${padding || containerPadding};

    @media (max-width: ${designTokens.breakpoints.sm}) {
      padding: 0 ${designTokens.spacing[4]};
    }
  `;

  return (
    <div css={containerStyles} className={className}>
      {children}
    </div>
  );
};

// Grid System Components
export interface GridProps {
  children: React.ReactNode;
  columns?:
    | number
    | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gap?: string;
  className?: string;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 12,
  gap = designTokens.spacing[6],
  className = "",
}) => {
  const gridStyles = css`
    display: grid;
    gap: ${gap};

    ${typeof columns === "number"
      ? `grid-template-columns: repeat(${columns}, 1fr);`
      : `
        grid-template-columns: repeat(${columns.xs || 1}, 1fr);

        @media (min-width: ${designTokens.breakpoints.sm}) {
          grid-template-columns: repeat(${columns.sm || columns.xs || 1}, 1fr);
        }

        @media (min-width: ${designTokens.breakpoints.md}) {
          grid-template-columns: repeat(${columns.md || columns.sm || columns.xs || 1}, 1fr);
        }

        @media (min-width: ${designTokens.breakpoints.lg}) {
          grid-template-columns: repeat(${columns.lg || columns.md || columns.sm || columns.xs || 1}, 1fr);
        }

        @media (min-width: ${designTokens.breakpoints.xl}) {
          grid-template-columns: repeat(${columns.xl || columns.lg || columns.md || columns.sm || columns.xs || 1}, 1fr);
        }
      `}

    @media (max-width: ${designTokens.breakpoints.sm}) {
      gap: ${designTokens.spacing[4]};
    }
  `;

  return (
    <div css={gridStyles} className={className}>
      {children}
    </div>
  );
};

export interface GridItemProps {
  children: React.ReactNode;
  span?:
    | number
    | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  className?: string;
}

export const GridItem: React.FC<GridItemProps> = ({
  children,
  span = 1,
  className = "",
}) => {
  const gridItemStyles = css`
    ${typeof span === "number"
      ? `grid-column: span ${span};`
      : `
        grid-column: span ${span.xs || 1};

        @media (min-width: ${designTokens.breakpoints.sm}) {
          grid-column: span ${span.sm || span.xs || 1};
        }

        @media (min-width: ${designTokens.breakpoints.md}) {
          grid-column: span ${span.md || span.sm || span.xs || 1};
        }

        @media (min-width: ${designTokens.breakpoints.lg}) {
          grid-column: span ${span.lg || span.md || span.sm || span.xs || 1};
        }

        @media (min-width: ${designTokens.breakpoints.xl}) {
          grid-column: span ${span.xl || span.lg || span.md || span.sm || span.xs || 1};
        }
      `}
  `;

  return (
    <div css={gridItemStyles} className={className}>
      {children}
    </div>
  );
};

// Flex utilities
export interface FlexProps {
  children: React.ReactNode;
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  justify?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  align?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  gap?: string;
  className?: string;
}

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = "row",
  justify = "flex-start",
  align = "stretch",
  wrap = "nowrap",
  gap = "0",
  className = "",
}) => {
  const flexStyles = css`
    display: flex;
    flex-direction: ${direction};
    justify-content: ${justify};
    align-items: ${align};
    flex-wrap: ${wrap};
    gap: ${gap};
  `;

  return (
    <div css={flexStyles} className={className}>
      {children}
    </div>
  );
};

// Spacer component for consistent spacing
export interface SpacerProps {
  size?: keyof typeof designTokens.spacing;
  direction?: "horizontal" | "vertical" | "both";
}

export const Spacer: React.FC<SpacerProps> = ({
  size = 4,
  direction = "both",
}) => {
  const spacerStyles = css`
    ${direction === "horizontal" || direction === "both"
      ? `width: ${designTokens.spacing[size]};`
      : ""}
    ${direction === "vertical" || direction === "both"
      ? `height: ${designTokens.spacing[size]};`
      : ""}
    flex-shrink: 0;
  `;

  return <div css={spacerStyles} />;
};

// Dashboard-specific wrapper component
export interface DashboardWrapperProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export const DashboardWrapper: React.FC<DashboardWrapperProps> = ({
  children,
  className = "",
  padding = true,
}) => {
  const { contentMaxWidth, containerPadding } = useLayout();

  const wrapperStyles = css`
    width: 100%;
    max-width: ${contentMaxWidth};
    margin: 0 auto;
    ${padding ? `padding: 0 ${containerPadding};` : ""}

    @media (max-width: ${designTokens.breakpoints.sm}) {
      padding: 0 ${designTokens.spacing[4]};
    }
  `;

  return (
    <div css={wrapperStyles} className={className}>
      {children}
    </div>
  );
};
