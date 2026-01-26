import React, { useState, useEffect } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  shadowSystem,
  keyframeAnimations,
  colorSystem,
} from "../styles/design-system";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { getApiUrl, getRequestHeaders } from "../utils/api";

interface AuditLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: {
    type: string;
    description: string;
    input: string;
    decision: string;
    confidence?: number;
    riskScore?: number;
  };
  policyChecks: {
    policyId: string;
    policyName: string;
    result: boolean;
    reason: string;
    ruleTriggered?: string;
  }[];
  metadata: {
    modelVersion: string;
    governancePolicy: string;
    complianceStatus: "compliant" | "non-compliant" | "warning";
    latencyMs: number;
    executionContext?: string;
  };
  impact: {
    severity: "low" | "medium" | "high" | "critical";
    category: "trading" | "security" | "compliance" | "performance";
    financialImpact?: number;
  };
}

interface AIInsight {
  id: string;
  type: "pattern" | "anomaly" | "recommendation" | "trend";
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  relatedLogs: string[];
  generatedAt: string;
}

interface FilterState {
  startDate: string;
  endDate: string;
  agentId: string;
  actionType: string;
  complianceStatus: string;
  severity: string;
  category: string;
}

const containerStyles = css`
  max-width: 1600px;
  margin: 0 auto;
  padding: ${designTokens.spacing[6]};
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  min-height: 100vh;
`;

const headerStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
  text-align: center;
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[3]};
  background: linear-gradient(135deg, #1e293b, #475569);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  color: ${designTokens.colors.neutral[600]};
  max-width: 800px;
  margin: 0 auto;
`;

const metricsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const metricCardStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.md};
  border: 1px solid ${designTokens.colors.neutral[200]};
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
      90deg,
      ${designTokens.colors.primary[500]},
      ${designTokens.colors.primary[600]}
    );
  }
`;

const metricValueStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[2]};
  line-height: 1;
`;

const metricLabelStyles = css`
  color: ${designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const filtersStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.sm};
  border: 1px solid ${designTokens.colors.neutral[200]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const filterGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-top: ${designTokens.spacing[4]};
`;

const inputStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[3]};
  border: 1px solid ${designTokens.colors.neutral[300]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.sm};
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${designTokens.colors.primary[500]};
    box-shadow: 0 0 0 3px ${designTokens.colors.primary[100]};
  }
`;

const selectStyles = css`
  ${inputStyles}
  background: white;
  cursor: pointer;
`;

const insightsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const insightCardStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.md};
  border: 1px solid ${designTokens.colors.neutral[200]};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${shadowSystem.lg};
  }
`;

const insightTypeStyles = css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${designTokens.spacing[3]};

  &.pattern {
    background: ${designTokens.colors.secondary[100]};
    color: ${designTokens.colors.secondary[700]};
  }

  &.recommendation {
    background: ${designTokens.colors.primary[100]};
    color: ${designTokens.colors.primary[700]};
  }

  &.trend {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }

  &.anomaly {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }
`;

const confidenceBarStyles = css`
  width: 100%;
  height: 6px;
  background: ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.full};
  overflow: hidden;
  margin-top: ${designTokens.spacing[3]};
`;

const timelineStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.sm};
  border: 1px solid ${designTokens.colors.neutral[200]};
`;

const timelineItemStyles = css`
  display: flex;
  gap: ${designTokens.spacing[4]};
  padding: ${designTokens.spacing[4]};
  border-left: 2px solid ${designTokens.colors.neutral[200]};
  margin-left: ${designTokens.spacing[3]};
  position: relative;

  &::before {
    content: "";
    position: absolute;
    left: -6px;
    top: ${designTokens.spacing[6]};
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${designTokens.colors.primary[500]};
  }

  &:last-child {
    border-left-color: transparent;
  }
`;

const emptyStateStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[12]};
  color: ${designTokens.colors.neutral[500]};
`;

const loadingStyles = css`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
`;

const spinnerStyles = css`
  width: 40px;
  height: 40px;
  border: 3px solid ${designTokens.colors.neutral[200]};
  border-top: 3px solid ${designTokens.colors.primary[500]};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
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
    severity: "",
    category: "",
  });

  const [metrics, setMetrics] = useState({
    totalLogs: 0,
    complianceRate: 0,
    avgResponseTime: 0,
    criticalIssues: 0,
  });

  useEffect(() => {
    fetchLogs();
    fetchAIInsights();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, value]) => value !== ""),
      ).toString();

      const response = await fetch(
        getApiUrl(`/api/audit/logs?${queryParams}`),
        {
          headers: getRequestHeaders(),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const logsData = data.data || data.logs || [];
        setLogs(logsData);
        calculateMetrics(logsData);
      } else {
        throw new Error(`Failed to fetch audit logs (${response.status})`);
      }
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load audit logs",
      );
      setLogs([]);
      calculateMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      const response = await fetch(getApiUrl("/api/audit/insights"), {
        headers: getRequestHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.data || data.insights || []);
      } else {
        console.warn("AI insights not available");
        setAiInsights([]);
      }
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      setAiInsights([]);
    }
  };

  const calculateMetrics = (logs: AuditLog[]) => {
    const totalLogs = logs.length;
    const compliantLogs = logs.filter(
      (log) => log.metadata.complianceStatus === "compliant",
    ).length;
    const complianceRate =
      totalLogs > 0 ? (compliantLogs / totalLogs) * 100 : 0;
    const avgResponseTime =
      logs.reduce((sum, log) => sum + (log.metadata.latencyMs || 0), 0) /
        totalLogs || 0;
    const criticalIssues = logs.filter(
      (log) => log.impact.severity === "critical",
    ).length;

    setMetrics({
      totalLogs,
      complianceRate: Math.round(complianceRate * 10) / 10,
      avgResponseTime: Math.round(avgResponseTime),
      criticalIssues,
    });
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      agentId: "",
      actionType: "",
      complianceStatus: "",
      severity: "",
      category: "",
    });
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "pattern":
        return "🔍";
      case "recommendation":
        return "💡";
      case "trend":
        return "📈";
      case "anomaly":
        return "⚠️";
      default:
        return "🤖";
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case "compliant":
        return designTokens.colors.semantic.success[500];
      case "non-compliant":
        return designTokens.colors.semantic.error[500];
      case "warning":
        return designTokens.colors.semantic.warning[500];
      default:
        return designTokens.colors.neutral[400];
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return designTokens.colors.semantic.success[500];
      case "medium":
        return designTokens.colors.semantic.warning[500];
      case "high":
        return designTokens.colors.semantic.error[500];
      case "critical":
        return designTokens.colors.semantic.error[700];
      default:
        return designTokens.colors.neutral[400];
    }
  };

  if (loading) {
    return (
      <div css={containerStyles}>
        <div css={loadingStyles}>
          <div>
            <div css={spinnerStyles} />
            <p
              style={{
                marginTop: designTokens.spacing[4],
                color: designTokens.colors.neutral[600],
              }}
            >
              Loading audit logs...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <h1 css={titleStyles}>Audit Logs & Insights</h1>
        <p css={subtitleStyles}>
          Monitor your autonomous agents with comprehensive audit trails and
          AI-powered insights
        </p>
      </div>

      {/* Metrics Dashboard */}
      <div css={metricsGridStyles}>
        <div css={metricCardStyles}>
          <div css={metricValueStyles}>
            {metrics.totalLogs.toLocaleString()}
          </div>
          <div css={metricLabelStyles}>Total Actions Logged</div>
        </div>
        <div css={metricCardStyles}>
          <div css={metricValueStyles}>{metrics.complianceRate}%</div>
          <div css={metricLabelStyles}>Compliance Rate</div>
        </div>
        <div css={metricCardStyles}>
          <div css={metricValueStyles}>{metrics.avgResponseTime}ms</div>
          <div css={metricLabelStyles}>Avg Response Time</div>
        </div>
        <div css={metricCardStyles}>
          <div css={metricValueStyles}>{metrics.criticalIssues}</div>
          <div css={metricLabelStyles}>Critical Issues</div>
        </div>
      </div>

      {/* Filters */}
      <div css={filtersStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: designTokens.spacing[4],
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: designTokens.typography.fontSize.lg,
              fontWeight: designTokens.typography.fontWeight.semibold,
            }}
          >
            Filter Audit Logs
          </h3>
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>

        <div css={filterGridStyles}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Start Date
            </label>
            <input
              type="date"
              css={inputStyles}
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              End Date
            </label>
            <input
              type="date"
              css={inputStyles}
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Agent
            </label>
            <select
              css={selectStyles}
              value={filters.agentId}
              onChange={(e) => handleFilterChange("agentId", e.target.value)}
            >
              <option value="">All Agents</option>
              <option value="recall-agent-1">Recall Trading Agent</option>
              <option value="vincent-agent-1">
                Vincent Social Trading Agent
              </option>
              <option value="sapience-agent-1">
                Sapience Forecasting Agent
              </option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Action Type
            </label>
            <select
              css={selectStyles}
              value={filters.actionType}
              onChange={(e) => handleFilterChange("actionType", e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="trade_execution">Trade Execution</option>
              <option value="sentiment_analysis">Sentiment Analysis</option>
              <option value="risk_assessment">Risk Assessment</option>
              <option value="forecast">Forecast Generation</option>
              <option value="policy_check">Policy Check</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Compliance Status
            </label>
            <select
              css={selectStyles}
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

          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Severity
            </label>
            <select
              css={selectStyles}
              value={filters.severity}
              onChange={(e) => handleFilterChange("severity", e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: designTokens.spacing[3],
              marginBottom: designTokens.spacing[6],
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: designTokens.typography.fontSize["2xl"],
                fontWeight: designTokens.typography.fontWeight.bold,
              }}
            >
              🤖 AI-Powered Insights
            </h2>
            <Badge variant="secondary" size="sm">
              Powered by Gemini
            </Badge>
          </div>

          <div css={insightsGridStyles}>
            {aiInsights.map((insight) => (
              <div key={insight.id} css={insightCardStyles}>
                <div css={[insightTypeStyles, css`&.${insight.type}`]}>
                  <span>{getInsightIcon(insight.type)}</span>
                  {insight.type}
                </div>

                <h3
                  style={{
                    margin: `0 0 ${designTokens.spacing[3]} 0`,
                    fontSize: designTokens.typography.fontSize.lg,
                    fontWeight: designTokens.typography.fontWeight.semibold,
                  }}
                >
                  {insight.title}
                </h3>

                <p
                  style={{
                    margin: `0 0 ${designTokens.spacing[4]} 0`,
                    color: designTokens.colors.neutral[600],
                    lineHeight: 1.6,
                  }}
                >
                  {insight.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: designTokens.typography.fontSize.sm,
                        color: designTokens.colors.neutral[500],
                        marginBottom: designTokens.spacing[1],
                      }}
                    >
                      Confidence
                    </div>
                    <div
                      style={{
                        fontSize: designTokens.typography.fontSize.lg,
                        fontWeight: designTokens.typography.fontWeight.bold,
                        color: designTokens.colors.primary[600],
                      }}
                    >
                      {insight.confidence}%
                    </div>
                  </div>

                  {insight.actionable && (
                    <Button variant="primary" size="sm">
                      Take Action
                    </Button>
                  )}
                </div>

                <div css={confidenceBarStyles}>
                  <div
                    style={{
                      width: `${insight.confidence}%`,
                      height: "100%",
                      background:
                        insight.confidence > 80
                          ? designTokens.colors.semantic.success[500]
                          : insight.confidence > 60
                            ? designTokens.colors.semantic.warning[500]
                            : designTokens.colors.semantic.error[500],
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Timeline */}
      <div css={timelineStyles}>
        <h2
          style={{
            margin: `0 0 ${designTokens.spacing[6]} 0`,
            fontSize: designTokens.typography.fontSize["2xl"],
            fontWeight: designTokens.typography.fontWeight.bold,
          }}
        >
          Audit Timeline
        </h2>

        {error && (
          <div
            style={{
              padding: designTokens.spacing[4],
              background: designTokens.colors.semantic.error[50],
              border: `1px solid ${designTokens.colors.semantic.error[200]}`,
              borderRadius: designTokens.borderRadius.md,
              color: designTokens.colors.semantic.error[700],
              marginBottom: designTokens.spacing[6],
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {logs.length === 0 && !error ? (
          <div css={emptyStateStyles}>
            <div
              style={{
                fontSize: "3rem",
                marginBottom: designTokens.spacing[4],
              }}
            >
              📝
            </div>
            <h3>No audit logs found</h3>
            <p>
              No audit logs match your current filters. Try adjusting the date
              range or clearing filters.
            </p>
            <Button
              onClick={clearFilters}
              style={{ marginTop: designTokens.spacing[4] }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div>
            {logs.map((log) => (
              <div key={log.id} css={timelineItemStyles}>
                <div
                  style={{
                    minWidth: "120px",
                    fontSize: designTokens.typography.fontSize.sm,
                    color: designTokens.colors.neutral[500],
                  }}
                >
                  {new Date(log.timestamp).toLocaleString()}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: designTokens.spacing[3],
                      marginBottom: designTokens.spacing[2],
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: designTokens.typography.fontSize.base,
                        fontWeight: designTokens.typography.fontWeight.semibold,
                      }}
                    >
                      {log.agentName}
                    </h4>
                    <Badge
                      variant={
                        log.metadata.complianceStatus === "compliant"
                          ? "success"
                          : log.metadata.complianceStatus === "warning"
                            ? "warning"
                            : "error"
                      }
                      size="sm"
                    >
                      {log.metadata.complianceStatus}
                    </Badge>
                    <Badge variant="secondary" size="sm">
                      {log.impact.severity}
                    </Badge>
                  </div>

                  <p
                    style={{
                      margin: `0 0 ${designTokens.spacing[2]} 0`,
                      color: designTokens.colors.neutral[700],
                    }}
                  >
                    <strong>{log.action.type.replace("_", " ")}:</strong>{" "}
                    {log.action.description}
                  </p>

                  {log.action.confidence && (
                    <div
                      style={{
                        fontSize: designTokens.typography.fontSize.sm,
                        color: designTokens.colors.neutral[500],
                      }}
                    >
                      Confidence: {Math.round(log.action.confidence * 100)}% |
                      Response Time: {log.metadata.latencyMs}ms
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
