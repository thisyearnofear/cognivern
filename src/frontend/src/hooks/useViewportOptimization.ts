import { useState, useEffect, useCallback } from 'react';
import { 
  ViewportDimensions, 
  LayoutOptimization,
  getViewportDimensions,
  calculateOptimalLayout,
  viewportTracker
} from '../utils/viewportOptimization';
import { useLayout } from '../components/layout/ResponsiveLayout';

/**
 * Hook for intelligent viewport optimization and layout management
 */
export const useViewportOptimization = (
  contentType: 'dashboard' | 'form' | 'table' | 'chart' | 'list' = 'dashboard',
  autoOptimize: boolean = false
) => {
  const [viewport, setViewport] = useState<ViewportDimensions>(() => getViewportDimensions());
  const [optimization, setOptimization] = useState<LayoutOptimization>(() => 
    calculateOptimalLayout(getViewportDimensions(), contentType)
  );
  const { setSidebarState, sidebarState } = useLayout();

  // Update optimization when viewport or content type changes
  useEffect(() => {
    const newOptimization = calculateOptimalLayout(viewport, contentType);
    setOptimization(newOptimization);
  }, [viewport, contentType]);

  // Subscribe to viewport changes
  useEffect(() => {
    const unsubscribe = viewportTracker.subscribe((dimensions) => {
      setViewport(dimensions);
    });

    return unsubscribe;
  }, []);

  // Auto-optimize sidebar state if enabled
  useEffect(() => {
    if (autoOptimize && optimization.recommendedSidebarState !== sidebarState) {
      setSidebarState(optimization.recommendedSidebarState);
    }
  }, [autoOptimize, optimization.recommendedSidebarState, sidebarState, setSidebarState]);

  // Manual optimization trigger
  const optimizeLayout = useCallback(() => {
    setSidebarState(optimization.recommendedSidebarState);
  }, [optimization.recommendedSidebarState, setSidebarState]);

  // Check if current layout is optimal
  const isOptimal = optimization.recommendedSidebarState === sidebarState;

  // Get space utilization metrics
  const getSpaceMetrics = useCallback(() => {
    const totalSpace = viewport.availableWidth * viewport.availableHeight;
    const usedSpace = optimization.contentWidth * viewport.availableHeight;
    const efficiency = usedSpace / totalSpace;

    return {
      totalSpace,
      usedSpace,
      efficiency,
      spaceUtilization: optimization.spaceUtilization,
      wastedSpace: totalSpace - usedSpace,
    };
  }, [viewport, optimization]);

  // Get responsive grid recommendations
  const getGridRecommendations = useCallback(() => {
    const { contentWidth } = optimization;
    
    return {
      columns: optimization.recommendedColumns,
      maxItemWidth: Math.floor(contentWidth / optimization.recommendedColumns) - 24, // Account for gaps
      minItemWidth: Math.max(200, Math.floor(contentWidth / (optimization.recommendedColumns + 1))),
      gapSize: contentWidth > 1200 ? 24 : 16,
    };
  }, [optimization]);

  // Performance monitoring
  const getPerformanceMetrics = useCallback(() => {
    const metrics = getSpaceMetrics();
    
    return {
      ...metrics,
      layoutScore: optimization.spaceUtilization * 100,
      isOptimal,
      recommendations: {
        sidebar: optimization.recommendedSidebarState,
        columns: optimization.recommendedColumns,
        contentWidth: optimization.contentWidth,
      },
    };
  }, [optimization, isOptimal, getSpaceMetrics]);

  return {
    // Current state
    viewport,
    optimization,
    isOptimal,
    
    // Actions
    optimizeLayout,
    
    // Utilities
    getSpaceMetrics,
    getGridRecommendations,
    getPerformanceMetrics,
    
    // Computed values
    spaceUtilization: optimization.spaceUtilization,
    recommendedColumns: optimization.recommendedColumns,
    contentWidth: optimization.contentWidth,
    sidebarWidth: optimization.sidebarWidth,
  };
};

export default useViewportOptimization;