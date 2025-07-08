import { useState, useEffect } from "react";
import "./AuditLogs.css";

interface AuditLog {
  id: string;
  timestamp: string;
  agentId: string;
  action: {
    type: string;
    description: string;
    input: string;
    decision: string;
  };
  policyChecks: {
    policyId: string;
    result: boolean;
    reason: string;
  }[];
  metadata: {
    modelVersion: string;
    governancePolicy: string;
    complianceStatus: "compliant" | "non-compliant" | "warning";
    latencyMs: number;
  };
}

interface FilterState {
  startDate: string;
  endDate: string;
  agentId: string;
  actionType: string;
  complianceStatus: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    agentId: "",
    actionType: "",
    complianceStatus: "",
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  async function fetchLogs() {
    try {
      setLoading(true);
      const queryObject = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.agentId && { agentId: filters.agentId }),
        ...(filters.actionType && { actionType: filters.actionType }),
        ...(filters.complianceStatus && {
          complianceStatus: filters.complianceStatus,
        }),
      };

      const queryParams = new URLSearchParams(queryObject).toString();

      const response = await fetch(`/api/proxy/audit-logs?${queryParams}`, {
        headers: {
          "X-API-KEY":
            import.meta.env.VITE_API_KEY ||
            "Y10tiPBsbyEaZtVEvhu5uRj+YoRRiZQ6m3lsTOky1LQ=",
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setLogs(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load audit logs"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function renderFilters() {
    return (
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="agentId">Agent ID</label>
            <input
              type="text"
              id="agentId"
              placeholder="Filter by agent ID"
              value={filters.agentId}
              onChange={(e) => handleFilterChange("agentId", e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="actionType">Action Type</label>
            <select
              id="actionType"
              value={filters.actionType}
              onChange={(e) => handleFilterChange("actionType", e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="analysis">Analysis</option>
              <option value="decision">Decision</option>
              <option value="recommendation">Recommendation</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="complianceStatus">Compliance Status</label>
            <select
              id="complianceStatus"
              value={filters.complianceStatus}
              onChange={(e) =>
                handleFilterChange("complianceStatus", e.target.value)
              }
            >
              <option value="">All Status</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-Compliant</option>
              <option value="warning">Warning</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  function renderLogList() {
    if (loading) {
      return <div className="loading">Loading audit logs...</div>;
    }

    if (error) {
      return <div className="error">Error: {error}</div>;
    }

    if (logs.length === 0) {
      return (
        <div className="empty-state">
          <h3>No Audit Logs Found</h3>
          <p>No logs match your current filter criteria.</p>
        </div>
      );
    }

    return (
      <div className="logs-list">
        {logs.map((log) => (
          <div key={log.id} className="log-entry">
            <div className="log-header">
              <div className="log-timestamp">
                {new Date(log.timestamp).toLocaleString()}
              </div>
              <div className="log-agent">Agent: {log.agentId}</div>
              <div className={`log-status ${log.metadata.complianceStatus}`}>
                {log.metadata.complianceStatus}
              </div>
            </div>
            <div className="log-content">
              <div className="log-action">
                <h4>{log.action.type}</h4>
                <p>{log.action.description}</p>
              </div>
              <div className="log-details">
                <div className="detail-group">
                  <span className="label">Input:</span>
                  <span className="value">{log.action.input}</span>
                </div>
                <div className="detail-group">
                  <span className="label">Decision:</span>
                  <span className="value">{log.action.decision}</span>
                </div>
                <div className="detail-group">
                  <span className="label">Latency:</span>
                  <span className="value">{log.metadata.latencyMs}ms</span>
                </div>
              </div>
              <div className="policy-checks">
                <h5>Policy Checks</h5>
                <div className="checks-grid">
                  {log.policyChecks.map((check, index) => (
                    <div
                      key={index}
                      className={`check-item ${check.result ? "passed" : "failed"}`}
                    >
                      <span className="check-policy">{check.policyId}</span>
                      <span className="check-result">
                        {check.result ? "✓" : "✗"}
                      </span>
                      <span className="check-reason">{check.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="log-footer">
              <div className="metadata">
                <span>Model: {log.metadata.modelVersion}</span>
                <span>Policy: {log.metadata.governancePolicy}</span>
              </div>
              <button className="secondary-button">Export</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="audit-logs">
      <div className="audit-header">
        <div className="header-content">
          <h2>Audit Logs</h2>
          <p>Track and monitor AI agent activities and compliance</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button">
            <span>Export All</span>
          </button>
          <select className="refresh-select">
            <option value="30">Refresh: 30s</option>
            <option value="60">Refresh: 1m</option>
            <option value="300">Refresh: 5m</option>
          </select>
        </div>
      </div>
      {renderFilters()}
      {renderLogList()}
    </div>
  );
}
