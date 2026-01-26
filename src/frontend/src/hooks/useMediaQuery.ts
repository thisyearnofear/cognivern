import { useState, useEffect } from "react";
import { designTokens } from "../styles/designTokens";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
};

// Predefined breakpoint hooks
export const useBreakpoint = () => {
  const isSm = useMediaQuery(`(min-width: ${designTokens.breakpoints.sm})`);
  const isMd = useMediaQuery(`(min-width: ${designTokens.breakpoints.md})`);
  const isLg = useMediaQuery(`(min-width: ${designTokens.breakpoints.lg})`);
  const isXl = useMediaQuery(`(min-width: ${designTokens.breakpoints.xl})`);
  const is2Xl = useMediaQuery(
    `(min-width: ${designTokens.breakpoints["2xl"]})`,
  );

  // Mobile-first approach
  const isMobile = !isSm;
  const isTablet = isSm && !isLg;
  const isDesktop = isLg;

  return {
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    isMobile,
    isTablet,
    isDesktop,
    // Current breakpoint
    current: is2Xl
      ? "2xl"
      : isXl
        ? "xl"
        : isLg
          ? "lg"
          : isMd
            ? "md"
            : isSm
              ? "sm"
              : "xs",
  };
};

// Hook for responsive values
export const useResponsiveValue = <T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  "2xl"?: T;
}): T | undefined => {
  const { current } = useBreakpoint();

  // Find the appropriate value based on current breakpoint
  const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"] as const;
  const currentIndex = breakpointOrder.indexOf(current as any);

  // Look for value starting from current breakpoint and going down
  for (let i = currentIndex; i < breakpointOrder.length; i++) {
    const breakpoint = breakpointOrder[i];
    if (values[breakpoint] !== undefined) {
      return values[breakpoint];
    }
  }

  return undefined;
};

// Hook for detecting touch devices
export const useTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          (navigator as any).msMaxTouchPoints > 0,
      );
    };

    checkTouch();

    // Listen for changes (e.g., when external mouse is connected/disconnected)
    window.addEventListener("touchstart", checkTouch, { once: true });

    return () => {
      window.removeEventListener("touchstart", checkTouch);
    };
  }, []);

  return isTouch;
};

// Hook for detecting reduced motion preference
export const useReducedMotion = (): boolean => {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
};

// Hook for detecting high contrast preference
export const useHighContrast = (): boolean => {
  return useMediaQuery("(prefers-contrast: high)");
};
