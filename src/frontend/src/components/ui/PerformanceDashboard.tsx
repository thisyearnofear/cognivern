import React, { useState } from 'react';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { designTokens } from '../../styles/designTokens';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from './Button';
import Chart from './Chart';
import Modal from './Modal';

export const PerformanceDashboard: React.FC = () => {
  const { 
    metrics, 
    alerts, 
    isMonitoring, 
    startMonitoring, 
    stopMonitoring, 
    clearAlerts, 
    getPerformanceScore,
    thresholds 
  } = usePerformanceMonitor();

  const [showDetails, setShowDetails] = useState(false);

  const performanceScore = getPerformanceScore();

  const getScoreColor = (score: number | null) => {
    if (score === null) return designTokens.colors.neutral[400];
    if (score >= 90) return designTokens.colors.semantic.success[500];
    if (score >= 50) return designTokens.colors.semantic.warning[500];
    return designTokens.colors.semantic.error[500];
  };

  const getMetricStatus = (value: number | null, metric: keyof typeof thresholds) => {
    if (value === null) return 'unknown';
    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return designTokens.colors.semantic.success[500];
      case 'needs-improvement': return designTokens.colors.semantic.warning[500];
      case 'poor': return designTokens.colors.semantic.error[500];
      default: return designTokens.colors.neutral[400];
    }
  };

  const formatMetricValue = (value: number | null, unit: string = 'ms') => {
    if (value === null) return 'N/A';
    return `${value.toFixed(1)}${unit}`;
  };

  // Prepare chart data for Core Web Vitals
  const webVitalsData = [
    { x: 'LCP', y: metrics.lcp || 0, label: 'Largest Contentful Paint' },
    { x: 'FID', y: metrics.fid || 0, label: 'First Input Delay' },
    { x: 'CLS', y: (metrics.cls || 0) * 1000, label: 'Cumulative Layout Shift (×1000)' },
    { x: 'FCP', y: metrics.fcp || 0, label: 'First Contentful Paint' },
  ].filter(item => item.y > 0);

  const dashboardStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: designTokens.spacing[4],
    padding: designTokens.spacing[4],
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize['3xl'],
    fontWeight: designTokens.typography.fontWeight.bold,
    color: getScoreColor(performanceScore),
    textAlign: 'center',
    margin: `${designTokens.spacing[2]} 0`,
  };

  const metricRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${designTokens.spacing[2]} 0`,
    borderBottom: `1px solid ${designTokens.colors.neutral[200]}`,
  };

  const metricLabelStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    color: designTokens.colors.neutral[700],
  };

  const metricValueStyle = (status: string): React.CSSProperties => ({
    fontSize: designTokens.typography.fontSize.sm,
    fontWeight: designTokens.typography.fontWeight.semibold,
    color: getStatusColor(status),
  });

  const alertStyle: React.CSSProperties = {
    padding: designTokens.spacing[3],
    backgroundColor: designTokens.colors.semantic.warning[50],
    border: `1px solid ${designTokens.colors.semantic.warning[200]}`,
    borderRadius: designTokens.borderRadius.md,
    marginBottom: designTokens.spacing[2],
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: designTokens.spacing[2],
    marginBottom: designTokens.spacing[4],
  };

  return (
    <div>
      {/* Controls */}
      <div style={controlsStyle}>
        <Button
          variant={isMonitoring ? "secondary" : "primary"}
          onClick={isMonitoring ? stopMonitoring : startMonitoring}
        >
          {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setShowDetails(true)}
        >
          View Details
        </Button>
        
        {alerts.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearAlerts}
          >
            Clear Alerts ({alerts.length})
          </Button>
        )}
      </div>

      {/* Performance Score */}
      <Card style={{ marginBottom: designTokens.spacing[4] }}>
        <CardHeader>
          <CardTitle>Performance Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={scoreStyle}>
            {performanceScore !== null ? performanceScore : '--'}
          </div>
          <div style={{ textAlign: 'center', color: designTokens.colors.neutral[600] }}>
            Based on Core Web Vitals
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Grid */}
      <div style={dashboardStyle}>
        {/* Core Web Vitals */}
        <Card>
          <CardHeader>
            <CardTitle>Core Web Vitals</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Largest Contentful Paint (LCP)</span>
              <span style={metricValueStyle(getMetricStatus(metrics.lcp, 'lcp'))}>
                {formatMetricValue(metrics.lcp)}
              </span>
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>First Input Delay (FID)</span>
              <span style={metricValueStyle(getMetricStatus(metrics.fid, 'fid'))}>
                {formatMetricValue(metrics.fid)}
              </span>
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Cumulative Layout Shift (CLS)</span>
              <span style={metricValueStyle(getMetricStatus(metrics.cls, 'cls'))}>
                {formatMetricValue(metrics.cls, '')}
              </span>
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>First Contentful Paint (FCP)</span>
              <span style={metricValueStyle(getMetricStatus(metrics.fcp, 'fcp'))}>
                {formatMetricValue(metrics.fcp)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Runtime Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Runtime Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Memory Usage</span>
              <span style={metricValueStyle(getMetricStatus(metrics.memoryUsage, 'memoryUsage'))}>
                {formatMetricValue(metrics.memoryUsage, 'MB')}
              </span>
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Render Time</span>
              <span style={metricValueStyle(getMetricStatus(metrics.renderTime, 'renderTime'))}>
                {formatMetricValue(metrics.renderTime)}
              </span>
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Bundle Size</span>
              <span style={metricValueStyle('good')}>
                {metrics.bundleSize ? `${(metrics.bundleSize / 1024).toFixed(1)}KB` : 'N/A'}
              </span>
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>TTFB</span>
              <span style={metricValueStyle(getMetricStatus(metrics.ttfb, 'ttfb'))}>
                {formatMetricValue(metrics.ttfb)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        {webVitalsData.length > 0 && (
          <Card style={{ gridColumn: 'span 2' }}>
            <CardHeader>
              <CardTitle>Core Web Vitals Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                data={webVitalsData}
                type="bar"
                height={250}
                title="Performance Metrics"
                yAxisLabel="Time (ms)"
                showTooltip
                interactive
              />
            </CardContent>
          </Card>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card style={{ gridColumn: 'span 2' }}>
            <CardHeader>
              <CardTitle>Performance Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.slice(0, 5).map((alert, index) => (
                <div key={index} style={alertStyle}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <span style={{ fontWeight: designTokens.typography.fontWeight.semibold }}>
                      {alert.type === 'error' ? '🔴' : '🟡'} {alert.message}
                    </span>
                    <span style={{ 
                      fontSize: designTokens.typography.fontSize.xs,
                      color: designTokens.colors.neutral[500] 
                    }}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {alerts.length > 5 && (
                <div style={{ 
                  textAlign: 'center', 
                  marginTop: designTokens.spacing[2],
                  color: designTokens.colors.neutral[600] 
                }}>
                  +{alerts.length - 5} more alerts
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Performance Details"
        size="lg"
      >
        <div>
          <h3>Navigation Timing</h3>
          {metrics.navigationTiming ? (
            <div style={{ fontSize: designTokens.typography.fontSize.sm }}>
              <div>DNS Lookup: {(metrics.navigationTiming.domainLookupEnd - metrics.navigationTiming.domainLookupStart).toFixed(1)}ms</div>
              <div>TCP Connect: {(metrics.navigationTiming.connectEnd - metrics.navigationTiming.connectStart).toFixed(1)}ms</div>
              <div>Request: {(metrics.navigationTiming.responseStart - metrics.navigationTiming.requestStart).toFixed(1)}ms</div>
              <div>Response: {(metrics.navigationTiming.responseEnd - metrics.navigationTiming.responseStart).toFixed(1)}ms</div>
              <div>DOM Processing: {(metrics.navigationTiming.domContentLoadedEventEnd - metrics.navigationTiming.responseEnd).toFixed(1)}ms</div>
            </div>
          ) : (
            <div>No navigation timing data available</div>
          )}

          <h3 style={{ marginTop: designTokens.spacing[4] }}>Resource Timing</h3>
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {metrics.resourceTiming.slice(0, 10).map((resource, index) => (
              <div key={index} style={{ 
                padding: designTokens.spacing[2],
                borderBottom: `1px solid ${designTokens.colors.neutral[200]}`,
                fontSize: designTokens.typography.fontSize.xs 
              }}>
                <div style={{ fontWeight: designTokens.typography.fontWeight.semibold }}>
                  {resource.name.split('/').pop()}
                </div>
                <div>Duration: {resource.duration.toFixed(1)}ms | Size: {resource.transferSize ? `${(resource.transferSize / 1024).toFixed(1)}KB` : 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PerformanceDashboard;