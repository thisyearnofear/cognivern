import { useState, useEffect, useMemo } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  shadowSystem,
  keyframeAnimations,
} from "../../styles/design-system";
import { AgentType, VincentStatus } from "../../types";
import { useAgentData, useTradingData } from "../../hooks/useAgentData";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import VincentConsentFlow from "./VincentConsentFlow";
import PolicyConfiguration from "./PolicyConfiguration";
import TradingChart from "./TradingChart";
import TradeHistory from "./TradeHistory";
import { agentApi } from "../../services/apiService";
import {
  agentComparisonSchema,
  defaultFilters,
  filterFieldDefinitions,
  type AgentComparisonFilters,
} from "../../lib/store/agentComparisonSchema";

export default function TradingAgentDashboard() {
  const [selectedAgentType, setSelectedAgentType] =
    useState<AgentType>("recall");
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonFilters, setComparisonFilters] =
    useState<AgentComparisonFilters>(defaultFilters);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    status: agentStatus,
    isLoading: agentLoading,
    error: agentError,
    startAgent,
    stopAgent,
  } = useAgentData(selectedAgentType);

  const {
    decisions: tradingDecisions,
    isLoading: tradingLoading,
    error: tradingError,
  } = useTradingData(selectedAgentType);

  const isLoading = agentLoading || tradingLoading;
  const error = agentError || tradingError;

  const [vincentStatus, setVincentStatus] = useState<VincentStatus>({
    isConnected: false,
    hasConsent: false,
    appId: "827",
    policies: {
      dailySpendingLimit: 500,
      allowedTokens: ["ETH", "USDC", "WBTC"],
      maxTradeSize: 200,
    },
    isConfigured: false,
  });

  const handleAgentTypeChange = (agentType: AgentType) => {
    setSelectedAgentType(agentType);
  };

  const handleVincentConsent = async (consent: boolean) => {
    if (consent) {
      setVincentStatus((prev) => ({
        ...prev,
        hasConsent: true,
        isConfigured: true,
      }));
    }
  };

  const handlePolicyUpdate = async (newPolicies: any) => {
    setVincentStatus((prev) => ({
      ...prev,
      policies: newPolicies,
    }));
  };

  // Fetch comparison data when comparison view is shown
  useEffect(() => {
    if (showComparison) {
      fetchComparisonData();
    }
  }, [showComparison, comparisonFilters]);

  const fetchComparisonData = async () => {
    setIsLoadingComparison(true);
    try {
      const response = await agentApi.compareAgents({
        agentTypes: comparisonFilters.agentTypes?.length
          ? comparisonFilters.agentTypes
          : undefined,
        ecosystems: comparisonFilters.ecosystems?.length
          ? comparisonFilters.ecosystems
          : undefined,
        status: comparisonFilters.status?.length
          ? comparisonFilters.status
          : undefined,
        sortBy: comparisonFilters.sortBy || "totalReturn",
        sortDirection: comparisonFilters.sortDirection || "desc",
      });

      if (response.success && response.data) {
        setComparisonData(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch comparison data:", error);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const updateFilter = <K extends keyof AgentComparisonFilters>(
    key: K,
    value: AgentComparisonFilters[K],
  ) => {
    setComparisonFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setComparisonFilters(defaultFilters);
  };

  // Filter comparison data based on local filters
  const filteredComparisonData = useMemo(() => {
    let filtered = [...comparisonData];

    // Apply search filter
    if (comparisonFilters.search) {
      const search = comparisonFilters.search.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.agentName?.toLowerCase().includes(search) ||
          agent.agentType?.toLowerCase().includes(search),
      );
    }

    // Apply range filters
    if (comparisonFilters.winRate) {
      const [min, max] = comparisonFilters.winRate;
      filtered = filtered.filter(
        (agent) => agent.winRate >= min && agent.winRate <= max,
      );
    }

    if (comparisonFilters.totalReturn) {
      const [min, max] = comparisonFilters.totalReturn;
      filtered = filtered.filter(
        (agent) => agent.totalReturn >= min && agent.totalReturn <= max,
      );
    }

    if (comparisonFilters.sharpeRatio) {
      const [min, max] = comparisonFilters.sharpeRatio;
      filtered = filtered.filter(
        (agent) => agent.sharpeRatio >= min && agent.sharpeRatio <= max,
      );
    }

    return filtered;
  }, [comparisonData, comparisonFilters]);

  const containerStyles = css`
    max-width: 1400px;
    margin: 0 auto;
    padding: ${designTokens.spacing[6]};
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  `;

  const headerStyles = css`
    text-align: center;
    margin-bottom: ${designTokens.spacing[8]};
    ${keyframeAnimations.fadeInUp}
  `;

  const titleStyles = css`
    font-size: ${designTokens.typography.fontSize["4xl"]};
    font-weight: ${designTokens.typography.fontWeight.bold};
    background: linear-gradient(135deg, #1e293b, #475569);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: ${designTokens.spacing[3]};
  `;

  const subtitleStyles = css`
    font-size: ${designTokens.typography.fontSize.lg};
    color: ${designTokens.colors.neutral[600]};
    max-width: 600px;
    margin: 0 auto;
  `;

  const agentSelectorStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[8]};
  `;

  const agentCardStyles = (isSelected: boolean) => css`
    position: relative;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid
      ${isSelected ? designTokens.colors.primary[500] : "transparent"};

    &:hover {
      transform: translateY(-2px);
      box-shadow: ${shadowSystem.lg};
    }

    ${isSelected &&
    css`
      box-shadow: ${shadowSystem.lg};
      background: linear-gradient(
        135deg,
        ${designTokens.colors.primary[50]} 0%,
        white 100%
      );
    `}
  `;

  const agentHeaderStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const agentIconStyles = css`
    font-size: 2rem;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${designTokens.colors.primary[100]};
    border-radius: ${designTokens.borderRadius.xl};
  `;

  const agentInfoStyles = css`
    flex: 1;
  `;

  const agentNameStyles = css`
    font-size: ${designTokens.typography.fontSize.xl};
    font-weight: ${designTokens.typography.fontWeight.bold};
    margin-bottom: ${designTokens.spacing[1]};
    color: ${designTokens.colors.neutral[900]};
  `;

  const agentDescStyles = css`
    color: ${designTokens.colors.neutral[600]};
    font-size: ${designTokens.typography.fontSize.sm};
  `;

  const statusBadgeStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[1]};
  `;

  const featuresGridStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: ${designTokens.spacing[3]};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const featureStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[2]};
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
  `;

  const statsRowStyles = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: ${designTokens.spacing[4]};
    border-top: 1px solid ${designTokens.colors.neutral[200]};
  `;

  const statStyles = css`
    text-align: center;
  `;

  const statValueStyles = css`
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.primary[600]};
    font-size: ${designTokens.typography.fontSize.lg};
  `;

  const statLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[500]};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `;

  const dashboardGridStyles = css`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${designTokens.spacing[6]};
    margin-bottom: ${designTokens.spacing[8]};

    @media (min-width: 1024px) {
      grid-template-columns: 1fr 1fr;
    }
  `;

  const errorStyles = css`
    background: ${designTokens.colors.semantic.error[50]};
    border: 1px solid ${designTokens.colors.semantic.error[200]};
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[6]};
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
  `;

  const getAgentStatus = (type: AgentType) => {
    if (type === "vincent" && !vincentStatus.hasConsent) {
      return { text: "Setup Required", variant: "warning" as const };
    }
    return agentStatus.isActive
      ? { text: "Active", variant: "success" as const }
      : { text: "Inactive", variant: "secondary" as const };
  };

  const canStartAgent =
    selectedAgentType === "recall" ||
    (selectedAgentType === "vincent" && vincentStatus.hasConsent);

  return (
    <div css={containerStyles}>
      {/* Header */}
      <div css={headerStyles}>
        <h1 css={titleStyles}>AI Trading Dashboard</h1>
        <p css={subtitleStyles}>
          Monitor and control your autonomous trading agents with real-time
          performance tracking
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div css={errorStyles}>
          <span
            css={css`
              font-size: 1.5rem;
            `}
          >
            ⚠️
          </span>
          <div>
            <h3
              css={css`
                margin: 0;
                color: ${designTokens.colors.semantic.error[700]};
              `}
            >
              Connection Error
            </h3>
            <p
              css={css`
                margin: 0;
                color: ${designTokens.colors.semantic.error[600]};
              `}
            >
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Agent Selection */}
      <div css={agentSelectorStyles}>
        {/* Recall Agent */}
        <Card
          css={agentCardStyles(selectedAgentType === "recall")}
          onClick={() => handleAgentTypeChange("recall")}
        >
          <CardContent>
            <div css={agentHeaderStyles}>
              <div css={agentIconStyles}>🏆</div>
              <div css={agentInfoStyles}>
                <h3 css={agentNameStyles}>Recall Trading Agent</h3>
                <p css={agentDescStyles}>
                  Competition-focused algorithmic trading
                </p>
              </div>
              <div css={statusBadgeStyles}>
                <Badge variant={getAgentStatus("recall").variant}>
                  {getAgentStatus("recall").text}
                </Badge>
              </div>
            </div>

            <div css={featuresGridStyles}>
              <div css={featureStyles}>
                <span>🎯</span>
                <span>Competition</span>
              </div>
              <div css={featureStyles}>
                <span>⚡</span>
                <span>High-Freq</span>
              </div>
              <div css={featureStyles}>
                <span>📊</span>
                <span>Real Data</span>
              </div>
            </div>

            <div css={statsRowStyles}>
              <div css={statStyles}>
                <div css={statValueStyles}>{agentStatus.tradesExecuted}</div>
                <div css={statLabelStyles}>Trades</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  {(agentStatus.performance.totalReturn * 100).toFixed(1)}%
                </div>
                <div css={statLabelStyles}>Return</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  {(agentStatus.performance.winRate * 100).toFixed(1)}%
                </div>
                <div css={statLabelStyles}>Win Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vincent Agent */}
        <Card
          css={agentCardStyles(selectedAgentType === "vincent")}
          onClick={() => handleAgentTypeChange("vincent")}
        >
          <CardContent>
            <div css={agentHeaderStyles}>
              <div css={agentIconStyles}>🧠</div>
              <div css={agentInfoStyles}>
                <h3 css={agentNameStyles}>Vincent Social Agent</h3>
                <p css={agentDescStyles}>Sentiment-driven social trading</p>
              </div>
              <div css={statusBadgeStyles}>
                <Badge variant={getAgentStatus("vincent").variant}>
                  {getAgentStatus("vincent").text}
                </Badge>
              </div>
            </div>

            <div css={featuresGridStyles}>
              <div css={featureStyles}>
                <span>💭</span>
                <span>Sentiment</span>
              </div>
              <div css={featureStyles}>
                <span>🛡️</span>
                <span>Policies</span>
              </div>
              <div css={featureStyles}>
                <span>🌐</span>
                <span>Multi-Chain</span>
              </div>
            </div>

            <div css={statsRowStyles}>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  ${vincentStatus.policies.dailySpendingLimit}
                </div>
                <div css={statLabelStyles}>Daily Limit</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  {vincentStatus.policies.allowedTokens.length}
                </div>
                <div css={statLabelStyles}>Tokens</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  ${vincentStatus.policies.maxTradeSize}
                </div>
                <div css={statLabelStyles}>Max Trade</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Comparison Toggle */}
      <div
        css={css`
          display: flex;
          justify-content: center;
          align-items: center;
          gap: ${designTokens.spacing[3]};
          margin-bottom: ${designTokens.spacing[6]};
        `}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowComparison(!showComparison)}
        >
          {showComparison ? "Hide" : "Show"} Agent Comparison
        </Button>
        {showComparison && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
        )}
      </div>

      {/* Enhanced Agent Comparison */}
      {showComparison && (
        <Card
          css={css`
            margin-bottom: ${designTokens.spacing[8]};
          `}
        >
          <CardHeader>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <div>
                <CardTitle>Agent Performance Comparison</CardTitle>
                <CardDescription>
                  Compare metrics across all agents and ecosystems
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters Section */}
            {showFilters && (
              <div
                css={css`
                  padding: ${designTokens.spacing[4]};
                  background: ${designTokens.colors.neutral[50]};
                  border-radius: ${designTokens.borderRadius.lg};
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                <h4
                  css={css`
                    margin: 0 0 ${designTokens.spacing[3]} 0;
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    text-transform: uppercase;
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  Filters
                </h4>

                <div
                  css={css`
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: ${designTokens.spacing[4]};
                  `}
                >
                  {/* Search */}
                  <div>
                    <label
                      css={css`
                        display: block;
                        margin-bottom: ${designTokens.spacing[2]};
                        font-size: ${designTokens.typography.fontSize.sm};
                        font-weight: ${designTokens.typography.fontWeight
                          .medium};
                      `}
                    >
                      Search
                    </label>
                    <input
                      type="text"
                      placeholder="Search agents..."
                      value={comparisonFilters.search || ""}
                      onChange={(e) =>
                        updateFilter("search", e.target.value || null)
                      }
                      css={css`
                        width: 100%;
                        padding: ${designTokens.spacing[2]};
                        border: 1px solid ${designTokens.colors.neutral[300]};
                        border-radius: ${designTokens.borderRadius.md};
                        font-size: ${designTokens.typography.fontSize.sm};
                      `}
                    />
                  </div>

                  {/* Agent Types */}
                  <div>
                    <label
                      css={css`
                        display: block;
                        margin-bottom: ${designTokens.spacing[2]};
                        font-size: ${designTokens.typography.fontSize.sm};
                        font-weight: ${designTokens.typography.fontWeight
                          .medium};
                      `}
                    >
                      Agent Types
                    </label>
                    <div
                      css={css`
                        display: flex;
                        flex-wrap: wrap;
                        gap: ${designTokens.spacing[2]};
                      `}
                    >
                      {["recall", "vincent", "sapience"].map((type) => (
                        <label
                          key={type}
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: ${designTokens.spacing[1]};
                            font-size: ${designTokens.typography.fontSize.sm};
                            cursor: pointer;
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={
                              comparisonFilters.agentTypes?.includes(
                                type as any,
                              ) || false
                            }
                            onChange={(e) => {
                              const current =
                                comparisonFilters.agentTypes || [];
                              const updated = e.target.checked
                                ? [...current, type as any]
                                : current.filter((t) => t !== type);
                              updateFilter("agentTypes", updated);
                            }}
                          />
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label
                      css={css`
                        display: block;
                        margin-bottom: ${designTokens.spacing[2]};
                        font-size: ${designTokens.typography.fontSize.sm};
                        font-weight: ${designTokens.typography.fontWeight
                          .medium};
                      `}
                    >
                      Status
                    </label>
                    <div
                      css={css`
                        display: flex;
                        flex-wrap: wrap;
                        gap: ${designTokens.spacing[2]};
                      `}
                    >
                      {["active", "inactive"].map((status) => (
                        <label
                          key={status}
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: ${designTokens.spacing[1]};
                            font-size: ${designTokens.typography.fontSize.sm};
                            cursor: pointer;
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={
                              comparisonFilters.status?.includes(
                                status as any,
                              ) || false
                            }
                            onChange={(e) => {
                              const current = comparisonFilters.status || [];
                              const updated = e.target.checked
                                ? [...current, status as any]
                                : current.filter((s) => s !== status);
                              updateFilter("status", updated);
                            }}
                          />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comparison Table */}
            {isLoadingComparison ? (
              <div
                css={css`
                  text-align: center;
                  padding: ${designTokens.spacing[8]};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                Loading comparison data...
              </div>
            ) : filteredComparisonData.length === 0 ? (
              <div
                css={css`
                  text-align: center;
                  padding: ${designTokens.spacing[8]};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                No agents found matching your filters
              </div>
            ) : (
              <div
                css={css`
                  overflow-x: auto;
                  border: 1px solid ${designTokens.colors.neutral[200]};
                  border-radius: ${designTokens.borderRadius.lg};
                `}
              >
                <table
                  css={css`
                    width: 100%;
                    border-collapse: collapse;
                    font-size: ${designTokens.typography.fontSize.sm};

                    th,
                    td {
                      padding: ${designTokens.spacing[3]};
                      text-align: left;
                      border-bottom: 1px solid
                        ${designTokens.colors.neutral[200]};
                    }

                    th {
                      background: ${designTokens.colors.neutral[50]};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                      color: ${designTokens.colors.neutral[700]};
                      position: sticky;
                      top: 0;
                      cursor: pointer;
                      user-select: none;

                      &:hover {
                        background: ${designTokens.colors.neutral[100]};
                      }
                    }

                    tbody tr:hover {
                      background: ${designTokens.colors.neutral[50]};
                    }

                    tbody tr:last-child td {
                      border-bottom: none;
                    }
                  `}
                >
                  <thead>
                    <tr>
                      <th onClick={() => updateFilter("sortBy", "agentName")}>
                        Agent{" "}
                        {comparisonFilters.sortBy === "agentName" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                      <th onClick={() => updateFilter("sortBy", "agentType")}>
                        Type{" "}
                        {comparisonFilters.sortBy === "agentType" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                      <th>Status</th>
                      <th onClick={() => updateFilter("sortBy", "totalTrades")}>
                        Trades{" "}
                        {comparisonFilters.sortBy === "totalTrades" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                      <th onClick={() => updateFilter("sortBy", "winRate")}>
                        Win Rate{" "}
                        {comparisonFilters.sortBy === "winRate" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                      <th onClick={() => updateFilter("sortBy", "totalReturn")}>
                        Return{" "}
                        {comparisonFilters.sortBy === "totalReturn" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                      <th onClick={() => updateFilter("sortBy", "sharpeRatio")}>
                        Sharpe{" "}
                        {comparisonFilters.sortBy === "sharpeRatio" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                      <th onClick={() => updateFilter("sortBy", "avgLatency")}>
                        Latency{" "}
                        {comparisonFilters.sortBy === "avgLatency" &&
                          (comparisonFilters.sortDirection === "asc"
                            ? "↑"
                            : "↓")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComparisonData.map((agent, idx) => (
                      <tr key={agent.agentId || idx}>
                        <td
                          css={css`
                            font-weight: ${designTokens.typography.fontWeight
                              .medium};
                          `}
                        >
                          {agent.agentName || "Unknown"}
                        </td>
                        <td>
                          <Badge variant="secondary" size="sm">
                            {agent.agentType || "N/A"}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              agent.status === "active"
                                ? "success"
                                : "secondary"
                            }
                            size="sm"
                          >
                            {agent.status || "unknown"}
                          </Badge>
                        </td>
                        <td>{agent.totalTrades || 0}</td>
                        <td
                          css={css`
                            color: ${(agent.winRate || 0) >= 50
                              ? designTokens.colors.semantic.success[600]
                              : designTokens.colors.neutral[600]};
                            font-weight: ${designTokens.typography.fontWeight
                              .medium};
                          `}
                        >
                          {((agent.winRate || 0) * 100).toFixed(1)}%
                        </td>
                        <td
                          css={css`
                            color: ${(agent.totalReturn || 0) >= 0
                              ? designTokens.colors.semantic.success[600]
                              : designTokens.colors.semantic.error[600]};
                            font-weight: ${designTokens.typography.fontWeight
                              .medium};
                          `}
                        >
                          {(agent.totalReturn || 0) >= 0 ? "+" : ""}
                          {((agent.totalReturn || 0) * 100).toFixed(2)}%
                        </td>
                        <td>{(agent.sharpeRatio || 0).toFixed(2)}</td>
                        <td>
                          {agent.avgLatency ? `${agent.avgLatency}ms` : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Stats */}
            {filteredComparisonData.length > 0 && (
              <div
                css={css`
                  margin-top: ${designTokens.spacing[4]};
                  padding: ${designTokens.spacing[4]};
                  background: ${designTokens.colors.primary[50]};
                  border-radius: ${designTokens.borderRadius.lg};
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                  gap: ${designTokens.spacing[4]};
                `}
              >
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize["2xl"]};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {filteredComparisonData.length}
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Total Agents
                  </div>
                </div>
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize["2xl"]};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {(
                      (filteredComparisonData.reduce(
                        (sum, a) => sum + (a.winRate || 0),
                        0,
                      ) /
                        filteredComparisonData.length) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Avg Win Rate
                  </div>
                </div>
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize["2xl"]};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {(
                      (filteredComparisonData.reduce(
                        (sum, a) => sum + (a.totalReturn || 0),
                        0,
                      ) /
                        filteredComparisonData.length) *
                      100
                    ).toFixed(2)}
                    %
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Avg Return
                  </div>
                </div>
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize["2xl"]};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {filteredComparisonData.reduce(
                      (sum, a) => sum + (a.totalTrades || 0),
                      0,
                    )}
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Total Trades
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vincent Setup */}
      {selectedAgentType === "vincent" && !vincentStatus.hasConsent && (
        <Card
          css={css`
            margin-bottom: ${designTokens.spacing[6]};
          `}
        >
          <CardHeader>
            <CardTitle>🔐 Vincent Agent Setup</CardTitle>
            <CardDescription>
              Configure consent and policies for your Vincent social trading
              agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VincentConsentFlow
              appId={vincentStatus.appId}
              onConsent={handleVincentConsent}
            />
          </CardContent>
        </Card>
      )}

      {/* Vincent Policy Configuration */}
      {selectedAgentType === "vincent" && vincentStatus.hasConsent && (
        <Card
          css={css`
            margin-bottom: ${designTokens.spacing[6]};
          `}
        >
          <CardHeader>
            <CardTitle>⚙️ Policy Configuration</CardTitle>
            <CardDescription>
              Manage trading policies and risk parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyConfiguration
              policies={vincentStatus.policies}
              onUpdate={handlePolicyUpdate}
            />
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard */}
      <div css={dashboardGridStyles}>
        {/* Agent Control & Stats */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedAgentType === "recall"
                ? "🏆 Recall Agent"
                : "🧠 Vincent Agent"}{" "}
              Control
            </CardTitle>
            <CardDescription>
              Real-time status and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Control Buttons */}
            <div
              css={css`
                display: flex;
                gap: ${designTokens.spacing[3]};
                margin-bottom: ${designTokens.spacing[6]};
              `}
            >
              {!agentStatus.isActive ? (
                <Button
                  variant="primary"
                  onClick={startAgent}
                  disabled={isLoading || !canStartAgent}
                  css={css`
                    flex: 1;
                  `}
                >
                  {isLoading ? "Starting..." : "▶️ Start Agent"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={stopAgent}
                  disabled={isLoading}
                  css={css`
                    flex: 1;
                  `}
                >
                  {isLoading ? "Stopping..." : "⏹️ Stop Agent"}
                </Button>
              )}
            </div>

            {/* Status Grid */}
            <div
              css={css`
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: ${designTokens.spacing[4]};
              `}
            >
              <div
                css={css`
                  text-align: center;
                `}
              >
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize["2xl"]};
                    font-weight: ${designTokens.typography.fontWeight.bold};
                    color: ${agentStatus.isActive
                      ? designTokens.colors.semantic.success[600]
                      : designTokens.colors.neutral[500]};
                  `}
                >
                  {agentStatus.isActive ? "●" : "○"}
                </div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  {agentStatus.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              <div
                css={css`
                  text-align: center;
                `}
              >
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize["2xl"]};
                    font-weight: ${designTokens.typography.fontWeight.bold};
                    color: ${designTokens.colors.primary[600]};
                  `}
                >
                  {agentStatus.tradesExecuted}
                </div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  Trades
                </div>
              </div>

              <div
                css={css`
                  text-align: center;
                `}
              >
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize["2xl"]};
                    font-weight: ${designTokens.typography.fontWeight.bold};
                    color: ${agentStatus.performance.totalReturn >= 0
                      ? designTokens.colors.semantic.success[600]
                      : designTokens.colors.semantic.error[600]};
                  `}
                >
                  {agentStatus.performance.totalReturn >= 0 ? "+" : ""}
                  {(agentStatus.performance.totalReturn * 100).toFixed(1)}%
                </div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  Return
                </div>
              </div>

              <div
                css={css`
                  text-align: center;
                `}
              >
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize["2xl"]};
                    font-weight: ${designTokens.typography.fontWeight.bold};
                    color: ${designTokens.colors.primary[600]};
                  `}
                >
                  {(agentStatus.performance.winRate * 100).toFixed(0)}%
                </div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  Win Rate
                </div>
              </div>
            </div>

            {/* Warning for Vincent */}
            {selectedAgentType === "vincent" && !vincentStatus.hasConsent && (
              <div
                css={css`
                  margin-top: ${designTokens.spacing[4]};
                  padding: ${designTokens.spacing[3]};
                  background: ${designTokens.colors.semantic.warning[50]};
                  border: 1px solid ${designTokens.colors.semantic.warning[200]};
                  border-radius: ${designTokens.borderRadius.md};
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                <span>⚠️</span>
                <span
                  css={css`
                    color: ${designTokens.colors.semantic.warning[700]};
                  `}
                >
                  Vincent consent required before starting
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trading Chart */}
        <Card>
          <CardHeader>
            <CardTitle>📈 Performance Chart</CardTitle>
            <CardDescription>
              Trading decisions and market analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TradingChart
              decisions={tradingDecisions}
              agentType={selectedAgentType}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Trading History</CardTitle>
          <CardDescription>
            Complete record of all trading decisions and executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TradeHistory
            decisions={tradingDecisions}
            agentType={selectedAgentType}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
