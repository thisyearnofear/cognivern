import { AgentType } from "./TradingAgentDashboard";
import { css } from '@emotion/react';
import { designTokens, tradingStyles } from '../../styles/designTokens';

interface AgentStatus {
  isActive: boolean;
  lastUpdate: string;
  tradesExecuted: number;
  performance: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
  };
}

interface VincentStatus {
  isConnected: boolean;
  hasConsent: boolean;
  appId: string;
  delegateeAddress?: string;
  policies: {
    dailySpendingLimit: number;
    allowedTokens: string[];
    maxTradeSize: number;
  };
}

interface AgentTypeSelectorProps {
  selectedType: AgentType;
  onTypeChange: (type: AgentType) => void;
  recallStatus: AgentStatus;
  vincentStatus: VincentStatus;
}

export default function AgentTypeSelector({
  selectedType,
  onTypeChange,
  recallStatus,
  vincentStatus,
}: AgentTypeSelectorProps) {
  const getStatusColor = (isActive: boolean, hasConsent?: boolean) => {
    if (hasConsent === false) return "warning";
    return isActive ? "active" : "inactive";
  };

  const getStatusText = (type: AgentType) => {
    if (type === "recall") {
      return recallStatus.isActive ? "Active" : "Inactive";
    } else {
      if (!vincentStatus.hasConsent) return "Needs Consent";
      return recallStatus.isActive ? "Active" : "Inactive";
    }
  };

  return (
    <div className="agent-type-selector">
      <h3>Select Trading Agent</h3>
      <div className="agent-cards">
        {/* Recall Agent Card */}
        <div
          className={`agent-card ${selectedType === "recall" ? "selected" : ""}`}
          onClick={() => onTypeChange("recall")}
        >
          <div className="agent-header">
            <div className="agent-icon">🏆</div>
            <div className="agent-info">
              <h4>Recall Trading Agent</h4>
              <p>Competition-focused trading with Recall Network</p>
            </div>
            <div className={`status-indicator ${getStatusColor(recallStatus.isActive)}`}>
              <span className="status-dot"></span>
              <span className="status-text">{getStatusText("recall")}</span>
            </div>
          </div>
          
          <div className="agent-features">
            <div className="feature">
              <span className="feature-icon">🎯</span>
              <span>Competition Trading</span>
            </div>
            <div className="feature">
              <span className="feature-icon">⚡</span>
              <span>High-Frequency Execution</span>
            </div>
            <div className="feature">
              <span className="feature-icon">📊</span>
              <span>Real Market Data</span>
            </div>
          </div>

          <div className="agent-stats">
            <div className="stat">
              <span className="stat-label">Trades</span>
              <span className="stat-value">{recallStatus.tradesExecuted}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Return</span>
              <span className="stat-value">
                {(recallStatus.performance.totalReturn * 100).toFixed(1)}%
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value">
                {(recallStatus.performance.winRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Vincent Agent Card */}
        <div
          className={`agent-card ${selectedType === "vincent" ? "selected" : ""}`}
          onClick={() => onTypeChange("vincent")}
        >
          <div className="agent-header">
            <div className="agent-icon">🧠</div>
            <div className="agent-info">
              <h4>Vincent Social Trading Agent</h4>
              <p>Sentiment-driven trading with community governance</p>
            </div>
            <div className={`status-indicator ${getStatusColor(recallStatus.isActive, vincentStatus.hasConsent)}`}>
              <span className="status-dot"></span>
              <span className="status-text">{getStatusText("vincent")}</span>
            </div>
          </div>
          
          <div className="agent-features">
            <div className="feature">
              <span className="feature-icon">💭</span>
              <span>Sentiment Analysis</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🛡️</span>
              <span>User-Controlled Policies</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🌐</span>
              <span>Multi-Chain Support</span>
            </div>
          </div>

          <div className="agent-stats">
            <div className="stat">
              <span className="stat-label">Daily Limit</span>
              <span className="stat-value">${vincentStatus.policies.dailySpendingLimit}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Tokens</span>
              <span className="stat-value">{vincentStatus.policies.allowedTokens.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Max Trade</span>
              <span className="stat-value">${vincentStatus.policies.maxTradeSize}</span>
            </div>
          </div>

          {!vincentStatus.hasConsent && (
            <div className="consent-required">
              <span className="consent-icon">🔐</span>
              <span>Consent Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Agent Comparison */}
      <div className="agent-comparison">
        <h4>Agent Comparison</h4>
        <div className="comparison-table">
          <div className="comparison-row header">
            <div className="comparison-cell">Feature</div>
            <div className="comparison-cell">Recall Agent</div>
            <div className="comparison-cell">Vincent Agent</div>
          </div>
          <div className="comparison-row">
            <div className="comparison-cell">Trading Style</div>
            <div className="comparison-cell">Competition-focused</div>
            <div className="comparison-cell">Sentiment-driven</div>
          </div>
          <div className="comparison-row">
            <div className="comparison-cell">Data Sources</div>
            <div className="comparison-cell">Market data, Technical analysis</div>
            <div className="comparison-cell">Social media, News, Sentiment</div>
          </div>
          <div className="comparison-row">
            <div className="comparison-cell">Governance</div>
            <div className="comparison-cell">Platform policies</div>
            <div className="comparison-cell">User-defined policies</div>
          </div>
          <div className="comparison-row">
            <div className="comparison-cell">Execution</div>
            <div className="comparison-cell">Recall API</div>
            <div className="comparison-cell">Vincent Framework + Lit Protocol</div>
          </div>
        </div>
      </div>
    </div>
  );
}
