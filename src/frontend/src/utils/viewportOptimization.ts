/**
 * Viewport Optimization Utilities
 * Provides intelligent viewport space utilization and layout optimization
 * Consolidated to use centralized viewport utilities (DRY principle)
 */

import { viewport } from './responsive';
import { designTokens } from '../styles/design-system';

export interface ViewportDimensions {
  width: number;
  height: number;
  availableWidth: number;
  availableHeight: number;
  aspectRatio: number;
}

export interface LayoutOptimization {
  sidebarWidth: number;
  contentWidth: number;
  recommendedColumns: number;
  recommendedSidebarState: 'expanded' | 'collapsed' | 'hidden' | 'overlay';
  spaceUtilization: number; // 0-1 score
}

/**
 * Get current viewport dimensions and available space
 * Now uses centralized viewport utilities
 */
export const getViewportDimensions = (): ViewportDimensions => {
  const width = viewport.getWidth();
  const height = viewport.getHeight();

  // Account for browser chrome and scrollbars
  const availableWidth = document.documentElement.clientWidth || width;
  const availableHeight = document.documentElement.clientHeight || height;

  return {
    width,
    height,
    availableWidth,
    availableHeight,
    aspectRatio: width / height,
  };
};

/**
 * Calculate optimal layout configuration for current viewport
 * Uses centralized viewport utilities for breakpoint detection
 */
export const calculateOptimalLayout = (
  viewportDims: ViewportDimensions,
  contentType: 'dashboard' | 'form' | 'table' | 'chart' | 'list' = 'dashboard'
): LayoutOptimization => {
  const { availableWidth } = viewportDims;

  // Define minimum content widths for different content types
  const minContentWidths = {
    dashboard: 800,
    form: 600,
    table: 900,
    chart: 700,
    list: 500,
  };

  const minContentWidth = minContentWidths[contentType];

  // Use centralized viewport utilities for breakpoint detection
  const isMobile = viewport.isMobile();
  const isTablet = viewport.isTablet();

  // Determine optimal sidebar state based on available space and device
  let recommendedSidebarState: 'expanded' | 'collapsed' | 'hidden' | 'overlay';
  let sidebarWidth: number;

  if (isMobile) {
    // Mobile: use overlay or hidden
    recommendedSidebarState = 'hidden';
    sidebarWidth = 0;
  } else if (isTablet) {
    // Tablet: use collapsed or overlay
    recommendedSidebarState = 'collapsed';
    sidebarWidth = 80;
  } else {
    // Desktop: calculate based on content needs
    const expandedWidth = Math.floor(availableWidth * 0.18);
    const collapsedWidth = 80;

    // Constrain expanded width
    const constrainedExpandedWidth = Math.max(280, Math.min(400, expandedWidth));

    const contentWidthWithExpanded = availableWidth - constrainedExpandedWidth;
    const contentWidthWithCollapsed = availableWidth - collapsedWidth;

    if (contentWidthWithExpanded >= minContentWidth * 1.2) {
      // Plenty of space for expanded sidebar
      recommendedSidebarState = 'expanded';
      sidebarWidth = constrainedExpandedWidth;
    } else if (contentWidthWithCollapsed >= minContentWidth) {
      // Enough space with collapsed sidebar
      recommendedSidebarState = 'collapsed';
      sidebarWidth = collapsedWidth;
    } else {
      // Need maximum space for content
      recommendedSidebarState = 'hidden';
      sidebarWidth = 0;
    }
  }

  const contentWidth = availableWidth - sidebarWidth;

  // Calculate recommended grid columns based on content width
  const calculateColumns = (): number => {
    if (contentWidth < 600) return 1;
    if (contentWidth < 900) return 2;
    if (contentWidth < 1200) return 3;
    if (contentWidth < 1600) return 4;
    return Math.min(6, Math.floor(contentWidth / 300));
  };

  const recommendedColumns = calculateColumns();

  // Calculate space utilization score (0-1)
  const idealContentWidth = Math.min(contentWidth, minContentWidth * 1.5);
  const spaceUtilization = Math.min(1, idealContentWidth / (availableWidth * 0.85));

  return {
    sidebarWidth,
    contentWidth,
    recommendedColumns,
    recommendedSidebarState,
    spaceUtilization,
  };
};

/**
 * Debounced viewport change handler
 */
export const createViewportChangeHandler = (
  callback: (dimensions: ViewportDimensions) => void,
  delay: number = 150
) => {
  let timeoutId: NodeJS.Timeout;

  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(getViewportDimensions());
    }, delay);
  };
};

/**
 * Check if current layout is optimal for content type
 */
export const isLayoutOptimal = (
  currentSidebarState: string,
  contentType: string,
  viewportDims: ViewportDimensions
): boolean => {
  const optimal = calculateOptimalLayout(viewportDims, contentType as any);
  return optimal.recommendedSidebarState === currentSidebarState;
};

/**
 * Get responsive breakpoint information
 * Now uses centralized viewport utilities
 */
export const getBreakpointInfo = (width: number) => {
  if (width < 480) return { name: 'xs', isMobile: true, isTablet: false, isDesktop: false };
  if (width < 640) return { name: 'sm', isMobile: true, isTablet: false, isDesktop: false };
  if (width < 768) return { name: 'md', isMobile: false, isTablet: true, isDesktop: false };
  if (width < 1024) return { name: 'lg', isMobile: false, isTablet: false, isDesktop: true };
  if (width < 1280) return { name: 'xl', isMobile: false, isTablet: false, isDesktop: true };
  if (width < 1536) return { name: '2xl', isMobile: false, isTablet: false, isDesktop: true };
  return { name: '2xl', isMobile: false, isTablet: false, isDesktop: true };
};

/**
 * Performance-optimized viewport tracking
 */
export class ViewportTracker {
  private callbacks: Set<(dimensions: ViewportDimensions) => void> = new Set();
  private rafId: number | null = null;
  private lastDimensions: ViewportDimensions | null = null;

  constructor() {
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  private handleResize() {
    if (this.rafId) return;

    this.rafId = requestAnimationFrame(() => {
      const dimensions = getViewportDimensions();

      // Only notify if dimensions actually changed
      if (
        !this.lastDimensions ||
        this.lastDimensions.width !== dimensions.width ||
        this.lastDimensions.height !== dimensions.height
      ) {
        this.callbacks.forEach((callback) => callback(dimensions));
        this.lastDimensions = dimensions;
      }

      this.rafId = null;
    });
  }

  subscribe(callback: (dimensions: ViewportDimensions) => void) {
    this.callbacks.add(callback);

    // Immediately call with current dimensions
    callback(getViewportDimensions());

    return () => {
      this.callbacks.delete(callback);
    };
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.callbacks.clear();
  }
}

// Singleton instance
export const viewportTracker = new ViewportTracker();
