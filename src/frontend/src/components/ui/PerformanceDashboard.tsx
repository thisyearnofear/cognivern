import React, { useState } from "react";
import { usePerformanceMonitor } from "../../hooks/usePerformanceMonitor";
import { designTokens } from "../../styles/designTokens";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { Button } from "./Button";
import Chart from "./Chart";
import Modal from "./Modal";
import { performanceStyles } from "../../styles/design-system";
import { css } from "@emotion/react";

export const PerformanceDashboard: React.FC = () => {
  const {
    metrics,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    getPerformanceScore,
    thresholds,
  } = usePerformanceMonitor();

  const [showDetails, setShowDetails] = useState(false);

  const performanceScore = getPerformanceScore();

  const getScoreColor = (score: number | null) => {
    if (score === null) return designTokens.colors.neutral[400];
    if (score >= 90) return designTokens.colors.semantic.success[500];
    if (score >= 50) return designTokens.colors.semantic.warning[500];
    return designTokens.colors.semantic.error[500];
  };

  const getMetricStatus = (
    value: number | null,
    metric: keyof typeof thresholds,
  ) => {
    if (value === null) return "unknown";
    const threshold = thresholds[metric];
    if (!threshold) return "unknown";

    if (value <= threshold.good) return "good";
    if (value <= threshold.poor) return "needs-improvement";
    return "poor";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return designTokens.colors.semantic.success[500];
      case "needs-improvement":
        return designTokens.colors.semantic.warning[500];
      case "poor":
        return designTokens.colors.semantic.error[500];
      default:
        return designTokens.colors.neutral[400];
    }
  };

  const formatMetricValue = (value: number | null, unit: string = "ms") => {
    if (value === null) return "N/A";
    return `${value.toFixed(1)}${unit}`;
  };

  // Prepare chart data for Core Web Vitals
  const webVitalsData = [
    { x: "LCP", y: metrics.lcp || 0, label: "Largest Contentful Paint" },
    { x: "FID", y: metrics.fid || 0, label: "First Input Delay" },
    {
      x: "CLS",
      y: (metrics.cls || 0) * 1000,
      label: "Cumulative Layout Shift (×1000)",
    },
    { x: "FCP", y: metrics.fcp || 0, label: "First Contentful Paint" },
  ].filter((item) => item.y > 0);

  return (
    <div>
      {/* Controls */}
      <div css={performanceStyles.controls}>
        <Button
          variant={isMonitoring ? "secondary" : "primary"}
          onClick={isMonitoring ? stopMonitoring : startMonitoring}
        >
          {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
        </Button>

        <Button variant="outline" onClick={() => setShowDetails(true)}>
          View Details
        </Button>

        {alerts.length > 0 && (
          <Button variant="ghost" onClick={clearAlerts}>
            Clear Alerts ({alerts.length})
          </Button>
        )}
      </div>

      {/* Performance Score */}
      <Card
        css={css`
          margin-bottom: ${designTokens.spacing[4]};
        `}
      >
        <CardHeader>
          <CardTitle>Performance Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div css={performanceStyles.score(getScoreColor(performanceScore))}>
            {performanceScore !== null ? performanceScore : "--"}
          </div>
          <div css={performanceStyles.scoreDescription}>
            Based on Core Web Vitals
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Grid */}
      <div css={performanceStyles.grid}>
        {/* Core Web Vitals */}
        <Card>
          <CardHeader>
            <CardTitle>Core Web Vitals</CardTitle>
          </CardHeader>
          <CardContent>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>
                Largest Contentful Paint (LCP)
              </span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.lcp, "lcp")),
                )}
              >
                {formatMetricValue(metrics.lcp)}
              </span>
            </div>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>
                First Input Delay (FID)
              </span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.fid, "fid")),
                )}
              >
                {formatMetricValue(metrics.fid)}
              </span>
            </div>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>
                Cumulative Layout Shift (CLS)
              </span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.cls, "cls")),
                )}
              >
                {formatMetricValue(metrics.cls, "")}
              </span>
            </div>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>
                First Contentful Paint (FCP)
              </span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.fcp, "fcp")),
                )}
              >
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
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>Memory Usage</span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.memoryUsage, "memoryUsage")),
                )}
              >
                {formatMetricValue(metrics.memoryUsage, "MB")}
              </span>
            </div>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>Render Time</span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.renderTime, "renderTime")),
                )}
              >
                {formatMetricValue(metrics.renderTime)}
              </span>
            </div>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>Bundle Size</span>
              <span css={performanceStyles.metricValue(designTokens.colors.semantic.success[500])}>
                {metrics.bundleSize
                  ? `${(metrics.bundleSize / 1024).toFixed(1)}KB`
                  : "N/A"}
              </span>
            </div>
            <div css={performanceStyles.metricRow}>
              <span css={performanceStyles.metricLabel}>TTFB</span>
              <span
                css={performanceStyles.metricValue(
                  getStatusColor(getMetricStatus(metrics.ttfb, "ttfb")),
                )}
              >
                {formatMetricValue(metrics.ttfb)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        {webVitalsData.length > 0 && (
          <Card
            css={css`
              grid-column: span 2;
            `}
          >
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
          <Card
            css={css`
              grid-column: span 2;
            `}
          >
            <CardHeader>
              <CardTitle>Performance Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.slice(0, 5).map((alert, index) => (
                <div key={index} css={performanceStyles.alert}>
                  <div css={performanceStyles.alertContent}>
                    <span css={performanceStyles.alertMessage}>
                      {alert.type === "error" ? "🔴" : "🟡"} {alert.message}
                    </span>
                    <span css={performanceStyles.alertTimestamp}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {alerts.length > 5 && (
                <div css={performanceStyles.alertMore}>
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
          <h3 css={performanceDetailSectionStyles}>Navigation Timing</h3>
          {metrics.navigationTiming ? (
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize.sm};
              `}
            >
              <div css={performanceStyles.detailItem}>
                DNS Lookup:{" "}
                {(
                  metrics.navigationTiming.domainLookupEnd -
                  metrics.navigationTiming.domainLookupStart
                ).toFixed(1)}
                ms
              </div>
              <div css={performanceStyles.detailItem}>
                TCP Connect:{" "}
                {(
                  metrics.navigationTiming.connectEnd -
                  metrics.navigationTiming.connectStart
                ).toFixed(1)}
                ms
              </div>
              <div css={performanceStyles.detailItem}>
                Request:{" "}
                {(
                  metrics.navigationTiming.responseStart -
                  metrics.navigationTiming.requestStart
                ).toFixed(1)}
                ms
              </div>
              <div css={performanceStyles.detailItem}>
                Response:{" "}
                {(
                  metrics.navigationTiming.responseEnd -
                  metrics.navigationTiming.responseStart
                ).toFixed(1)}
                ms
              </div>
              <div css={performanceStyles.detailItem}>
                DOM Processing:{" "}
                {(
                  metrics.navigationTiming.domContentLoadedEventEnd -
                  metrics.navigationTiming.responseEnd
                ).toFixed(1)}
                ms
              </div>
            </div>
          ) : (
            <div>No navigation timing data available</div>
          )}

          <h3 css={performanceDetailSectionStyles}>Resource Timing</h3>
          <div
            css={css`
              max-height: 200px;
              overflow: auto;
            `}
          >
            {metrics.resourceTiming.slice(0, 10).map((resource, index) => (
              <div key={index} css={performanceDetailItemStyles}>
                <div css={performanceDetailItemTitleStyles}>
                  {resource.name.split("/").pop()}
                </div>
                <div css={performanceDetailItemValueStyles}>
                  Duration: {resource.duration.toFixed(1)}ms | Size:{" "}
                  {resource.transferSize
                    ? `${(resource.transferSize / 1024).toFixed(1)}KB`
                    : "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PerformanceDashboard;
