/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiUrl, getRequestHeaders } from "../../utils/api";
import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  keyframeAnimations,
} from "../../styles/design-system";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/Card";
import { Button } from "../ui/Button";

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
  evidence?: {
    hash: string;
    cid?: string;
    artifactIds?: string[];
    policyIds?: string[];
    citations?: string[];
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

interface RawAuditLogResponse {
  id: string;
  timestamp: string;
  agent?: string;
  actionType?: string;
  description?: string;
  complianceStatus?: "compliant" | "non-compliant" | "warning";
  severity?: "low" | "medium" | "high" | "critical";
  responseTime?: number;
  details?: Record<string, any>;
  policyChecks?: Array<{
    policyId: string;
    result: boolean;
    reason?: string;
  }>;
  evidence?: {
    hash: string;
    cid?: string;
    artifactIds?: string[];
    policyIds?: string[];
    citations?: string[];
  };
}

const normalizeAuditLog = (log: RawAuditLogResponse): AuditLog => {
  const details = log.details || {};
  const confidence =
    typeof details.confidence === "number" ? details.confidence : undefined;
  const riskScore =
    typeof details.riskScore === "number" ? details.riskScore : undefined;
  const financialImpact =
    typeof details.financialImpact === "number"
      ? details.financialImpact
      : undefined;
  const category =
    details.category === "trading" ||
    details.category === "security" ||
    details.category === "compliance" ||
    details.category === "performance"
      ? details.category
      : "compliance";

  return {
    id: log.id,
    timestamp: log.timestamp,
    agentId: String(details.agentId || log.agent || "unknown"),
    agentName: String(details.agentName || log.agent || "Unknown Agent"),
    action: {
      type: String(log.actionType || "unknown"),
      description: String(log.description || "No description available"),
      input: JSON.stringify(details.input || details, null, 2),
      decision: log.complianceStatus === "non-compliant" ? "denied" : "allowed",
      confidence,
      riskScore,
    },
    policyChecks: (log.policyChecks || []).map((check) => ({
      policyId: check.policyId,
      policyName: check.policyId,
      result: check.result,
      reason: check.reason || "No reason provided",
      ruleTriggered: check.result ? undefined : check.policyId,
    })),
    metadata: {
      modelVersion: String(details.modelVersion || "unknown"),
      governancePolicy: String(details.governancePolicy || "local"),
      complianceStatus: log.complianceStatus || "warning",
      latencyMs: typeof log.responseTime === "number" ? log.responseTime : 0,
      executionContext: details.executionContext
        ? String(details.executionContext)
        : undefined,
    },
    impact: {
      severity: log.severity || "low",
      category,
      financialImpact,
    },
    evidence: log.evidence,
  };
};

const normalizeInsight = (insight: any): AIInsight => ({
  id: String(insight.id),
  type:
    insight.type === "recommendation" ||
    insight.type === "pattern" ||
    insight.type === "trend"
      ? insight.type
      : "anomaly",
  title: String(insight.title || "Insight"),
  description: String(insight.description || ""),
  confidence: Math.round(Number(insight.confidence || 0) * 100),
  actionable: Boolean(insight.actionRequired),
  relatedLogs: Array.isArray(insight.relatedLogs) ? insight.relatedLogs : [],
  generatedAt: new Date().toISOString(),
});

const containerStyles = css`
  padding: ${designTokens.spacing[6]};
  max-width: 1600px;
  margin: 0 auto;
`;

const headerStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
  text-align: center;
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  background: ${designTokens.colorSystem.gradients.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: ${designTokens.spacing[4]};
`;

const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  color: ${designTokens.colors.neutral[600]};
  max-width: 800px;
  margin: 0 auto;
`;

const dashboardGridStyles = css`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const metricCardStyles = css`
  text-align: center;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${designTokens.colorSystem.gradients.primary};
  }
`;

const metricValueStyles = css`
  font-size: ${designTokens.typography.fontSize["2xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[2]};
`;

const metricLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const filtersStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[6]};
  padding: ${designTokens.spacing[6]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.lg};
`;

const filterGroupStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
`;

const labelStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  color: ${designTokens.colors.neutral[700]};
`;

const inputStyles = css`
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

const insightsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const insightCardStyles = css`
  border-left: 4px solid ${designTokens.colors.primary[500]};

  &.pattern {
    border-left-color: ${designTokens.colors.primary[500]};
  }

  &.anomaly {
    border-left-color: ${designTokens.colors.semantic.warning[500]};
  }

  &.recommendation {
    border-left-color: ${designTokens.colors.semantic.success[500]};
  }

  &.trend {
    border-left-color: ${designTokens.colors.semantic.info[500]};
  }
`;

const confidenceBarStyles = css`
  width: 100%;
  height: 4px;
  background: ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.full};
  overflow: hidden;
  margin-top: ${designTokens.spacing[2]};
`;

const confidenceFillStyles = (confidence: number) => css`
  height: 100%;
  background: ${confidence > 80
    ? designTokens.colors.semantic.success[500]
    : confidence > 60
      ? designTokens.colors.semantic.warning[500]
      : designTokens.colors.semantic.error[500]};
  width: ${confidence}%;
  transition: width 0.3s ease;
`;

const logTimelineStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[4]};
`;

const logItemStyles = css`
  position: relative;
  padding-left: ${designTokens.spacing[8]};

  &::before {
    content: "";
    position: absolute;
    left: ${designTokens.spacing[3]};
    top: ${designTokens.spacing[4]};
    width: 2px;
    height: calc(100% - ${designTokens.spacing[4]});
    background: ${designTokens.colors.neutral[200]};
  }

  &::after {
    content: "";
    position: absolute;
    left: ${designTokens.spacing[2]};
    top: ${designTokens.spacing[4]};
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${designTokens.colors.primary[500]};
    border: 2px solid white;
    box-shadow: ${designTokens.shadows.sm};
  }

  &.non-compliant::after {
    background: ${designTokens.colors.semantic.error[500]};
  }

  &.warning::after {
    background: ${designTokens.colors.semantic.warning[500]};
  }
`;

const statusBadgeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;

  &.compliant {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }

  &.non-compliant {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }

  &.warning {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }
`;

const severityBadgeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  margin-left: ${designTokens.spacing[2]};

  &.low {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }

  &.medium {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }

  &.high {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }

  &.critical {
    background: ${designTokens.colors.semantic.error[500]};
    color: white;
  }
`;

export default function EnhancedAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    startDate:
      searchParams.get("startDate") ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    endDate:
      searchParams.get("endDate") || new Date().toISOString().split("T")[0],
    agentId: searchParams.get("agentId") || "",
    actionType: searchParams.get("actionType") || "",
    complianceStatus: searchParams.get("complianceStatus") || "",
    severity: searchParams.get("severity") || "",
    category: searchParams.get("category") || "",
  });
  const highlightedEventId = searchParams.get("eventId") || "";

  const [metrics, setMetrics] = useState({
    totalLogs: 0,
    complianceRate: 0,
    avgResponseTime: 0,
    criticalIssues: 0,
  });

  useEffect(() => {
    fetchLogs();
    generateAIInsights();
  }, [filters]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") {
        nextParams.set(key, value);
      }
    });
    if (highlightedEventId) {
      nextParams.set("eventId", highlightedEventId);
    }
    setSearchParams(nextParams, { replace: true });
  }, [filters, highlightedEventId, setSearchParams]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const queryEntries = Object.entries(filters).flatMap(([key, value]) => {
        if (value === "") return [];
        if (key === "agentId") {
          return [["agent", value]];
        }
        return [[key, value]];
      });
      const queryParams = new URLSearchParams(queryEntries).toString();

      const response = await fetch(getApiUrl(`/api/audit/logs?${queryParams}`), {
        headers: getRequestHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const logsArray = Array.isArray(data)
          ? data
          : Array.isArray(data.data?.logs)
            ? data.data.logs
            : [];
        const normalizedLogs = logsArray.map(normalizeAuditLog);
        setLogs(normalizedLogs);
        calculateMetrics(normalizedLogs);
      } else {
        setError("Failed to load audit logs");
        setLogs([]);
        calculateMetrics([]);
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

  const calculateMetrics = (logs: AuditLog[]) => {
    const totalLogs = logs.length;
    const compliantLogs = logs.filter(
      (log) => log.metadata.complianceStatus === "compliant",
    ).length;
    const complianceRate =
      totalLogs > 0 ? (compliantLogs / totalLogs) * 100 : 0;
    const avgResponseTime =
      logs.reduce((sum, log) => sum + log.metadata.latencyMs, 0) / totalLogs ||
      0;
    const criticalIssues = logs.filter(
      (log) => log.impact.severity === "critical",
    ).length;

    setMetrics({
      totalLogs,
      complianceRate,
      avgResponseTime,
      criticalIssues,
    });
  };

  const generateAIInsights = async () => {
    try {
      const response = await fetch(getApiUrl("/api/audit/insights"), {
        headers: getRequestHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setAiInsights(Array.isArray(data.data) ? data.data.map(normalizeInsight) : []);
      } else {
        setAiInsights([]);
      }
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      setAiInsights([]);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const renderMetrics = () => (
    <div css={dashboardGridStyles}>
      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>
            {metrics.totalLogs.toLocaleString()}
          </div>
          <div css={metricLabelStyles}>Total Actions Logged</div>
        </CardContent>
      </Card>

      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>
            {metrics.complianceRate.toFixed(1)}%
          </div>
          <div css={metricLabelStyles}>Compliance Rate</div>
        </CardContent>
      </Card>

      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>
            {metrics.avgResponseTime.toFixed(0)}ms
          </div>
          <div css={metricLabelStyles}>Avg Response Time</div>
        </CardContent>
      </Card>

      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>{metrics.criticalIssues}</div>
          <div css={metricLabelStyles}>Critical Issues</div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFilters = () => (
    <Card variant="outlined">
      <CardContent>
        <CardTitle
          css={css`
            margin-bottom: ${designTokens.spacing[4]};
          `}
        >
          Filter Audit Logs
        </CardTitle>
        <div css={filtersStyles}>
          <div css={filterGroupStyles}>
            <label css={labelStyles}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              css={inputStyles}
            />
          </div>

          <div css={filterGroupStyles}>
            <label css={labelStyles}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              css={inputStyles}
            />
          </div>

          <div css={filterGroupStyles}>
            <label css={labelStyles}>Agent</label>
            <select
              value={filters.agentId}
              onChange={(e) => handleFilterChange("agentId", e.target.value)}
              css={inputStyles}
            >
              <option value="">All Agents</option>
              <option value="recall-agent-1">Recall Trading Agent</option>
              <option value="vincent-agent-1">
                Vincent Social Trading Agent
              </option>
            </select>
          </div>

          <div css={filterGroupStyles}>
            <label css={labelStyles}>Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => handleFilterChange("actionType", e.target.value)}
              css={inputStyles}
            >
              <option value="">All Actions</option>
              <option value="trade_execution">Trade Execution</option>
              <option value="sentiment_analysis">Sentiment Analysis</option>
              <option value="risk_assessment">Risk Assessment</option>
            </select>
          </div>

          <div css={filterGroupStyles}>
            <label css={labelStyles}>Compliance Status</label>
            <select
              value={filters.complianceStatus}
              onChange={(e) =>
                handleFilterChange("complianceStatus", e.target.value)
              }
              css={inputStyles}
            >
              <option value="">All Status</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-Compliant</option>
              <option value="warning">Warning</option>
            </select>
          </div>

          <div css={filterGroupStyles}>
            <label css={labelStyles}>Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => handleFilterChange("severity", e.target.value)}
              css={inputStyles}
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAIInsights = () => (
    <div>
      <h3
        css={css`
          font-size: ${designTokens.typography.fontSize.xl};
          margin-bottom: ${designTokens.spacing[4]};
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
        `}
      >
        AI Insights
        <span
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
            color: ${designTokens.colors.neutral[500]};
            font-weight: normal;
          `}
        >
          Generated from recent audit activity
        </span>
      </h3>

      <div css={insightsGridStyles}>
        {aiInsights.map((insight) => (
          <Card
            key={insight.id}
            variant="default"
            css={css`${insightCardStyles}; &.${insight.type}`}
          >
            <CardContent>
              <div
                css={css`
                  display: flex;
                  justify-content: between;
                  align-items: start;
                  margin-bottom: ${designTokens.spacing[3]};
                `}
              >
                <CardTitle
                  css={css`
                    margin-bottom: ${designTokens.spacing[2]};
                  `}
                >
                  {insight.title}
                </CardTitle>
                <span
                  css={css`
                    padding: ${designTokens.spacing[1]}
                      ${designTokens.spacing[2]};
                    background: ${designTokens.colors.primary[100]};
                    color: ${designTokens.colors.primary[700]};
                    border-radius: ${designTokens.borderRadius.full};
                    font-size: ${designTokens.typography.fontSize.xs};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    text-transform: uppercase;
                  `}
                >
                  {insight.type}
                </span>
              </div>

              <CardDescription
                css={css`
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                {insight.description}
              </CardDescription>

              <div
                css={css`
                  margin-bottom: ${designTokens.spacing[3]};
                `}
              >
                <div
                  css={css`
                    display: flex;
                    justify-content: between;
                    align-items: center;
                    margin-bottom: ${designTokens.spacing[1]};
                  `}
                >
                  <span
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Confidence
                  </span>
                  <span
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                    `}
                  >
                    {insight.confidence}%
                  </span>
                </div>
                <div css={confidenceBarStyles}>
                  <div css={confidenceFillStyles(insight.confidence)} />
                </div>
              </div>

              {insight.actionable && (
                <button
                  css={css`
                    width: 100%;
                    padding: ${designTokens.spacing[3]};
                    background: ${designTokens.colors.primary[500]};
                    color: white;
                    border: none;
                    border-radius: ${designTokens.borderRadius.md};
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    cursor: pointer;
                    transition: background 0.2s ease;

                    &:hover {
                      background: ${designTokens.colors.primary[600]};
                    }
                  `}
                >
                  Take Action
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderLogs = () => (
    <div>
      <h3
        css={css`
          font-size: ${designTokens.typography.fontSize.xl};
          margin-bottom: ${designTokens.spacing[4]};
        `}
      >
        Audit Timeline
      </h3>

      <div css={logTimelineStyles}>
        {logs.map((log) => (
          <div
            key={log.id}
            css={css`
              ${logItemStyles};
              &.${log.metadata.complianceStatus}
              ${highlightedEventId === log.id
                ? `
                    border: 2px solid ${designTokens.colors.primary[500]};
                    box-shadow: 0 0 0 4px ${designTokens.colors.primary[100]};
                  `
                : ""}
            `}
          >
            <Card variant="default">
              <CardContent>
                <div
                  css={css`
                    display: flex;
                    justify-content: between;
                    align-items: start;
                    margin-bottom: ${designTokens.spacing[3]};
                  `}
                >
                  <div>
                    <CardTitle
                      css={css`
                        margin-bottom: ${designTokens.spacing[1]};
                      `}
                    >
                      {log.agentName}
                    </CardTitle>
                    <div
                      css={css`
                        font-size: ${designTokens.typography.fontSize.sm};
                        color: ${designTokens.colors.neutral[500]};
                      `}
                    >
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div
                    css={css`
                      display: flex;
                      align-items: center;
                    `}
                  >
                    <span
                      css={css`${statusBadgeStyles}; &.${log.metadata.complianceStatus}`}
                    >
                      {log.metadata.complianceStatus}
                    </span>
                    <span
                      css={css`${severityBadgeStyles}; &.${log.impact.severity}`}
                    >
                      {log.impact.severity}
                    </span>
                  </div>
                </div>

                <div
                  css={css`
                    margin-bottom: ${designTokens.spacing[4]};
                  `}
                >
                  <h4
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                      margin-bottom: ${designTokens.spacing[2]};
                    `}
                  >
                    Action: {log.action.type}
                  </h4>
                  <p
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                      margin-bottom: ${designTokens.spacing[2]};
                    `}
                  >
                    {log.action.description}
                  </p>
                  <div
                    css={css`
                      display: grid;
                      grid-template-columns: 1fr 1fr;
                      gap: ${designTokens.spacing[4]};
                    `}
                  >
                    <div>
                      <strong>Input:</strong> {log.action.input}
                    </div>
                    <div>
                      <strong>Decision:</strong> {log.action.decision}
                    </div>
                  </div>
                  {log.action.confidence && (
                    <div
                      css={css`
                        margin-top: ${designTokens.spacing[2]};
                      `}
                    >
                      <strong>Confidence:</strong>{" "}
                      {(log.action.confidence * 100).toFixed(1)}%
                      {log.action.riskScore && (
                        <span
                          css={css`
                            margin-left: ${designTokens.spacing[4]};
                          `}
                        >
                          <strong>Risk Score:</strong>{" "}
                          {(log.action.riskScore * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div
                  css={css`
                    margin-bottom: ${designTokens.spacing[4]};
                  `}
                >
                  <h4
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                      margin-bottom: ${designTokens.spacing[2]};
                    `}
                  >
                    Policy Checks ({log.policyChecks.length})
                  </h4>
                  {log.policyChecks.map((check, index) => (
                    <div
                      key={index}
                      css={css`
                        padding: ${designTokens.spacing[3]};
                        background: ${check.result
                          ? designTokens.colors.semantic.success[50]
                          : designTokens.colors.semantic.error[50]};
                        border-radius: ${designTokens.borderRadius.md};
                        border-left: 4px solid
                          ${check.result
                            ? designTokens.colors.semantic.success[500]
                            : designTokens.colors.semantic.error[500]};
                        margin-bottom: ${designTokens.spacing[2]};
                      `}
                    >
                      <div
                        css={css`
                          display: flex;
                          justify-content: between;
                          align-items: center;
                          margin-bottom: ${designTokens.spacing[1]};
                        `}
                      >
                        <strong>{check.policyName}</strong>
                        <span
                          css={css`
                            padding: ${designTokens.spacing[1]}
                              ${designTokens.spacing[2]};
                            background: ${check.result
                              ? designTokens.colors.semantic.success[100]
                              : designTokens.colors.semantic.error[100]};
                            color: ${check.result
                              ? designTokens.colors.semantic.success[700]
                              : designTokens.colors.semantic.error[700]};
                            border-radius: ${designTokens.borderRadius.full};
                            font-size: ${designTokens.typography.fontSize.xs};
                            font-weight: ${designTokens.typography.fontWeight
                              .semibold};
                          `}
                        >
                          {check.result ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.sm};
                          color: ${designTokens.colors.neutral[600]};
                        `}
                      >
                        {check.reason}
                      </div>
                      {check.ruleTriggered && (
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            color: ${designTokens.colors.neutral[500]};
                            margin-top: ${designTokens.spacing[1]};
                          `}
                        >
                          Rule: {check.ruleTriggered}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  css={css`
                    display: flex;
                    justify-content: between;
                    align-items: center;
                    padding-top: ${designTokens.spacing[3]};
                    border-top: 1px solid ${designTokens.colors.neutral[200]};
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Response Time: {log.metadata.latencyMs}ms
                    {log.impact.financialImpact && (
                      <span
                        css={css`
                          margin-left: ${designTokens.spacing[4]};
                        `}
                      >
                        Impact: {log.impact.financialImpact > 0 ? "+" : ""}
                        {log.impact.financialImpact.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    )}
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.xs};
                      color: ${designTokens.colors.neutral[500]};
                    `}
                  >
                    {log.metadata.executionContext}
                  </div>
                </div>

                {log.evidence && (
                  <div
                    css={css`
                      display: flex;
                      flex-wrap: wrap;
                      gap: ${designTokens.spacing[2]};
                      margin-top: ${designTokens.spacing[3]};
                    `}
                  >
                    <span css={statusBadgeStyles}>Hash {log.evidence.hash.slice(0, 12)}…</span>
                    {log.evidence.cid && (
                      <span css={statusBadgeStyles}>CID {log.evidence.cid.slice(0, 12)}…</span>
                    )}
                    {log.evidence.artifactIds?.length ? (
                      <span css={statusBadgeStyles}>
                        Artifacts {log.evidence.artifactIds.slice(0, 2).join(", ")}
                      </span>
                    ) : null}
                    {log.evidence.policyIds?.length ? (
                      <span css={statusBadgeStyles}>
                        Policies {log.evidence.policyIds.slice(0, 2).join(", ")}
                      </span>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div css={containerStyles}>
        <div
          css={css`
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          `}
        >
          <div
            css={css`
              text-align: center;
            `}
          >
            <div
              css={css`
                width: 40px;
                height: 40px;
                border: 3px solid ${designTokens.colors.neutral[200]};
                border-top: 3px solid ${designTokens.colors.primary[500]};
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto ${designTokens.spacing[4]};

                @keyframes spin {
                  0% {
                    transform: rotate(0deg);
                  }
                  100% {
                    transform: rotate(360deg);
                  }
                }
              `}
            />
            <p>Loading audit logs...</p>
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
        <div
          style={{
            marginTop: designTokens.spacing[6],
            display: "flex",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <Button
            size="sm"
            variant={!isSimplifiedMode ? "primary" : "secondary"}
            onClick={() => setIsSimplifiedMode(false)}
          >
            Technical View
          </Button>
          <Button
            size="sm"
            variant={isSimplifiedMode ? "primary" : "secondary"}
            onClick={() => setIsSimplifiedMode(true)}
          >
            Executive Summary
          </Button>
        </div>
      </div>

      {isSimplifiedMode ? (
        <div style={{ animation: "fadeIn 0.5s ease-out" }}>
          {renderMetrics()}
          {renderAIInsights()}
          <Card variant="outlined">
            <CardContent>
              <CardTitle style={{ marginBottom: designTokens.spacing[4] }}>
                Critical Activity Summary
              </CardTitle>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {logs
                  .filter(
                    (l) =>
                      l.impact.severity === "critical" ||
                      l.impact.severity === "high",
                  )
                  .slice(0, 5)
                  .map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "16px",
                        background: designTokens.colors.neutral[50],
                        borderRadius: designTokens.borderRadius.md,
                        borderLeft: `4px solid ${
                          log.impact.severity === "critical"
                            ? designTokens.colors.semantic.error[500]
                            : designTokens.colors.semantic.warning[500]
                        }`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{ fontWeight: "bold", marginBottom: "4px" }}
                        >
                          {log.agentName}: {log.action.type}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: designTokens.colors.neutral[600],
                          }}
                        >
                          {log.action.description}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "12px",
                            color: designTokens.colors.neutral[500],
                          }}
                        >
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color:
                              log.metadata.complianceStatus === "compliant"
                                ? designTokens.colors.semantic.success[600]
                                : designTokens.colors.semantic.error[600],
                          }}
                        >
                          {log.metadata.complianceStatus.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                {logs.filter(
                  (l) =>
                    l.impact.severity === "critical" ||
                    l.impact.severity === "high",
                ).length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: designTokens.colors.neutral[500],
                    }}
                  >
                    No high-severity issues detected in this period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {renderMetrics()}
          {renderFilters()}
          {renderAIInsights()}
          {renderLogs()}
        </>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}
