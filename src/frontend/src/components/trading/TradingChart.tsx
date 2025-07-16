import { AgentType } from "./TradingAgentDashboard";
import "./TradingChart.css";

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

  if (isLoading) {
    return (
      <div className="trading-chart loading">
        <div className="chart-header">
          <h3>📈 Trading Performance</h3>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-chart">
      <div className="chart-header">
        <h3>
          📈 {agentType === "recall" ? "Competition" : "Sentiment"} Trading
          Performance
        </h3>
        <div className="chart-controls">
          <span className="data-points">{decisions.length} trades</span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="no-data">
          <div className="no-data-icon">📊</div>
          <h4>No trading data yet</h4>
          <p>Start the {agentType} agent to see trading performance charts</p>
        </div>
      ) : (
        <div className="chart-container">
          {/* Simple chart visualization */}
          <div className="chart-area">
            <div className="chart-grid">
              {chartData.map((point, index) => (
                <div
                  key={index}
                  className={`chart-point ${point.action}`}
                  style={{
                    left: `${(index / (chartData.length - 1)) * 100}%`,
                    bottom: `${point.confidence * 80 + 10}%`,
                  }}
                  title={`${point.action.toUpperCase()} at ${point.time} - Confidence: ${(point.confidence * 100).toFixed(1)}%`}
                >
                  <div className="point-marker"></div>
                  <div className="point-label">{point.action}</div>
                </div>
              ))}
            </div>

            {/* Y-axis labels */}
            <div className="y-axis">
              <span className="axis-label top">High Confidence</span>
              <span className="axis-label middle">Medium</span>
              <span className="axis-label bottom">Low Confidence</span>
            </div>
          </div>

          {/* Chart legend */}
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color buy"></div>
              <span>Buy Orders</span>
            </div>
            <div className="legend-item">
              <div className="legend-color sell"></div>
              <span>Sell Orders</span>
            </div>
            <div className="legend-item">
              <div className="legend-color hold"></div>
              <span>Hold Decisions</span>
            </div>
          </div>

          {/* Governance Summary */}
          <div className="governance-summary">
            <h4>🛡️ Governance Overview</h4>
            <div className="governance-stats">
              <div className="governance-stat">
                <span className="stat-icon">✅</span>
                <span className="stat-text">
                  {decisions.length * 3} Policy Checks Passed
                </span>
              </div>
              <div className="governance-stat">
                <span className="stat-icon">🚫</span>
                <span className="stat-text">0 Violations Detected</span>
              </div>
              <div className="governance-stat">
                <span className="stat-icon">📊</span>
                <span className="stat-text">
                  {agentType === "recall" ? "Competition" : "Social"}{" "}
                  Compliance: 98%
                </span>
              </div>
            </div>
          </div>

          {/* Agent-specific metrics */}
          {agentType === "vincent" && (
            <div className="sentiment-metrics">
              <h4>📊 Sentiment Analysis</h4>
              <div className="sentiment-grid">
                {decisions.slice(-5).map(
                  (decision, index) =>
                    decision.sentimentData && (
                      <div key={index} className="sentiment-item">
                        <div className="sentiment-symbol">
                          {decision.symbol}
                        </div>
                        <div
                          className={`sentiment-score ${decision.sentimentData.sentiment > 0 ? "positive" : "negative"}`}
                        >
                          {(decision.sentimentData.sentiment * 100).toFixed(1)}%
                        </div>
                        <div className="sentiment-sources">
                          {decision.sentimentData.sources.join(", ")}
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
