import { useState, useEffect } from "react";
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Container } from '../layout/ResponsiveLayout';
import BlockchainStatus from "../blockchain/BlockchainStatus";

import { BaseAgent } from '../../types';

// Unified interfaces for both Recall and Filecoin data
interface CogniverseAgent extends BaseAgent {
  avatar?: string;
  recallProfile: {
    agentRank: number;
    totalEarnings: number;
    winRate: number;
    competitionsWon: number;
    reputation: number;
    lastActive: string;
  };
  governanceProfile: {
    isDeployed: boolean;
    policyCompliance: number;
    auditScore: number;
    riskLevel: "low" | "medium" | "high";
    deploymentStatus: string;
  };
  trustScore: number;
  overallRank: number;
}

interface Competition {
  id: string;
  name: string;
  type: string;
  status: "upcoming" | "live" | "completed";
  participants: number;
  prizePool: number;
  winner?: any;
  leaderboard: any[];
}

interface DashboardSummary {
  recall: {
    liveCompetitions: number;
    totalAgents: number;
    totalPrizePool: number;
  };
  governance: {
    totalPolicies: number;
    totalAgents: number;
    totalActions: number;
  };
  unified: {
    deployedAgents: number;
    averageTrustScore: number;
    totalValue: number;
  };
}

interface ActivityFeedItem {
  type: string;
  source: "recall" | "filecoin";
  timestamp: string;
  data: any;
}

// Unified dashboard styles using design tokens
const dashboardStyles = css`
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
`;

const headerStyles = css`
  padding: ${designTokens.spacing[6]} 0 ${designTokens.spacing[4]};
  text-align: center;
  
  h1 {
    font-size: ${designTokens.typography.fontSize['3xl']};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.text.primary};
    margin-bottom: ${designTokens.spacing[2]};
  }
  
  p {
    color: ${designTokens.colors.text.secondary};
    font-size: ${designTokens.typography.fontSize.lg};
  }
`;

const gridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};
  
  @media (max-width: ${designTokens.breakpoints.md}) {
    grid-template-columns: 1fr;
    gap: ${designTokens.spacing[4]};
  }
`;

export default function UnifiedDashboard() {
  const { isMobile } = useBreakpoint();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topAgents, setTopAgents] = useState<CogniverseAgent[]>([]);
  const [allAgents, setAllAgents] = useState<CogniverseAgent[]>([]);
  const [liveCompetitions, setLiveCompetitions] = useState<Competition[]>([]);
  const [completedCompetitions, setCompletedCompetitions] = useState<
    Competition[]
  >([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "overview" | "competitions" | "agents" | "governance"
  >("overview");

  // Interactive state
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<
    "all" | "deployed" | "undeployed"
  >("all");
  const [agentSort, setAgentSort] = useState<
    "rank" | "trust" | "earnings" | "winRate"
  >("rank");
  const [competitionFilter, setCompetitionFilter] = useState<
    "all" | "live" | "completed"
  >("all");
  const [selectedAgent, setSelectedAgent] = useState<CogniverseAgent | null>(
    null
  );
  const [selectedCompetition, setSelectedCompetition] =
    useState<Competition | null>(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showCompetitionDetails, setShowCompetitionDetails] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "recall" | "filecoin">(
    "all"
  );
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = autoRefresh ? setInterval(loadDashboardData, 30000) : null; // Refresh every 30 seconds
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [
        summaryRes,
        agentsRes,
        allAgentsRes,
        liveCompetitionsRes,
        completedCompetitionsRes,
        feedRes,
      ] = await Promise.all([
        fetch(getApiUrl("/api/dashboard/summary"), {
          headers: {
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
        }),
        fetch(getApiUrl("/api/agents/unified?limit=10"), {
          headers: {
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
        }),
        fetch(getApiUrl("/api/agents/unified?limit=50"), {
          headers: {
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
        }),
        fetch(getApiUrl("/api/recall/competitions/live"), {
          headers: {
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
        }),
        fetch(getApiUrl("/api/recall/competitions/completed?limit=20"), {
          headers: {
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
        }),
        fetch(getApiUrl("/api/feed/live"), {
          headers: {
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
        }),
      ]);

      const [
        summaryData,
        agentsData,
        allAgentsData,
        liveCompetitionsData,
        completedCompetitionsData,
        feedData,
      ] = await Promise.all([
        summaryRes.json(),
        agentsRes.json(),
        allAgentsRes.json(),
        liveCompetitionsRes.json(),
        completedCompetitionsRes.json(),
        feedRes.json(),
      ]);

      setSummary(summaryData);
      setTopAgents(agentsData.agents || []);
      setAllAgents(allAgentsData.agents || []);
      setLiveCompetitions(liveCompetitionsData.competitions || []);
      setCompletedCompetitions(completedCompetitionsData.competitions || []);
      setActivityFeed(feedData.feed || []);
      setError(null);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  const importWinnerToGovernance = async (competitionId: string) => {
    try {
      const response = await fetch(getApiUrl("/api/pipeline/import-winner"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
        },
        body: JSON.stringify({ competitionId }),
      });

      if (response.ok) {
        // Refresh data to show the imported agent
        await loadDashboardData();
        alert("Winner successfully imported to governance!");
      } else {
        throw new Error("Failed to import winner");
      }
    } catch (err) {
      console.error("Error importing winner:", err);
      alert("Failed to import winner to governance");
    }
  };

  // Filtering and sorting logic
  const filteredAndSortedAgents = allAgents
    .filter((agent) => {
      // Search filter
      if (
        searchQuery &&
        !agent.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Deployment filter
      if (agentFilter === "deployed" && !agent.governanceProfile.isDeployed) {
        return false;
      }
      if (agentFilter === "undeployed" && agent.governanceProfile.isDeployed) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (agentSort) {
        case "trust":
          return b.trustScore - a.trustScore;
        case "earnings":
          return b.recallProfile.totalEarnings - a.recallProfile.totalEarnings;
        case "winRate":
          return b.recallProfile.winRate - a.recallProfile.winRate;
        case "rank":
        default:
          return a.overallRank - b.overallRank;
      }
    });

  const filteredCompetitions = [
    ...liveCompetitions,
    ...completedCompetitions,
  ].filter((competition) => {
    if (competitionFilter === "live") return competition.status === "live";
    if (competitionFilter === "completed")
      return competition.status === "completed";
    return true;
  });

  const filteredActivityFeed = activityFeed.filter((item) => {
    if (feedFilter === "recall") return item.source === "recall";
    if (feedFilter === "filecoin") return item.source === "filecoin";
    return true;
  });

  const openAgentDetails = (agent: CogniverseAgent) => {
    setSelectedAgent(agent);
    setShowAgentDetails(true);
  };

  const openCompetitionDetails = (competition: Competition) => {
    setSelectedCompetition(competition);
    setShowCompetitionDetails(true);
  };

  if (loading && !summary) {
    return (
      <div className="unified-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Cognivern Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="unified-dashboard error">
        <div className="error-message">
          <h3>⚠️ Dashboard Error</h3>
          <p>{error}</p>
          <button onClick={loadDashboardData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-dashboard">
      {/* Header with Navigation */}
      <div className="dashboard-header">
        <div className="header-top">
          <div className="title-section">
            <h1>🧠 Cognivern Platform</h1>
            <p>AI Agent Competition & Governance</p>
          </div>

          <div className="header-controls">
            <div className="refresh-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span>Auto-refresh</span>
            </div>

            <button
              className="refresh-button"
              onClick={loadDashboardData}
              disabled={loading}
            >
              {loading ? "🔄" : "↻"} Refresh
            </button>
          </div>
        </div>

        <nav className="dashboard-nav">
          <button
            className={activeView === "overview" ? "active" : ""}
            onClick={() => setActiveView("overview")}
          >
            📊 Overview
          </button>
          <button
            className={activeView === "competitions" ? "active" : ""}
            onClick={() => setActiveView("competitions")}
          >
            🏆 Competitions
          </button>
          <button
            className={activeView === "agents" ? "active" : ""}
            onClick={() => setActiveView("agents")}
          >
            🤖 Agents
          </button>
          <button
            className={activeView === "governance" ? "active" : ""}
            onClick={() => setActiveView("governance")}
          >
            🛡️ Governance
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeView === "overview" && (
        <div className="overview-section">
          {/* Summary Stats */}
          {summary && (
            <div className="summary-grid">
              <div className="summary-card recall">
                <h3>🏁 Recall Competitions</h3>
                <div className="stats">
                  <div className="stat">
                    <span className="value">
                      {summary.recall.liveCompetitions}
                    </span>
                    <span className="label">Live Competitions</span>
                  </div>
                  <div className="stat">
                    <span className="value">{summary.recall.totalAgents}</span>
                    <span className="label">Total Agents</span>
                  </div>
                  <div className="stat">
                    <span className="value">
                      ${summary.recall.totalPrizePool.toLocaleString()}
                    </span>
                    <span className="label">Prize Pool</span>
                  </div>
                </div>
              </div>

              <div className="summary-card filecoin">
                <h3>⛓️ Filecoin Governance</h3>
                <div className="stats">
                  <div className="stat">
                    <span className="value">
                      {summary.governance.totalPolicies}
                    </span>
                    <span className="label">Active Policies</span>
                  </div>
                  <div className="stat">
                    <span className="value">
                      {summary.governance.totalAgents}
                    </span>
                    <span className="label">Governed Agents</span>
                  </div>
                  <div className="stat">
                    <span className="value">
                      {summary.governance.totalActions}
                    </span>
                    <span className="label">Governance Actions</span>
                  </div>
                </div>
              </div>

              <div className="summary-card unified">
                <h3>🌟 Unified Platform</h3>
                <div className="stats">
                  <div className="stat">
                    <span className="value">
                      {summary.unified.deployedAgents}
                    </span>
                    <span className="label">Deployed Agents</span>
                  </div>
                  <div className="stat">
                    <span className="value">
                      {summary.unified.averageTrustScore}
                    </span>
                    <span className="label">Avg Trust Score</span>
                  </div>
                  <div className="stat">
                    <span className="value">
                      ${summary.unified.totalValue.toLocaleString()}
                    </span>
                    <span className="label">Total Value</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Activity Feed */}
          <div className="activity-section">
            <div className="section-header">
              <h3>📡 Live Activity Feed</h3>
              <div className="feed-controls">
                <select
                  value={feedFilter}
                  onChange={(e) =>
                    setFeedFilter(
                      e.target.value as "all" | "recall" | "filecoin"
                    )
                  }
                  className="filter-select"
                >
                  <option value="all">All Sources</option>
                  <option value="recall">🏁 Recall Only</option>
                  <option value="filecoin">⛓️ Filecoin Only</option>
                </select>
              </div>
            </div>
            <div className="activity-feed">
              {filteredActivityFeed.slice(0, 10).map((item, index) => (
                <div key={index} className={`activity-item ${item.source}`}>
                  <div className="activity-icon">
                    {item.source === "recall" ? "🏁" : "⛓️"}
                  </div>
                  <div className="activity-content">
                    <div className="activity-type">
                      {item.type.replace("_", " ")}
                    </div>
                    <div className="activity-details">
                      {item.type === "competition_win" && (
                        <>
                          <strong>{item.data.agent.name}</strong> won{" "}
                          <strong>{item.data.competition.name}</strong>
                          <span className="earnings">
                            +${item.data.earnings.toLocaleString()}
                          </span>
                        </>
                      )}
                      {item.type === "governance_action" && (
                        <>
                          <strong>{item.data.agent}</strong> -{" "}
                          {item.data.details}
                          <span className={`status ${item.data.result}`}>
                            {item.data.result}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="activity-time">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Competitions Tab */}
      {activeView === "competitions" && (
        <div className="competitions-section">
          <h3>🏆 Live Competitions</h3>
          <div className="competitions-grid">
            {liveCompetitions.map((competition) => (
              <div key={competition.id} className="competition-card">
                <div className="competition-header">
                  <h4>{competition.name}</h4>
                  <span className={`status ${competition.status}`}>
                    {competition.status}
                  </span>
                </div>
                <div className="competition-stats">
                  <div className="stat">
                    <span className="label">Participants</span>
                    <span className="value">{competition.participants}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Prize Pool</span>
                    <span className="value">
                      ${competition.prizePool.toLocaleString()}
                    </span>
                  </div>
                </div>
                {competition.status === "completed" && competition.winner && (
                  <div className="competition-winner">
                    <div className="winner-info">
                      <strong>🏆 Winner: {competition.winner.name}</strong>
                      <span>AgentRank: #{competition.winner.agentRank}</span>
                    </div>
                    <button
                      className="import-button"
                      onClick={() => importWinnerToGovernance(competition.id)}
                    >
                      Deploy to Governance
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agents Tab */}
      {activeView === "agents" && (
        <div className="agents-section">
          <h3>🤖 Top Unified Agents</h3>
          <div className="agents-grid">
            {topAgents.map((agent) => (
              <div key={agent.id} className="agent-card">
                <div className="agent-header">
                  <div className="agent-avatar">{agent.avatar || "🤖"}</div>
                  <div className="agent-info">
                    <h4>{agent.name}</h4>
                    <div className="agent-ranks">
                      <span className="recall-rank">
                        Recall: #{agent.recallProfile.agentRank}
                      </span>
                      <span className="overall-rank">
                        Overall: #{agent.overallRank}
                      </span>
                    </div>
                  </div>
                  <div className="trust-score">
                    <div className="score-circle">
                      <span className="score">{agent.trustScore}</span>
                    </div>
                    <span className="score-label">Trust Score</span>
                  </div>
                </div>

                <div className="agent-metrics">
                  <div className="metrics-section recall-metrics">
                    <h5>🏁 Competition Performance</h5>
                    <div className="metrics-grid">
                      <div className="metric">
                        <span className="value">
                          ${agent.recallProfile.totalEarnings.toLocaleString()}
                        </span>
                        <span className="label">Total Earnings</span>
                      </div>
                      <div className="metric">
                        <span className="value">
                          {agent.recallProfile.winRate}%
                        </span>
                        <span className="label">Win Rate</span>
                      </div>
                      <div className="metric">
                        <span className="value">
                          {agent.recallProfile.competitionsWon}
                        </span>
                        <span className="label">Wins</span>
                      </div>
                    </div>
                  </div>

                  <div className="metrics-section governance-metrics">
                    <h5>⛓️ Governance Status</h5>
                    <div className="metrics-grid">
                      <div className="metric">
                        <span
                          className={`status ${agent.governanceProfile.deploymentStatus}`}
                        >
                          {agent.governanceProfile.isDeployed
                            ? "✅ Deployed"
                            : "⏳ Not Deployed"}
                        </span>
                        <span className="label">Status</span>
                      </div>
                      <div className="metric">
                        <span className="value">
                          {agent.governanceProfile.policyCompliance.toFixed(1)}%
                        </span>
                        <span className="label">Compliance</span>
                      </div>
                      <div className="metric">
                        <span
                          className={`risk-level ${agent.governanceProfile.riskLevel}`}
                        >
                          {agent.governanceProfile.riskLevel.toUpperCase()}
                        </span>
                        <span className="label">Risk Level</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Governance Tab */}
      {activeView === "governance" && (
        <div className="governance-section">
          <h3>🛡️ Governance Overview</h3>
          <div className="governance-content">
            <div className="governance-stats">
              <div className="stat-card">
                <h4>Policy Enforcement</h4>
                <div className="big-number">
                  {summary?.governance.totalActions || 0}
                </div>
                <p>Total governance actions executed</p>
              </div>
              <div className="stat-card">
                <h4>Active Policies</h4>
                <div className="big-number">
                  {summary?.governance.totalPolicies || 0}
                </div>
                <p>Policies currently enforced</p>
              </div>
              <div className="stat-card">
                <h4>Governed Agents</h4>
                <div className="big-number">
                  {summary?.governance.totalAgents || 0}
                </div>
                <p>Agents under governance</p>
              </div>
            </div>

            <div className="governance-pipeline">
              <h4>🔄 Filecoin Sovereign Data Pipeline</h4>
              <p>Real trading with immutable governance on Filecoin:</p>
              <ol>
                <li>🤖 AI agents make real trading decisions via Recall API</li>
                <li>🛡️ Governance policies enforce compliance in real-time</li>
                <li>📦 All decisions stored immutably on Filecoin FVM</li>
                <li>🔍 Cryptographic proofs enable regulatory audits</li>
                <li>⚖️ Sovereign data ownership for enterprises</li>
              </ol>

              <div className="filecoin-status">
                <h5>🔗 Filecoin Integration Status</h5>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">Trading API:</span>
                    <span className="status-value">🟢 Connected</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">FVM Contract:</span>
                    <span className="status-value">🟡 Simulated</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Data Storage:</span>
                    <span className="status-value">🟢 Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
