import { AgentType } from "./TradingAgentDashboard";
import { css } from "@emotion/react";
import { designTokens, shadowSystem } from "../../styles/design-system";

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

interface TradingChartProps {
  decisions: TradingDecision[];
  agentType: AgentType;
  isLoading: boolean;
}

export default function TradingChart({
  decisions,
  agentType,
  isLoading,
}: TradingChartProps) {
  const getChartData = () => {
    if (decisions.length === 0) return [];

    return decisions.slice(-20).map((decision, index) => ({
      time: new Date(decision.timestamp).toLocaleTimeString(),
      price: decision.price,
      action: decision.action,
      confidence: decision.confidence,
      sentiment: decision.sentimentData?.sentiment || 0,
    }));
  };

  const chartData = getChartData();

  const containerStyles = css`
    min-height: 300px;
    display: flex;
    flex-direction: column;
  `;

  const loadingStyles = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    color: ${designTokens.colors.neutral[600]};
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
    flex: 1;
    text-align: center;
    padding: ${designTokens.spacing[8]};
  `;

  const emptyIconStyles = css`
    font-size: 3rem;
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const chartAreaStyles = css`
    position: relative;
    height: 200px;
    background: linear-gradient(
      135deg,
      ${designTokens.colors.neutral[50]} 0%,
      ${designTokens.colors.neutral[100]} 100%
    );
    border-radius: ${designTokens.borderRadius.lg};
    margin-bottom: ${designTokens.spacing[4]};
    overflow: hidden;
  `;

  const chartGridStyles = css`
    position: relative;
    width: 100%;
    height: 100%;
    padding: ${designTokens.spacing[4]};
  `;

  const chartPointStyles = (
    action: string,
    index: number,
    total: number,
  ) => css`
    position: absolute;
    left: ${(index / Math.max(total - 1, 1)) * 100}%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      transform: translateX(-50%) scale(1.1);
    }
  `;

  const pointMarkerStyles = (action: string) => {
    const colors = {
      buy: designTokens.colors.semantic.success[500],
      sell: designTokens.colors.semantic.error[500],
      hold: designTokens.colors.neutral[500],
    };

    return css`
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${colors[action as keyof typeof colors]};
      border: 2px solid white;
      box-shadow: ${shadowSystem.sm};
      margin-bottom: ${designTokens.spacing[1]};
    `;
  };

  const pointLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.xs};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.neutral[700]};
    text-transform: uppercase;
    background: white;
    padding: 2px 6px;
    border-radius: ${designTokens.borderRadius.sm};
    box-shadow: ${shadowSystem.sm};
  `;

  const legendStyles = css`
    display: flex;
    justify-content: center;
    gap: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const legendItemStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
  `;

  const legendColorStyles = (action: string) => {
    const colors = {
      buy: designTokens.colors.semantic.success[500],
      sell: designTokens.colors.semantic.error[500],
      hold: designTokens.colors.neutral[500],
    };

    return css`
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${colors[action as keyof typeof colors]};
    `;
  };

  const summaryGridStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: ${designTokens.spacing[4]};
    margin-top: ${designTokens.spacing[4]};
  `;

  const summaryCardStyles = css`
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.md};
    padding: ${designTokens.spacing[3]};
    text-align: center;
  `;

  const summaryValueStyles = css`
    font-size: ${designTokens.typography.fontSize.lg};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.primary[600]};
    margin-bottom: ${designTokens.spacing[1]};
  `;

  const summaryLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
  `;

  if (isLoading) {
    return (
      <div css={containerStyles}>
        <div css={loadingStyles}>
          <div css={spinnerStyles}></div>
          <p>Loading trading data...</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div css={containerStyles}>
        <div css={emptyStateStyles}>
          <div css={emptyIconStyles}>📊</div>
          <h4
            css={css`
              margin: 0 0 ${designTokens.spacing[2]} 0;
              color: ${designTokens.colors.neutral[700]};
            `}
          >
            No trading data yet
          </h4>
          <p
            css={css`
              margin: 0;
              color: ${designTokens.colors.neutral[600]};
            `}
          >
            Start the {agentType} agent to see trading performance
          </p>
        </div>
      </div>
    );
  }

  const buyCount = chartData.filter((d) => d.action === "buy").length;
  const sellCount = chartData.filter((d) => d.action === "sell").length;
  const holdCount = chartData.filter((d) => d.action === "hold").length;
  const avgConfidence =
    chartData.reduce((sum, d) => sum + d.confidence, 0) / chartData.length;

  return (
    <div css={containerStyles}>
      {/* Chart Area */}
      <div css={chartAreaStyles}>
        <div css={chartGridStyles}>
          {chartData.map((point, index) => (
            <div
              key={index}
              css={chartPointStyles(point.action, index, chartData.length)}
              style={{
                bottom: `${point.confidence * 70 + 20}%`,
              }}
              title={`${point.action.toUpperCase()} at ${point.time} - Confidence: ${(point.confidence * 100).toFixed(1)}%`}
            >
              <div css={pointMarkerStyles(point.action)}></div>
              <div css={pointLabelStyles}>{point.action}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div css={legendStyles}>
        <div css={legendItemStyles}>
          <div css={legendColorStyles("buy")}></div>
          <span>Buy Orders</span>
        </div>
        <div css={legendItemStyles}>
          <div css={legendColorStyles("sell")}></div>
          <span>Sell Orders</span>
        </div>
        <div css={legendItemStyles}>
          <div css={legendColorStyles("hold")}></div>
          <span>Hold Decisions</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div css={summaryGridStyles}>
        <div css={summaryCardStyles}>
          <div css={summaryValueStyles}>{buyCount}</div>
          <div css={summaryLabelStyles}>Buy Orders</div>
        </div>
        <div css={summaryCardStyles}>
          <div css={summaryValueStyles}>{sellCount}</div>
          <div css={summaryLabelStyles}>Sell Orders</div>
        </div>
        <div css={summaryCardStyles}>
          <div css={summaryValueStyles}>{holdCount}</div>
          <div css={summaryLabelStyles}>Hold Decisions</div>
        </div>
        <div css={summaryCardStyles}>
          <div css={summaryValueStyles}>
            {(avgConfidence * 100).toFixed(0)}%
          </div>
          <div css={summaryLabelStyles}>Avg Confidence</div>
        </div>
      </div>

      {/* Agent-specific insights */}
      {agentType === "vincent" && chartData.some((d) => d.sentiment !== 0) && (
        <div
          css={css`
            margin-top: ${designTokens.spacing[4]};
            padding: ${designTokens.spacing[4]};
            background: ${designTokens.colors.secondary[50]};
            border-radius: ${designTokens.borderRadius.md};
          `}
        >
          <h4
            css={css`
              margin: 0 0 ${designTokens.spacing[3]} 0;
              color: ${designTokens.colors.secondary[700]};
            `}
          >
            💭 Sentiment Analysis
          </h4>
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: ${designTokens.spacing[3]};
            `}
          >
            {chartData.slice(-3).map(
              (decision, index) =>
                decision.sentiment !== 0 && (
                  <div
                    key={index}
                    css={css`
                      text-align: center;
                    `}
                  >
                    <div
                      css={css`
                        font-weight: ${designTokens.typography.fontWeight.bold};
                        color: ${decision.sentiment > 0
                          ? designTokens.colors.semantic.success[600]
                          : designTokens.colors.semantic.error[600]};
                      `}
                    >
                      {(decision.sentiment * 100).toFixed(0)}%
                    </div>
                    <div
                      css={css`
                        font-size: ${designTokens.typography.fontSize.sm};
                        color: ${designTokens.colors.neutral[600]};
                      `}
                    >
                      Sentiment
                    </div>
                  </div>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
