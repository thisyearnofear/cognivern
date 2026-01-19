import { useState, useEffect } from "react";
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';
import { Container } from '../layout/ResponsiveLayout';
import { getApiUrl } from "../../utils/api";

// Match the backend Metrics interface structure
interface Metrics {
  timestamp: string;
  period: string;
  data: {
    actions: {
      total: number;
      successful: number;
      failed: number;
      blocked: number;
    };
    policies: {
      total: number;
      violations: number;
      enforced: number;
    };
    performance: {
      averageResponseTime: number;
      p95ResponseTime: number;
      maxResponseTime: number;
    };
    resources: {
      cpuUsage: number;
      memoryUsage: number;
      storageUsage: number;
    };
  };
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | undefined;

    async function fetchMetrics(isInitial = false) {
      if (!isMounted) return;

      try {
        if (isInitial) setLoading(true);
        console.log("Fetching real blockchain metrics from backend");

        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(getApiUrl("/api/metrics/daily"), {
          headers: {
            "X-API-KEY": import.meta.env.VITE_API_KEY || "development-api-key",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Backend error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        if (isMounted) {
          console.log("Received real blockchain metrics:", data);
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching metrics:", err);
          const errorMessage = err instanceof Error ? err.message : "Network error - unable to reach server";
          
          // Only show error if we don't have any data yet
          if (isInitial || !metrics) {
            setError(errorMessage);
          }
        }
      } finally {
        if (isMounted && isInitial) {
          setLoading(false);
        }
      }
    }

    // Initial fetch
    fetchMetrics();

    // Set up polling every 60 seconds (reduced from 30s to prevent performance issues)
    const intervalId = setInterval(() => {
      if (isMounted) {
        fetchMetrics();
      }
    }, 60000);

    // Cleanup function
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading metrics...</div>;
  }

  if (error) {
    return <div className="dashboard-error">Error: {error}</div>;
  }

  const hasData =
    metrics &&
    (metrics.data.actions.total > 0 ||
      metrics.data.policies.total > 0 ||
      metrics.data.performance.averageResponseTime > 0);

  return (
    <div className="dashboard">
      <h2>Agent Metrics Dashboard</h2>
      <p className="dashboard-update-time">
        Last updated:{" "}
        {metrics?.timestamp
          ? new Date(metrics.timestamp).toLocaleString()
          : "Never"}
      </p>

      {metrics ? (
        <div>
          {!hasData && (
            <div className="metrics-empty-state">
              <p>No metrics data available yet. This could be because:</p>
              <ul>
                <li>No agent actions have been recorded yet</li>
                <li>The bucket is new or empty</li>
                <li>There may be connection issues with the Recall service</li>
              </ul>
              <p>
                The dashboard will automatically update when data becomes
                available.
              </p>
            </div>
          )}

          <div className="metrics-grid">
            {/* Actions Section */}
            <div className="metric-section">
              <h3>Actions</h3>
              <div className="metric-card">
                <div className="metric-header">Total Actions</div>
                <p className="metric-value">{metrics.data.actions.total}</p>
                <div className="metric-breakdown">
                  <span className="success">
                    ✓ {metrics.data.actions.successful}
                  </span>
                  <span className="failure">
                    ✗ {metrics.data.actions.failed}
                  </span>
                  <span className="blocked">
                    ⚠ {metrics.data.actions.blocked}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Section */}
            <div className="metric-section">
              <h3>Performance</h3>
              <div className="metric-card">
                <div className="metric-header">Response Times</div>
                <div className="metric-multi-value">
                  <div>
                    <span className="label">Average</span>
                    <span className="value">
                      {metrics.data.performance.averageResponseTime.toFixed(2)}{" "}
                      ms
                    </span>
                  </div>
                  <div>
                    <span className="label">P95</span>
                    <span className="value">
                      {metrics.data.performance.p95ResponseTime.toFixed(2)} ms
                    </span>
                  </div>
                  <div>
                    <span className="label">Max</span>
                    <span className="value">
                      {metrics.data.performance.maxResponseTime.toFixed(2)} ms
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Policy Section */}
            <div className="metric-section">
              <h3>Policy Enforcement</h3>
              <div className="metric-card">
                <div className="metric-header">Policy Checks</div>
                <div className="metric-multi-value">
                  <div>
                    <span className="label">Total</span>
                    <span className="value">{metrics.data.policies.total}</span>
                  </div>
                  <div>
                    <span className="label">Passed</span>
                    <span className="value success">
                      {metrics.data.policies.enforced}
                    </span>
                  </div>
                  <div>
                    <span className="label">Violations</span>
                    <span className="value failure">
                      {metrics.data.policies.violations}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resource Usage Section */}
            <div className="metric-section">
              <h3>Resource Usage</h3>
              <div className="metric-card">
                <div className="metric-header">System Resources</div>
                <div className="metric-multi-value">
                  <div>
                    <span className="label">CPU</span>
                    <span className="value">
                      {metrics.data.resources.cpuUsage}%
                    </span>
                  </div>
                  <div>
                    <span className="label">Memory</span>
                    <span className="value">
                      {metrics.data.resources.memoryUsage} MB
                    </span>
                  </div>
                  <div>
                    <span className="label">Storage</span>
                    <span className="value">
                      {metrics.data.resources.storageUsage} GB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p>No metrics available</p>
      )}
    </div>
  );
}
