import { useState } from "react";
import { AgentType } from "./TradingAgentDashboard";
import { css } from "@emotion/react";
import { designTokens, shadowSystem } from "../../styles/design-system";
import { Badge } from "../ui/Badge";

interface TradingDecision {
  action: "buy" | "sell" | "hold";
  symbol: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
  agentType: AgentType;
  sentimentData?: {
    sentiment: number;
    confidence: number;
    sources: string[];
  };
}

interface TradeHistoryProps {
  decisions: TradingDecision[];
  agentType: AgentType;
  isLoading: boolean;
}

export default function TradeHistory({
  decisions,
  agentType,
  isLoading,
}: TradeHistoryProps) {
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");
  const [sortBy, setSortBy] = useState<"timestamp" | "confidence" | "price">(
    "timestamp",
  );

  const filteredDecisions = decisions
    .filter((decision) => filter === "all" || decision.action === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case "timestamp":
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        case "confidence":
          return b.confidence - a.confidence;
        case "price":
          return b.price - a.price;
        default:
          return 0;
      }
    });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionVariant = (action: string) => {
    switch (action) {
      case "buy":
        return "success" as const;
      case "sell":
        return "error" as const;
      case "hold":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  const getGovernanceStatus = (decision: TradingDecision) => {
    const hasHighConfidence = decision.confidence > 0.7;
    const isReasonableRisk = decision.riskScore < 0.8;
    const isReasonableSize = decision.quantity * decision.price < 1000;

    const checks = [
      { name: "Confidence Threshold", passed: hasHighConfidence },
      { name: "Risk Limit", passed: isReasonableRisk },
      { name: "Position Size", passed: isReasonableSize },
    ];

    const passedChecks = checks.filter((c) => c.passed).length;
    return {
      checks,
      score: Math.round((passedChecks / checks.length) * 100),
      status: passedChecks === checks.length ? "approved" : "flagged",
    };
  };

  const containerStyles = css`
    min-height: 300px;
  `;

  const headerStyles = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${designTokens.spacing[6]};
    flex-wrap: wrap;
    gap: ${designTokens.spacing[4]};
  `;

  const controlsStyles = css`
    display: flex;
    gap: ${designTokens.spacing[3]};
    flex-wrap: wrap;
  `;

  const selectStyles = css`
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    border: 1px solid ${designTokens.colors.neutral[300]};
    border-radius: ${designTokens.borderRadius.md};
    background: white;
    font-size: ${designTokens.typography.fontSize.sm};
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: ${designTokens.colors.primary[500]};
      box-shadow: 0 0 0 3px ${designTokens.colors.primary[100]};
    }
  `;

  const loadingStyles = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${designTokens.spacing[12]};
    text-align: center;
  `;

  const spinnerStyles = css`
    width: 40px;
    height: 40px;
    border: 3px solid ${designTokens.colors.neutral[200]};
    border-top: 3px solid ${designTokens.colors.primary[500]};
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: ${designTokens.spacing[4]};

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  `;

  const emptyStateStyles = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${designTokens.spacing[12]};
    text-align: center;
  `;

  const summaryStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[6]};
    padding: ${designTokens.spacing[4]};
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.lg};
  `;

  const summaryStatStyles = css`
    text-align: center;
  `;

  const statLabelStyles = css`
    display: block;
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    margin-bottom: ${designTokens.spacing[1]};
  `;

  const statValueStyles = css`
    font-size: ${designTokens.typography.fontSize.lg};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.primary[600]};
  `;

  const tradeListStyles = css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[4]};
  `;

  const tradeItemStyles = css`
    background: white;
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[5]};
    box-shadow: ${shadowSystem.sm};
    border: 1px solid ${designTokens.colors.neutral[200]};
    transition: all 0.2s ease;

    &:hover {
      box-shadow: ${shadowSystem.md};
      transform: translateY(-1px);
    }
  `;

  const tradeHeaderStyles = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const tradeActionStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
  `;

  const tradeSymbolStyles = css`
    font-size: ${designTokens.typography.fontSize.lg};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.neutral[900]};
  `;

  const tradeTimeStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[500]};
  `;

  const detailsGridStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const detailItemStyles = css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[1]};
  `;

  const detailLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    font-weight: ${designTokens.typography.fontWeight.medium};
  `;

  const detailValueStyles = css`
    font-size: ${designTokens.typography.fontSize.base};
    color: ${designTokens.colors.neutral[900]};
    font-weight: ${designTokens.typography.fontWeight.semibold};
  `;

  const confidenceBarStyles = css`
    position: relative;
    height: 20px;
    background: ${designTokens.colors.neutral[200]};
    border-radius: ${designTokens.borderRadius.full};
    overflow: hidden;
  `;

  const confidenceFillStyles = (confidence: number) => css`
    height: 100%;
    background: linear-gradient(
      90deg,
      ${designTokens.colors.primary[400]},
      ${designTokens.colors.primary[600]}
    );
    width: ${confidence * 100}%;
    transition: width 0.3s ease;
  `;

  const confidenceTextStyles = css`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: ${designTokens.typography.fontSize.xs};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  `;

  const reasoningStyles = css`
    margin-bottom: ${designTokens.spacing[4]};
    padding: ${designTokens.spacing[3]};
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.md};
    border-left: 4px solid ${designTokens.colors.primary[500]};
  `;

  const reasoningLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[700]};
    margin-bottom: ${designTokens.spacing[2]};
  `;

  const reasoningTextStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    line-height: ${designTokens.typography.lineHeight.relaxed};
    margin: 0;
  `;

  const governanceStyles = css`
    padding: ${designTokens.spacing[3]};
    background: ${designTokens.colors.primary[50]};
    border-radius: ${designTokens.borderRadius.md};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const governanceHeaderStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    margin-bottom: ${designTokens.spacing[3]};
  `;

  const governanceChecksStyles = css`
    display: flex;
    flex-wrap: wrap;
    gap: ${designTokens.spacing[2]};
  `;

  const checkItemStyles = (passed: boolean) => css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[1]};
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${passed
      ? designTokens.colors.semantic.success[700]
      : designTokens.colors.semantic.error[700]};
  `;

  const sentimentStyles = css`
    padding: ${designTokens.spacing[3]};
    background: ${designTokens.colors.secondary[50]};
    border-radius: ${designTokens.borderRadius.md};
  `;

  const sentimentHeaderStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.secondary[700]};
    margin-bottom: ${designTokens.spacing[3]};
  `;

  const sentimentGridStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: ${designTokens.spacing[3]};
  `;

  if (isLoading) {
    return (
      <div css={containerStyles}>
        <div css={loadingStyles}>
          <div css={spinnerStyles}></div>
          <p>Loading trade history...</p>
        </div>
      </div>
    );
  }

  if (filteredDecisions.length === 0) {
    return (
      <div css={containerStyles}>
        <div css={headerStyles}>
          <h3>📋 Trade History</h3>
          <div css={controlsStyles}>
            <select
              css={selectStyles}
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All Actions</option>
              <option value="buy">Buy Orders</option>
              <option value="sell">Sell Orders</option>
              <option value="hold">Hold Decisions</option>
            </select>
            <select
              css={selectStyles}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="timestamp">Sort by Time</option>
              <option value="confidence">Sort by Confidence</option>
              <option value="price">Sort by Price</option>
            </select>
          </div>
        </div>

        <div css={emptyStateStyles}>
          <div
            css={css`
              font-size: 3rem;
              margin-bottom: ${designTokens.spacing[4]};
            `}
          >
            📊
          </div>
          <h4
            css={css`
              margin: 0 0 ${designTokens.spacing[2]} 0;
              color: ${designTokens.colors.neutral[700]};
            `}
          >
            No trades found
          </h4>
          <p
            css={css`
              margin: 0;
              color: ${designTokens.colors.neutral[600]};
            `}
          >
            {decisions.length === 0
              ? `Start the ${agentType} agent to see trade history`
              : `No trades match the current filter`}
          </p>
        </div>
      </div>
    );
  }

  const avgConfidence =
    filteredDecisions.reduce((sum, d) => sum + d.confidence, 0) /
    filteredDecisions.length;
  const executedTrades = filteredDecisions.filter(
    (d) => d.action !== "hold",
  ).length;

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <h3>📋 Trade History</h3>
        <div css={controlsStyles}>
          <select
            css={selectStyles}
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Actions</option>
            <option value="buy">Buy Orders</option>
            <option value="sell">Sell Orders</option>
            <option value="hold">Hold Decisions</option>
          </select>
          <select
            css={selectStyles}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="timestamp">Sort by Time</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div css={summaryStyles}>
        <div css={summaryStatStyles}>
          <span css={statLabelStyles}>Total Trades</span>
          <span css={statValueStyles}>{filteredDecisions.length}</span>
        </div>
        <div css={summaryStatStyles}>
          <span css={statLabelStyles}>Avg Confidence</span>
          <span css={statValueStyles}>{(avgConfidence * 100).toFixed(1)}%</span>
        </div>
        <div css={summaryStatStyles}>
          <span css={statLabelStyles}>Executed</span>
          <span css={statValueStyles}>{executedTrades}</span>
        </div>
      </div>

      {/* Trade List */}
      <div css={tradeListStyles}>
        {filteredDecisions.map((decision, index) => (
          <div key={index} css={tradeItemStyles}>
            {/* Trade Header */}
            <div css={tradeHeaderStyles}>
              <div css={tradeActionStyles}>
                <Badge variant={getActionVariant(decision.action)}>
                  {decision.action.toUpperCase()}
                </Badge>
                <span css={tradeSymbolStyles}>{decision.symbol}</span>
              </div>
              <span css={tradeTimeStyles}>
                {formatTime(decision.timestamp)}
              </span>
            </div>

            {/* Trade Details */}
            <div css={detailsGridStyles}>
              <div css={detailItemStyles}>
                <span css={detailLabelStyles}>Quantity</span>
                <span css={detailValueStyles}>{decision.quantity}</span>
              </div>
              <div css={detailItemStyles}>
                <span css={detailLabelStyles}>Price</span>
                <span css={detailValueStyles}>
                  ${decision.price.toFixed(2)}
                </span>
              </div>
              <div css={detailItemStyles}>
                <span css={detailLabelStyles}>Confidence</span>
                <div css={confidenceBarStyles}>
                  <div css={confidenceFillStyles(decision.confidence)}></div>
                  <span css={confidenceTextStyles}>
                    {(decision.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div css={detailItemStyles}>
                <span css={detailLabelStyles}>Risk Score</span>
                <span
                  css={[
                    detailValueStyles,
                    css`
                      color: ${decision.riskScore > 0.7
                        ? designTokens.colors.semantic.error[600]
                        : decision.riskScore > 0.4
                          ? designTokens.colors.semantic.warning[600]
                          : designTokens.colors.semantic.success[600]};
                    `,
                  ]}
                >
                  {(decision.riskScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Reasoning */}
            <div css={reasoningStyles}>
              <div css={reasoningLabelStyles}>💭 Reasoning</div>
              <p css={reasoningTextStyles}>{decision.reasoning}</p>
            </div>

            {/* Governance Status */}
            <div css={governanceStyles}>
              <div css={governanceHeaderStyles}>
                <span>🛡️ Governance</span>
                {(() => {
                  const governance = getGovernanceStatus(decision);
                  return (
                    <>
                      <Badge
                        variant={
                          governance.status === "approved"
                            ? "success"
                            : "warning"
                        }
                      >
                        {governance.status === "approved"
                          ? "✅ Approved"
                          : "⚠️ Flagged"}
                      </Badge>
                      <span
                        css={css`
                          font-size: ${designTokens.typography.fontSize.sm};
                          color: ${designTokens.colors.neutral[600]};
                        `}
                      >
                        {governance.score}% compliance
                      </span>
                    </>
                  );
                })()}
              </div>
              <div css={governanceChecksStyles}>
                {getGovernanceStatus(decision).checks.map((check, i) => (
                  <span key={i} css={checkItemStyles(check.passed)}>
                    {check.passed ? "✓" : "✗"} {check.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Vincent Sentiment Data */}
            {agentType === "vincent" && decision.sentimentData && (
              <div css={sentimentStyles}>
                <div css={sentimentHeaderStyles}>💭 Sentiment Analysis</div>
                <div css={sentimentGridStyles}>
                  <div css={detailItemStyles}>
                    <span css={detailLabelStyles}>Score</span>
                    <span
                      css={[
                        detailValueStyles,
                        css`
                          color: ${decision.sentimentData.sentiment > 0
                            ? designTokens.colors.semantic.success[600]
                            : designTokens.colors.semantic.error[600]};
                        `,
                      ]}
                    >
                      {(decision.sentimentData.sentiment * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div css={detailItemStyles}>
                    <span css={detailLabelStyles}>Confidence</span>
                    <span css={detailValueStyles}>
                      {(decision.sentimentData.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div css={detailItemStyles}>
                    <span css={detailLabelStyles}>Sources</span>
                    <span
                      css={css`
                        font-size: ${designTokens.typography.fontSize.sm};
                        color: ${designTokens.colors.neutral[600]};
                      `}
                    >
                      {decision.sentimentData.sources.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
