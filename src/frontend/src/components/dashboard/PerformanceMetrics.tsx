import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/designTokens";

export interface MetricsData {
  responseTime: number;
  successRate: number;
  policyCompliance: number;
  blockedActions: number;
  totalActions: number;
  timestamp: string;
}

interface PerformanceMetricsProps {
  agentId: string;
  governanceEnabled: boolean;
  onToggleGovernance: () => void;
}

export default function PerformanceMetrics({
  agentId,
  governanceEnabled,
  onToggleGovernance,
}: PerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<MetricsData>({
    responseTime: 0,
    successRate: 0,
    policyCompliance: 0,
    blockedActions: 0,
    totalActions: 0,
    timestamp: new Date().toISOString(),
  });

  const [comparisonMetrics, setComparisonMetrics] =
    useState<MetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedCharts, setShowDetailedCharts] = useState<boolean>(false);

  // Fetch metrics on component mount and when governance is toggled
  useEffect(() => {
    fetchMetrics();
  }, [agentId, governanceEnabled]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/agents/${agentId}/metrics?governance=${governanceEnabled}`,
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);

        if (data.comparison) {
          setComparisonMetrics(data.comparison);
        }
      } else {
        throw new Error("Failed to fetch metrics");
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching metrics:", err);
      setError("Failed to load metrics data");
      // Set empty metrics on error
      setMetrics({
        responseTime: 0,
        successRate: 0,
        policyCompliance: 0,
        blockedActions: 0,
        totalActions: 0,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate the difference between metrics with and without governance
  const calculateDifference = (metricName: keyof MetricsData): number => {
    if (!comparisonMetrics) return 0;

    const current = metrics[metricName];
    const comparison = comparisonMetrics[metricName];

    if (typeof current === "number" && typeof comparison === "number") {
      return current - comparison;
    }

    return 0;
  };

  // Determine if a difference is positive or negative (from a UX perspective)
  const isDifferencePositive = (metricName: keyof MetricsData): boolean => {
    const diff = calculateDifference(metricName);

    // For response time, lower is better
    if (metricName === "responseTime") {
      return diff < 0;
    }

    // For all other metrics, higher is better
    return diff > 0;
  };

  // Format the difference for display
  const formatDifference = (metricName: keyof MetricsData): string => {
    const diff = calculateDifference(metricName);

    if (metricName === "responseTime") {
      return `${Math.abs(diff)}ms ${diff < 0 ? "faster" : "slower"}`;
    }

    if (metricName === "successRate" || metricName === "policyCompliance") {
      return `${diff > 0 ? "+" : ""}${diff}%`;
    }

    return `${diff > 0 ? "+" : ""}${diff}`;
  };

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <h3>Performance Metrics</h3>
        <div className="governance-toggle">
          <span className="toggle-label">Governance:</span>
          <button
            className={`toggle-button ${governanceEnabled ? "enabled" : "disabled"}`}
            onClick={onToggleGovernance}
          >
            {governanceEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="metrics-loading">Loading metrics...</div>
      ) : error ? (
        <div className="metrics-error">{error}</div>
      ) : (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon response-time">⚡</div>
            <div className="metric-content">
              <div className="metric-name">Response Time</div>
              <div className="metric-value">{metrics.responseTime}ms</div>
              {comparisonMetrics && (
                <div
                  className={`metric-comparison ${isDifferencePositive("responseTime") ? "positive" : "negative"}`}
                >
                  {formatDifference("responseTime")}
                </div>
              )}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon success-rate">✓</div>
            <div className="metric-content">
              <div className="metric-name">Success Rate</div>
              <div className="metric-value">{metrics.successRate}%</div>
              {comparisonMetrics && (
                <div
                  className={`metric-comparison ${isDifferencePositive("successRate") ? "positive" : "negative"}`}
                >
                  {formatDifference("successRate")}
                </div>
              )}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon policy-compliance">🛡️</div>
            <div className="metric-content">
              <div className="metric-name">Policy Compliance</div>
              <div className="metric-value">{metrics.policyCompliance}%</div>
              {comparisonMetrics && (
                <div
                  className={`metric-comparison ${isDifferencePositive("policyCompliance") ? "positive" : "negative"}`}
                >
                  {formatDifference("policyCompliance")}
                </div>
              )}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon blocked-actions">🚫</div>
            <div className="metric-content">
              <div className="metric-name">Blocked Actions</div>
              <div className="metric-value">{metrics.blockedActions}</div>
              <div className="metric-detail">
                of {metrics.totalActions} total
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailedCharts ? (
        <div className="metrics-chart">
          <div className="chart-header">
            <h4>Performance Impact</h4>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color with-governance"></div>
                <div className="legend-label">With Governance</div>
              </div>
              <div className="legend-item">
                <div className="legend-color without-governance"></div>
                <div className="legend-label">Without Governance</div>
              </div>
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-metric">
              <div className="chart-label">Response Time</div>
              <div className="chart-bars">
                <div className="chart-bar-container">
                  <div
                    className="chart-bar with-governance"
                    style={{
                      width: `${Math.min(100, (metrics.responseTime / 300) * 100)}%`,
                    }}
                  >
                    {metrics.responseTime}ms
                  </div>
                </div>
                {comparisonMetrics && (
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar without-governance"
                      style={{
                        width: `${Math.min(100, (comparisonMetrics.responseTime / 300) * 100)}%`,
                      }}
                    >
                      {comparisonMetrics.responseTime}ms
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-metric">
              <div className="chart-label">Success Rate</div>
              <div className="chart-bars">
                <div className="chart-bar-container">
                  <div
                    className="chart-bar with-governance"
                    style={{ width: `${metrics.successRate}%` }}
                  >
                    {metrics.successRate}%
                  </div>
                </div>
                {comparisonMetrics && (
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar without-governance"
                      style={{ width: `${comparisonMetrics.successRate}%` }}
                    >
                      {comparisonMetrics.successRate}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-metric">
              <div className="chart-label">Policy Compliance</div>
              <div className="chart-bars">
                <div className="chart-bar-container">
                  <div
                    className="chart-bar with-governance"
                    style={{ width: `${metrics.policyCompliance}%` }}
                  >
                    {metrics.policyCompliance}%
                  </div>
                </div>
                {comparisonMetrics && (
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar without-governance"
                      style={{
                        width: `${comparisonMetrics.policyCompliance}%`,
                      }}
                    >
                      {comparisonMetrics.policyCompliance}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="metrics-summary">
          <div className="summary-message">
            <p>
              Toggle governance on/off to see how it affects performance
              metrics.
            </p>
          </div>
          <button
            className="show-details-button"
            onClick={() => setShowDetailedCharts(true)}
          >
            Show Detailed Charts
          </button>
        </div>
      )}
    </div>
  );
}
