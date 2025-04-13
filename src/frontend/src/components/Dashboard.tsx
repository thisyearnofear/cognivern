import { useState, useEffect } from 'react';

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
    async function fetchMetrics() {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3000/api/metrics/daily');

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading metrics...</div>;
  }

  if (error) {
    return <div className="dashboard-error">Error: {error}</div>;
  }

  return (
    <div className="dashboard">
      <h2>Agent Metrics Dashboard</h2>

      {metrics ? (
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total Actions</h3>
            <p className="metric-value">{metrics.data.actions.total}</p>
          </div>

          <div className="metric-card">
            <h3>Average Response Time</h3>
            <p className="metric-value">
              {metrics.data.performance.averageResponseTime.toFixed(2)} ms
            </p>
          </div>

          <div className="metric-card">
            <h3>Policy Compliance</h3>
            <p className="metric-value">
              {metrics.data.policies.enforced} passed / {metrics.data.policies.violations} failed
            </p>
          </div>

          <div className="metric-card">
            <h3>Max Response Time</h3>
            <p className="metric-value">{metrics.data.performance.maxResponseTime.toFixed(2)} ms</p>
          </div>

          <div className="metric-card">
            <h3>Last Updated</h3>
            <p className="metric-value">
              {new Date(metrics.timestamp).toLocaleDateString()}{' '}
              {new Date(metrics.timestamp).toLocaleTimeString()}
            </p>
          </div>

          <div className="metric-card">
            <h3>Resource Usage</h3>
            <p className="metric-value">CPU: {metrics.data.resources.cpuUsage}%</p>
            <p>Memory: {metrics.data.resources.memoryUsage} MB</p>
          </div>
        </div>
      ) : (
        <p>No metrics available</p>
      )}
    </div>
  );
}
