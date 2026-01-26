import { designTokens } from "../styles/designTokens";

// Viewport utilities for consistent responsive behavior
export const viewport = {
  // Get current viewport width
  getWidth: (): number => {
    if (typeof window === "undefined") return 1024; // SSR fallback
    return window.innerWidth;
  },

  // Get current viewport height
  getHeight: (): number => {
    if (typeof window === "undefined") return 768; // SSR fallback
    return window.innerHeight;
  },

  // Check if current viewport matches breakpoint
  matches: (breakpoint: keyof typeof designTokens.breakpoints): boolean => {
    if (typeof window === "undefined") return false;
    const width = parseInt(designTokens.breakpoints[breakpoint]);
    return window.innerWidth >= width;
  },

  // Get current breakpoint
  getCurrentBreakpoint: (): keyof typeof designTokens.breakpoints => {
    const width = viewport.getWidth();

    if (width >= parseInt(designTokens.breakpoints["2xl"])) return "2xl";
    if (width >= parseInt(designTokens.breakpoints.xl)) return "xl";
    if (width >= parseInt(designTokens.breakpoints.lg)) return "lg";
    if (width >= parseInt(designTokens.breakpoints.md)) return "md";
    if (width >= parseInt(designTokens.breakpoints.sm)) return "sm";
    return "sm"; // Default to sm for xs
  },

  // Check if device is mobile
  isMobile: (): boolean => {
    return !viewport.matches("lg");
  },

  // Check if device is tablet
  isTablet: (): boolean => {
    return viewport.matches("md") && !viewport.matches("lg");
  },

  // Check if device is desktop
  isDesktop: (): boolean => {
    return viewport.matches("lg");
  },

  // Check if device has touch capability
  isTouch: (): boolean => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  },

  // Get optimal sidebar width for current viewport
  getOptimalSidebarWidth: (
    state: "expanded" | "collapsed" | "hidden" | "overlay",
  ): number => {
    const breakpoint = viewport.getCurrentBreakpoint();

    if (state === "hidden" || state === "overlay") return 0;
    if (state === "collapsed") return 80;

    // Expanded widths based on breakpoint
    const widths = {
      sm: 240,
      md: 260,
      lg: 280,
      xl: 320,
      "2xl": 320,
    };

    return widths[breakpoint] || 280;
  },

  // Get optimal content max-width for current viewport
  getOptimalContentWidth: (): string => {
    const breakpoint = viewport.getCurrentBreakpoint();

    const maxWidths = {
      sm: "100%",
      md: "100%",
      lg: "1200px",
      xl: "1400px",
      "2xl": "1600px",
    };

    return maxWidths[breakpoint] || "1200px";
  },

  // Get optimal container padding for current viewport
  getOptimalPadding: (): string => {
    const breakpoint = viewport.getCurrentBreakpoint();

    const paddings = {
      sm: designTokens.spacing[4],
      md: designTokens.spacing[6],
      lg: designTokens.spacing[8],
      xl: designTokens.spacing[10],
      "2xl": designTokens.spacing[12],
    };

    return paddings[breakpoint] || designTokens.spacing[6];
  },
};

// Responsive value utilities
export const responsive = {
  // Get value based on current breakpoint
  getValue: <T>(
    values: Partial<Record<keyof typeof designTokens.breakpoints, T>>,
  ): T | undefined => {
    const breakpoint = viewport.getCurrentBreakpoint();
    const breakpointOrder: (keyof typeof designTokens.breakpoints)[] = [
      "2xl",
      "xl",
      "lg",
      "md",
      "sm",
    ];

    // Find the appropriate value starting from current breakpoint and going down
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (values[bp] !== undefined) {
        return values[bp];
      }
    }

    return undefined;
  },

  // Generate responsive CSS for different breakpoints
  css: (
    property: string,
    values: Partial<Record<keyof typeof designTokens.breakpoints, string>>,
  ): string => {
    let css = "";

    // Base value (mobile first)
    if (values.sm) {
      css += `${property}: ${values.sm};\n`;
    }

    // Add media queries for larger breakpoints
    const breakpoints: (keyof typeof designTokens.breakpoints)[] = [
      "md",
      "lg",
      "xl",
      "2xl",
    ];

    breakpoints.forEach((bp) => {
      if (values[bp]) {
        css += `@media (min-width: ${designTokens.breakpoints[bp]}) {\n`;
        css += `  ${property}: ${values[bp]};\n`;
        css += `}\n`;
      }
    });

    return css;
  },

  // Generate responsive grid columns
  gridColumns: (
    columns: Partial<Record<keyof typeof designTokens.breakpoints, number>>,
  ): string => {
    return responsive.css(
      "grid-template-columns",
      Object.fromEntries(
        Object.entries(columns).map(([bp, cols]) => [
          bp,
          `repeat(${cols}, 1fr)`,
        ]),
      ),
    );
  },

  // Generate responsive spacing
  spacing: (
    property: string,
    values: Partial<
      Record<
        keyof typeof designTokens.breakpoints,
        keyof typeof designTokens.spacing
      >
    >,
  ): string => {
    return responsive.css(
      property,
      Object.fromEntries(
        Object.entries(values).map(([bp, space]) => [
          bp,
          designTokens.spacing[space as keyof typeof designTokens.spacing],
        ]),
      ),
    );
  },
};

// Layout calculation utilities
export const layout = {
  // Calculate available content width
  getContentWidth: (sidebarWidth: number, containerPadding: string): string => {
    const paddingValue = parseInt(containerPadding) * 2; // Left and right padding
    return `calc(100vw - ${sidebarWidth}px - ${paddingValue}px)`;
  },

  // Calculate optimal grid columns for content
  getOptimalColumns: (
    itemMinWidth: number,
    containerWidth: number,
    gap: number,
  ): number => {
    const availableWidth = containerWidth - gap;
    const itemWidthWithGap = itemMinWidth + gap;
    const columns = Math.floor(availableWidth / itemWidthWithGap);
    return Math.max(1, columns);
  },

  // Calculate if sidebar should be collapsed based on content needs
  shouldCollapseSidebar: (
    contentMinWidth: number,
    sidebarWidth: number,
  ): boolean => {
    const viewportWidth = viewport.getWidth();
    const availableWidth = viewportWidth - sidebarWidth;
    return availableWidth < contentMinWidth;
  },

  // Get optimal layout configuration
  getOptimalLayout: (contentMinWidth: number = 800) => {
    const viewportWidth = viewport.getWidth();
    const breakpoint = viewport.getCurrentBreakpoint();
    const isMobile = viewport.isMobile();
    const isTouch = viewport.isTouch();

    let sidebarState: "expanded" | "collapsed" | "hidden" | "overlay" =
      "expanded";

    if (isMobile) {
      sidebarState = "hidden";
    } else if (isTouch && viewport.isTablet()) {
      sidebarState = "overlay";
    } else if (
      layout.shouldCollapseSidebar(
        contentMinWidth,
        viewport.getOptimalSidebarWidth("expanded"),
      )
    ) {
      sidebarState = "collapsed";
    }

    return {
      sidebarState,
      sidebarWidth: viewport.getOptimalSidebarWidth(sidebarState),
      contentMaxWidth: viewport.getOptimalContentWidth(),
      containerPadding: viewport.getOptimalPadding(),
      breakpoint,
      isMobile,
      isTouch,
    };
  },
};

// Performance utilities for responsive components
export const performance = {
  // Debounce resize events
  debounceResize: (callback: () => void, delay: number = 150): (() => void) => {
    let timeoutId: NodeJS.Timeout;

    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delay);
    };
  },

  // Throttle scroll events
  throttleScroll: (callback: () => void, delay: number = 16): (() => void) => {
    let isThrottled = false;

    return () => {
      if (!isThrottled) {
        callback();
        isThrottled = true;
        setTimeout(() => {
          isThrottled = false;
        }, delay);
      }
    };
  },

  // Check if element is in viewport
  isInViewport: (element: Element, threshold: number = 0): boolean => {
    const rect = element.getBoundingClientRect();
    const windowHeight = viewport.getHeight();
    const windowWidth = viewport.getWidth();

    return (
      rect.top >= -threshold &&
      rect.left >= -threshold &&
      rect.bottom <= windowHeight + threshold &&
      rect.right <= windowWidth + threshold
    );
  },

  // Lazy load images based on viewport
  lazyLoadImage: (img: HTMLImageElement, src: string): void => {
    if (performance.isInViewport(img, 100)) {
      img.src = src;
      img.classList.add("loaded");
    }
  },
};

// Accessibility utilities for responsive design
export const a11y = {
  // Check if user prefers reduced motion
  prefersReducedMotion: (): boolean => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  // Check if user prefers high contrast
  prefersHighContrast: (): boolean => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-contrast: high)").matches;
  },

  // Get appropriate focus ring size for current device
  getFocusRingSize: (): string => {
    return viewport.isTouch() ? "3px" : "2px";
  },

  // Get appropriate touch target size
  getTouchTargetSize: (): string => {
    return viewport.isTouch() ? "44px" : "32px";
  },

  // Check if keyboard navigation is likely being used
  isKeyboardUser: (): boolean => {
    // This would need to be implemented with focus tracking
    // For now, return false as default
    return false;
  },
};

export default {
  viewport,
  responsive,
  layout,
  performance,
  a11y,
};
