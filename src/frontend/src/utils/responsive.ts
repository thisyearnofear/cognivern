/**
 * Responsive Utilities
 * Consolidated viewport, performance, and accessibility utilities
 * DRY principle: Single source of truth for all responsive behavior
 */

import { designTokens } from '../styles/design-system';
import { useBreakpoint as useBreakpointHook } from '../hooks/useMediaQuery';

// Viewport utilities for consistent responsive behavior
export const viewport = {
  // Get current viewport width
  getWidth: (): number => {
    if (typeof window === 'undefined') return 1024; // SSR fallback
    return window.innerWidth;
  },

  // Get current viewport height
  getHeight: (): number => {
    if (typeof window === 'undefined') return 768; // SSR fallback
    return window.innerHeight;
  },

  // Check if current viewport matches breakpoint
  matches: (breakpoint: keyof typeof designTokens.breakpoints): boolean => {
    if (typeof window === 'undefined') return false;
    const width = parseInt(designTokens.breakpoints[breakpoint]);
    return window.innerWidth >= width;
  },

  // Get current breakpoint
  getCurrentBreakpoint: (): keyof typeof designTokens.breakpoints => {
    const width = viewport.getWidth();

    if (width >= parseInt(designTokens.breakpoints['2xl'])) return '2xl';
    if (width >= parseInt(designTokens.breakpoints.xl)) return 'xl';
    if (width >= parseInt(designTokens.breakpoints.lg)) return 'lg';
    if (width >= parseInt(designTokens.breakpoints.md)) return 'md';
    if (width >= parseInt(designTokens.breakpoints.sm)) return 'sm';
    return 'xs'; // Default to xs for smallest screens
  },

  // Check if device is mobile (smaller than sm breakpoint)
  isMobile: (): boolean => {
    return !viewport.matches('sm');
  },

  // Check if device is tablet (sm to lg)
  isTablet: (): boolean => {
    return viewport.matches('sm') && !viewport.matches('lg');
  },

  // Check if device is desktop (lg and above)
  isDesktop: (): boolean => {
    return viewport.matches('lg');
  },

  // Check if device has touch capability
  isTouch: (): boolean => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  // Get optimal sidebar width for current viewport
  getOptimalSidebarWidth: (state: 'expanded' | 'collapsed' | 'hidden' | 'overlay'): number => {
    const breakpoint = viewport.getCurrentBreakpoint();

    if (state === 'hidden' || state === 'overlay') return 0;
    if (state === 'collapsed') return 80;

    // Expanded widths based on breakpoint
    const widths = {
      xs: 240,
      sm: 240,
      md: 260,
      lg: 280,
      xl: 320,
      '2xl': 320,
    };

    return widths[breakpoint] || 280;
  },

  // Get optimal content max-width for current viewport
  getOptimalContentWidth: (): string => {
    const breakpoint = viewport.getCurrentBreakpoint();

    const maxWidths = {
      xs: '100%',
      sm: '100%',
      md: '100%',
      lg: '1200px',
      xl: '1400px',
      '2xl': '1600px',
    };

    return maxWidths[breakpoint] || '1200px';
  },

  // Get optimal container padding for current viewport
  getOptimalPadding: (): string => {
    const breakpoint = viewport.getCurrentBreakpoint();

    const paddings = {
      xs: designTokens.spacing[3],
      sm: designTokens.spacing[4],
      md: designTokens.spacing[6],
      lg: designTokens.spacing[8],
      xl: designTokens.spacing[10],
      '2xl': designTokens.spacing[12],
    };

    return paddings[breakpoint] || designTokens.spacing[4];
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
      img.classList.add('loaded');
    }
  },

  // Check if user prefers reduced motion for accessibility
  prefersReducedMotion: (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  // Get animation duration based on reduced motion preference
  getAnimationDuration: (duration: number): number => {
    if (performance.prefersReducedMotion()) return 0;
    return duration;
  },
};

// Accessibility utilities for responsive design
export const a11y = {
  // Check if user prefers reduced motion
  prefersReducedMotion: (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  // Check if user prefers high contrast
  prefersHighContrast: (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-contrast: high)').matches;
  },

  // Get appropriate focus ring size for current device
  getFocusRingSize: (): string => {
    return viewport.isTouch() ? '3px' : '2px';
  },

  // Get appropriate touch target size
  getTouchTargetSize: (): string => {
    return viewport.isTouch() ? '44px' : '32px';
  },
};

export default {
  viewport,
  performance,
  a11y,
};
