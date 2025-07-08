import { useState } from "react";
import { AgentType } from "./TradingAgentDashboard";
import "./TradeHistory.css";

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

export default function TradeHistory({ decisions, agentType, isLoading }: TradeHistoryProps) {
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");
  const [sortBy, setSortBy] = useState<"timestamp" | "confidence" | "price">("timestamp");

  const filteredDecisions = decisions
    .filter(decision => filter === "all" || decision.action === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case "timestamp":
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
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

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy": return "#10b981";
      case "sell": return "#ef4444";
      case "hold": return "#6b7280";
      default: return "#6b7280";
    }
  };

  if (isLoading) {
    return (
      <div className="trade-history loading">
        <div className="history-header">
          <h3>📋 Trade History</h3>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading trade history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trade-history">
      <div className="history-header">
        <h3>📋 {agentType === "recall" ? "Competition" : "Sentiment"} Trade History</h3>
        <div className="history-controls">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Actions</option>
            <option value="buy">Buy Orders</option>
            <option value="sell">Sell Orders</option>
            <option value="hold">Hold Decisions</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="timestamp">Sort by Time</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      {filteredDecisions.length === 0 ? (
        <div className="no-trades">
          <div className="no-trades-icon">📊</div>
          <h4>No trades found</h4>
          <p>
            {decisions.length === 0 
              ? `Start the ${agentType} agent to see trade history`
              : `No trades match the current filter`
            }
          </p>
        </div>
      ) : (
        <div className="trades-container">
          <div className="trades-summary">
            <div className="summary-stat">
              <span className="stat-label">Total Trades:</span>
              <span className="stat-value">{filteredDecisions.length}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Avg Confidence:</span>
              <span className="stat-value">
                {(filteredDecisions.reduce((sum, d) => sum + d.confidence, 0) / filteredDecisions.length * 100).toFixed(1)}%
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Actions:</span>
              <span className="stat-value">
                {filteredDecisions.filter(d => d.action !== "hold").length} executed
              </span>
            </div>
          </div>

          <div className="trades-list">
            {filteredDecisions.map((decision, index) => (
              <div key={index} className={`trade-item ${decision.action}`}>
                <div className="trade-header">
                  <div className="trade-action">
                    <span 
                      className="action-badge"
                      style={{ backgroundColor: getActionColor(decision.action) }}
                    >
                      {decision.action.toUpperCase()}
                    </span>
                    <span className="trade-symbol">{decision.symbol}</span>
                  </div>
                  <div className="trade-time">{formatTime(decision.timestamp)}</div>
                </div>

                <div className="trade-details">
                  <div className="detail-row">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">{decision.quantity}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Price:</span>
                    <span className="detail-value">${decision.price.toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Confidence:</span>
                    <span className="detail-value">
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill"
                          style={{ width: `${decision.confidence * 100}%` }}
                        ></div>
                        <span className="confidence-text">
                          {(decision.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Risk Score:</span>
                    <span className={`detail-value risk-${decision.riskScore > 70 ? 'high' : decision.riskScore > 40 ? 'medium' : 'low'}`}>
                      {decision.riskScore.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="trade-reasoning">
                  <span className="reasoning-label">Reasoning:</span>
                  <p className="reasoning-text">{decision.reasoning}</p>
                </div>

                {/* Vincent-specific sentiment data */}
                {agentType === "vincent" && decision.sentimentData && (
                  <div className="sentiment-data">
                    <span className="sentiment-label">Sentiment Analysis:</span>
                    <div className="sentiment-details">
                      <div className="sentiment-score">
                        <span className="sentiment-label">Score:</span>
                        <span className={`sentiment-value ${decision.sentimentData.sentiment > 0 ? 'positive' : 'negative'}`}>
                          {(decision.sentimentData.sentiment * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="sentiment-confidence">
                        <span className="sentiment-label">Confidence:</span>
                        <span className="sentiment-value">
                          {(decision.sentimentData.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="sentiment-sources">
                        <span className="sentiment-label">Sources:</span>
                        <span className="sentiment-value">
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
      )}
    </div>
  );
}
