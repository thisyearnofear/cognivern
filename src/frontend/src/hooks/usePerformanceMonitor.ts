import { useEffect, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  
  // Additional metrics
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
  
  // Runtime metrics
  memoryUsage: number | null;
  renderTime: number | null;
  bundleSize: number | null;
  
  // User interaction metrics
  navigationTiming: PerformanceNavigationTiming | null;
  resourceTiming: PerformanceResourceTiming[];
}

export interface PerformanceAlert {
  type: 'warning' | 'error';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
}

const PERFORMANCE_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
  memoryUsage: { good: 50, poor: 100 }, // MB
  renderTime: { good: 16, poor: 32 }, // ms
};

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    memoryUsage: null,
    renderTime: null,
    bundleSize: null,
    navigationTiming: null,
    resourceTiming: [],
  });

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Measure Core Web Vitals
  const measureWebVitals = useCallback(() => {
    // LCP - Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          if (lastEntry) {
            setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FID - First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            setMetrics(prev => ({ ...prev, fid: entry.processingStart - entry.startTime }));
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // CLS - Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              setMetrics(prev => ({ ...prev, cls: clsValue }));
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // FCP - First Contentful Paint
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              setMetrics(prev => ({ ...prev, fcp: entry.startTime }));
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

      } catch (error) {
        console.warn('Performance monitoring not supported:', error);
      }
    }
  }, []);

  // Measure navigation timing
  const measureNavigationTiming = useCallback(() => {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const navigation = navigationEntries[0];
        setMetrics(prev => ({
          ...prev,
          navigationTiming: navigation,
          ttfb: navigation.responseStart - navigation.requestStart,
        }));
      }
    }
  }, []);

  // Measure resource timing
  const measureResourceTiming = useCallback(() => {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      setMetrics(prev => ({ ...prev, resourceTiming: resourceEntries }));
      
      // Calculate bundle size from resource entries
      const jsResources = resourceEntries.filter(entry => 
        entry.name.includes('.js') && entry.transferSize
      );
      const totalBundleSize = jsResources.reduce((total, entry) => total + (entry.transferSize || 0), 0);
      setMetrics(prev => ({ ...prev, bundleSize: totalBundleSize }));
    }
  }, []);

  // Measure memory usage
  const measureMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      setMetrics(prev => ({ ...prev, memoryUsage: usedMB }));
    }
  }, []);

  // Measure render time
  const measureRenderTime = useCallback(() => {
    let startTime = performance.now();
    
    const measureFrame = () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      setMetrics(prev => ({ ...prev, renderTime }));
      startTime = performance.now();
    };

    // Measure on next frame
    requestAnimationFrame(measureFrame);
  }, []);

  // Check thresholds and create alerts
  const checkThresholds = useCallback((newMetrics: PerformanceMetrics) => {
    const newAlerts: PerformanceAlert[] = [];

    Object.entries(PERFORMANCE_THRESHOLDS).forEach(([metric, thresholds]) => {
      const value = newMetrics[metric as keyof PerformanceMetrics] as number;
      if (value !== null && value !== undefined) {
        let alertType: 'warning' | 'error' | null = null;
        
        if (value > thresholds.poor) {
          alertType = 'error';
        } else if (value > thresholds.good) {
          alertType = 'warning';
        }

        if (alertType) {
          newAlerts.push({
            type: alertType,
            metric: metric as keyof PerformanceMetrics,
            value,
            threshold: alertType === 'error' ? thresholds.poor : thresholds.good,
            message: `${metric.toUpperCase()} is ${alertType === 'error' ? 'poor' : 'needs improvement'}: ${value.toFixed(2)}ms`,
            timestamp: Date.now(),
          });
        }
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
    }
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    measureWebVitals();
    measureNavigationTiming();
    measureResourceTiming();
    
    // Set up periodic measurements
    const interval = setInterval(() => {
      measureMemoryUsage();
      measureRenderTime();
    }, 5000);

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [measureWebVitals, measureNavigationTiming, measureResourceTiming, measureMemoryUsage, measureRenderTime]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Get performance score
  const getPerformanceScore = useCallback(() => {
    const scores: number[] = [];
    
    if (metrics.lcp !== null) {
      scores.push(metrics.lcp <= PERFORMANCE_THRESHOLDS.lcp.good ? 100 : 
                   metrics.lcp <= PERFORMANCE_THRESHOLDS.lcp.poor ? 50 : 0);
    }
    
    if (metrics.fid !== null) {
      scores.push(metrics.fid <= PERFORMANCE_THRESHOLDS.fid.good ? 100 : 
                   metrics.fid <= PERFORMANCE_THRESHOLDS.fid.poor ? 50 : 0);
    }
    
    if (metrics.cls !== null) {
      scores.push(metrics.cls <= PERFORMANCE_THRESHOLDS.cls.good ? 100 : 
                   metrics.cls <= PERFORMANCE_THRESHOLDS.cls.poor ? 50 : 0);
    }

    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }, [metrics]);

  // Monitor metrics changes for alerts
  useEffect(() => {
    checkThresholds(metrics);
  }, [metrics, checkThresholds]);

  // Auto-start monitoring on mount
  useEffect(() => {
    const cleanup = startMonitoring();
    return cleanup;
  }, [startMonitoring]);

  return {
    metrics,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    getPerformanceScore,
    thresholds: PERFORMANCE_THRESHOLDS,
  };
};

// Hook for component-specific performance monitoring
export const useComponentPerformance = (componentName: string) => {
  const [renderCount, setRenderCount] = useState(0);
  const [renderTimes, setRenderTimes] = useState<number[]>([]);

  useEffect(() => {
    const startTime = performance.now();
    setRenderCount(prev => prev + 1);

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      setRenderTimes(prev => [...prev.slice(-9), renderTime]); // Keep last 10 renders
    };
  });

  const averageRenderTime = renderTimes.length > 0 
    ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
    : 0;

  return {
    componentName,
    renderCount,
    renderTimes,
    averageRenderTime,
    lastRenderTime: renderTimes[renderTimes.length - 1] || 0,
  };
};