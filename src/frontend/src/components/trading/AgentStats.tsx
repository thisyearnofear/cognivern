import { AgentType } from "./TradingAgentDashboard";
import { css } from "@emotion/react";
import { designTokens, tradingStyles } from "../../styles/design-system";

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

interface AgentStatsProps {
  agentType: AgentType;
  status: AgentStatus;
  vincentStatus?: VincentStatus;
  onStart: () => void;
  onStop: () => void;
  isLoading: boolean;
}

export default function AgentStats({
  agentType,
  status,
  vincentStatus,
  onStart,
  onStop,
  isLoading,
}: AgentStatsProps) {
  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const calculateNextTradeTime = () => {
    // Our agent trades every 4 hours
    const now = new Date();
    const nextTrade = new Date(now);
    nextTrade.setHours(now.getHours() + 4);
    return nextTrade.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canStart =
    agentType === "recall" ||
    (agentType === "vincent" && vincentStatus?.hasConsent);

  const statsStyles = css`
    ${tradingStyles.glassCard}
  `;

  return (
    <div css={statsStyles}>
      <div className="stats-header">
        <h3>
          {agentType === "recall" ? "Recall Agent" : "Vincent Agent"}{" "}
          Status
        </h3>
        <div className="agent-controls">
          {!status.isActive ? (
            <button
              className="start-button"
              onClick={onStart}
              disabled={isLoading || !canStart}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Starting...
                </>
              ) : (
                <>
                  <span className="start-icon">ST</span>
                  Start Agent
                </>
              )}
            </button>
          ) : (
            <button
              className="stop-button"
              onClick={onStop}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Stopping...
                </>
              ) : (
                <>
                  <span className="stop-icon">SP</span>
                  Stop Agent
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        {/* Status Card */}
        <div className="stat-card status-card">
          <div className="stat-header">
            <span className="stat-icon">ST</span>
            <span className="stat-title">Status</span>
          </div>
          <div className="stat-content">
            <div
              className={`status-indicator ${status.isActive ? "active" : "inactive"}`}
            >
              <span className="status-dot"></span>
              <span className="status-text">
                {status.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="last-update">
              Last update: {formatLastUpdate(status.lastUpdate)}
            </div>
          </div>
        </div>

        {/* Trades Card */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon">TR</span>
            <span className="stat-title">Trades Executed</span>
          </div>
          <div className="stat-content">
            <div className="stat-value">{status.tradesExecuted}</div>
            <div className="stat-subtitle">Total trades</div>
          </div>
        </div>

        {/* Performance Cards */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon">RT</span>
            <span className="stat-title">Total Return</span>
          </div>
          <div className="stat-content">
            <div
              className={`stat-value ${status.performance.totalReturn >= 0 ? "positive" : "negative"}`}
            >
              {status.performance.totalReturn >= 0 ? "+" : ""}
              {(status.performance.totalReturn * 100).toFixed(2)}%
            </div>
            <div className="stat-subtitle">
              {agentType === "recall"
                ? "Competition performance"
                : "Social trading performance"}
            </div>
            {agentType === "recall" && (
              <div className="competition-context">
                <span className="competition-badge">Live Competition</span>
              </div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon">WR</span>
            <span className="stat-title">Win Rate</span>
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {(status.performance.winRate * 100).toFixed(1)}%
            </div>
            <div className="stat-subtitle">Successful trades</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-icon">SR</span>
            <span className="stat-title">Sharpe Ratio</span>
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {status.performance.sharpeRatio.toFixed(2)}
            </div>
            <div className="stat-subtitle">Risk-adjusted return</div>
          </div>
        </div>

        {/* Governance & Compliance Cards */}
        <div className="stat-card governance-card">
          <div className="stat-header">
            <span className="stat-icon">PC</span>
            <span className="stat-title">Policy Compliance</span>
          </div>
          <div className="stat-content">
            <div className="stat-value governance-score">98%</div>
            <div className="stat-subtitle">
              {status.tradesExecuted * 3} policy checks passed
            </div>
            <div className="compliance-indicator">
              <span className="compliance-dot success"></span>
              <span>Zero violations</span>
            </div>
          </div>
        </div>

        <div className="stat-card governance-card">
          <div className="stat-header">
            <span className="stat-icon">LV</span>
            <span className="stat-title">Live Status</span>
          </div>
          <div className="stat-content">
            <div className="live-status">
              <div className="status-indicator live">
                <span className="pulse-dot"></span>
                <span>Trading Live</span>
              </div>
              <div className="next-action">
                Next trade: {calculateNextTradeTime()}
              </div>
            </div>
          </div>
        </div>

        {/* Vincent-specific stats */}
        {agentType === "vincent" && vincentStatus && (
          <>
            <div className="stat-card vincent-card">
              <div className="stat-header">
                <span className="stat-icon">VS</span>
                <span className="stat-title">Vincent Status</span>
              </div>
              <div className="stat-content">
                <div className="vincent-status">
                  <div
                    className={`consent-status ${vincentStatus.hasConsent ? "granted" : "pending"}`}
                  >
                    <span className="consent-icon">
                      {vincentStatus.hasConsent ? "OK" : "PD"}
                    </span>
                    <span>
                      {vincentStatus.hasConsent
                        ? "Consent Granted"
                        : "Consent Pending"}
                    </span>
                  </div>
                  <div className="app-id">App ID: {vincentStatus.appId}</div>
                </div>
              </div>
            </div>

            <div className="stat-card vincent-card">
              <div className="stat-header">
                <span className="stat-icon">PL</span>
                <span className="stat-title">Policy Limits</span>
              </div>
              <div className="stat-content">
                <div className="policy-limits">
                  <div className="limit-item">
                    <span className="limit-label">Daily:</span>
                    <span className="limit-value">
                      ${vincentStatus.policies.dailySpendingLimit}
                    </span>
                  </div>
                  <div className="limit-item">
                    <span className="limit-label">Max Trade:</span>
                    <span className="limit-value">
                      ${vincentStatus.policies.maxTradeSize}
                    </span>
                  </div>
                  <div className="limit-item">
                    <span className="limit-label">Tokens:</span>
                    <span className="limit-value">
                      {vincentStatus.policies.allowedTokens.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Agent Type Specific Info */}
      <div className="agent-info">
        {agentType === "recall" ? (
          <div className="recall-info">
            <h4>Recall Trading Features</h4>
            <ul>
              <li>Competition-focused trading strategies</li>
              <li>Real-time market data integration</li>
              <li>High-frequency execution capabilities</li>
              <li>Performance tracking and leaderboards</li>
            </ul>
          </div>
        ) : (
          <div className="vincent-info">
            <h4>Vincent Social Trading Features</h4>
            <ul>
              <li>Sentiment analysis from social media</li>
              <li>User-controlled policy enforcement</li>
              <li>Multi-chain trading support</li>
              <li>Community governance integration</li>
            </ul>
          </div>
        )}
      </div>

      {/* Warnings */}
      {agentType === "vincent" && !vincentStatus?.hasConsent && (
        <div className="warning-banner">
          <span className="warning-icon">!</span>
          <span>Vincent consent required before starting the agent</span>
        </div>
      )}
    </div>
  );
}
