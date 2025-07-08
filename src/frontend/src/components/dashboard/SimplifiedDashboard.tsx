import { useState, useEffect } from "react";
import "./SimplifiedDashboard.css";
import BlockchainStatus from "../blockchain/BlockchainStatus";

interface DashboardProps {
  userType: string;
}

interface GovernanceStats {
  totalActions: number;
  totalViolations: number;
  totalAgents: number;
  approvalRate: number;
  isRealData?: boolean;
  status?: string;
}

interface TradingStatus {
  recallTradingAPI: {
    configured: boolean;
    baseUrl: string;
  };
  filecoinGovernance: {
    configured: boolean;
    contractAddress: string;
  };
  existingServices: {
    tradingCompetition: boolean;
    metrics: boolean;
    auditLog: boolean;
  };
}

export default function SimplifiedDashboard({ userType }: DashboardProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [governanceStats, setGovernanceStats] =
    useState<GovernanceStats | null>(null);
  const [tradingStatus, setTradingStatus] = useState<TradingStatus | null>(
    null
  );
  const [policies, setPolicies] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data on component mount
  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      // Fetch unified dashboard data
      const unifiedResponse = await fetch("/api/proxy/dashboard/unified", {
        headers,
      });
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();

        // Update governance stats with unified data
        setGovernanceStats({
          status: "active",
          totalActions: unifiedData.competition.totalActions,
          totalAgents: unifiedData.competition.activeAgents,
          approvalRate: unifiedData.competition.approvalRate,
          totalViolations: unifiedData.competition.policyViolations,
        });
      }

      // Fetch trading status
      const tradingResponse = await fetch("/api/proxy/trading/status", {
        headers,
      });
      if (tradingResponse.ok) {
        const status = await tradingResponse.json();
        setTradingStatus(status);
      }

      // Fetch policies
      const policiesResponse = await fetch("/api/proxy/policies", { headers });
      if (policiesResponse.ok) {
        const data = await policiesResponse.json();
        setPolicies(data.policies || []);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const sections = {
    overview: {
      title: "Platform Overview",
      icon: "🏠",
      description: "See what's happening on the platform right now",
    },
    policies: {
      title: "Governance Policies",
      icon: "📋",
      description: "Rules that govern AI agent behavior",
    },
    agents: {
      title: "AI Agents",
      icon: "🤖",
      description: "Agents currently under governance",
    },
    activity: {
      title: "Live Activity",
      icon: "📊",
      description: "Real-time blockchain transactions and events",
    },
  };

  // Real-time data display functions
  const renderGovernanceStats = () => {
    if (!governanceStats) return <div>Loading governance stats...</div>;

    const isWaiting =
      governanceStats.status === "waiting_for_agents" ||
      governanceStats.totalActions === 0;

    return (
      <div className="governance-stats-container">
        {isWaiting && (
          <div className="waiting-status">
            <div className="status-indicator">⏳</div>
            <div className="status-message">
              <h4>Waiting for Agent Activity</h4>
              <p>
                No agents are currently active. Stats will update when your
                first agent starts making decisions.
              </p>
            </div>
          </div>
        )}

        <div className={`stats-grid ${isWaiting ? "inactive" : ""}`}>
          <div className="stat-card">
            <div className="stat-value">{governanceStats.totalActions}</div>
            <div className="stat-label">Total Actions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{governanceStats.totalAgents}</div>
            <div className="stat-label">Active Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{governanceStats.approvalRate}%</div>
            <div className="stat-label">Approval Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{governanceStats.totalViolations}</div>
            <div className="stat-label">Policy Violations</div>
          </div>
        </div>

        {!isWaiting && governanceStats.isRealData && (
          <div className="live-indicator">
            <span className="live-dot">🟢</span>
            <span>Live data from active agents</span>
          </div>
        )}
      </div>
    );
  };

  const renderTradingStatus = () => {
    if (!tradingStatus) return <div>Loading trading status...</div>;

    return (
      <div className="trading-status">
        <div className="status-item">
          <span className="status-label">Recall Trading API:</span>
          <span
            className={`status-value ${tradingStatus.recallTradingAPI.configured ? "connected" : "disconnected"}`}
          >
            {tradingStatus.recallTradingAPI.configured
              ? "✅ Connected"
              : "❌ Not Configured"}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Filecoin Governance:</span>
          <span
            className={`status-value ${tradingStatus.filecoinGovernance.configured ? "connected" : "disconnected"}`}
          >
            {tradingStatus.filecoinGovernance.configured
              ? "✅ Connected"
              : "❌ Not Configured"}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Contract Address:</span>
          <span className="status-value contract-address">
            {tradingStatus.filecoinGovernance.contractAddress}
          </span>
        </div>
      </div>
    );
  };

  const renderPolicies = () => {
    if (policies.length === 0) return <div>Loading policies...</div>;

    return (
      <div className="policies-list">
        {policies.slice(0, 3).map((policy) => (
          <div key={policy.id} className="policy-card">
            <h4>{policy.name}</h4>
            <p>{policy.description}</p>
            <div className="policy-meta">
              <span className={`status-badge ${policy.status}`}>
                {policy.status}
              </span>
              <span className="rules-count">{policy.rules.length} rules</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const quickActions = {
    explorer: [
      {
        title: "View Live Blockchain Data",
        description: "See real transactions on Filecoin testnet",
        action: () => setActiveSection("activity"),
        icon: "🔗",
        difficulty: "Easy",
      },
      {
        title: "Explore Governance Policies",
        description: "See how AI agents are governed",
        action: () => setActiveSection("policies"),
        icon: "📜",
        difficulty: "Easy",
      },
      {
        title: "Check Agent Status",
        description: "View agents and their compliance",
        action: () => setActiveSection("agents"),
        icon: "🤖",
        difficulty: "Easy",
      },
    ],
    developer: [
      {
        title: "Create Your First Policy",
        description: "Define rules for AI agent behavior",
        action: () => alert("Policy creation coming soon!"),
        icon: "✏️",
        difficulty: "Medium",
      },
      {
        title: "Register an Agent",
        description: "Add an AI agent to governance",
        action: () => alert("Agent registration coming soon!"),
        icon: "➕",
        difficulty: "Medium",
      },
      {
        title: "Connect Your Wallet",
        description: "Use MetaMask to interact with contracts",
        action: () => alert("Wallet connection available in header!"),
        icon: "🦊",
        difficulty: "Easy",
      },
    ],
    business: [
      {
        title: "Calculate ROI",
        description: "See potential cost savings",
        action: () => alert("ROI calculator coming soon!"),
        icon: "💰",
        difficulty: "Easy",
      },
      {
        title: "View Case Studies",
        description: "Real-world governance examples",
        action: () => alert("Case studies coming soon!"),
        icon: "📖",
        difficulty: "Easy",
      },
      {
        title: "Compliance Dashboard",
        description: "Track governance compliance",
        action: () => setActiveSection("activity"),
        icon: "✅",
        difficulty: "Easy",
      },
    ],
  };

  const renderOverview = () => (
    <div className="overview-section">
      <div className="welcome-message">
        <h2>Welcome to Cognivern! 👋</h2>
        <p>
          You're now viewing a live decentralized AI governance platform running
          on Filecoin blockchain.
        </p>
      </div>

      <BlockchainStatus />

      <div className="platform-stats">
        <h3>🏆 Competition Agent Activity</h3>
        {renderGovernanceStats()}
      </div>

      <div className="trading-integration">
        <h3>🤖 Live Trading Status</h3>
        {renderTradingStatus()}
      </div>

      <div className="active-policies">
        <h3>🛡️ Governance Policies ({policies.length})</h3>
        {renderPolicies()}
      </div>

      {governanceStats && governanceStats.totalActions > 0 && (
        <div className="competition-highlight">
          <h3>🎯 Competition Performance</h3>
          <div className="performance-grid">
            <div className="perf-card">
              <div className="perf-icon">📈</div>
              <div className="perf-content">
                <h4>Trading Active</h4>
                <p>Agent making automated decisions every few hours</p>
              </div>
            </div>
            <div className="perf-card">
              <div className="perf-icon">🛡️</div>
              <div className="perf-content">
                <h4>Governance Enforced</h4>
                <p>All trades checked against risk management policies</p>
              </div>
            </div>
            <div className="perf-card">
              <div className="perf-icon">🔗</div>
              <div className="perf-content">
                <h4>Blockchain Verified</h4>
                <p>Decisions recorded immutably on Filecoin</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="next-steps">
        <h3>What You Can Do Next</h3>
        <div className="actions-grid">
          {quickActions[userType as keyof typeof quickActions]?.map(
            (action, index) => (
              <div key={index} className="action-card" onClick={action.action}>
                <div className="action-icon">{action.icon}</div>
                <div className="action-content">
                  <h4>{action.title}</h4>
                  <p>{action.description}</p>
                  <span
                    className={`difficulty ${action.difficulty.toLowerCase()}`}
                  >
                    {action.difficulty}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="agents-section">
      <div className="section-header">
        <h2>🤖 AI Agents Under Governance</h2>
        <p>
          These AI agents are currently following the governance policies. They
          can't break the rules!
        </p>
      </div>

      <div className="agents-explainer">
        <div className="explainer-card">
          <h3>How Agent Governance Works</h3>
          <div className="governance-benefits">
            <div className="benefit">
              <span className="benefit-icon">🛡️</span>
              <div>
                <h4>Policy Enforcement</h4>
                <p>Agents must check policies before taking any action</p>
              </div>
            </div>
            <div className="benefit">
              <span className="benefit-icon">📝</span>
              <div>
                <h4>Audit Trail</h4>
                <p>Every decision is recorded on the blockchain forever</p>
              </div>
            </div>
            <div className="benefit">
              <span className="benefit-icon">🔍</span>
              <div>
                <h4>Transparency</h4>
                <p>Anyone can verify what the agent did and why</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="live-agents">
        <h3>Currently Governed Agents</h3>
        <div className="agent-list">
          <div className="agent-item">
            <div className="agent-avatar">🤖</div>
            <div className="agent-details">
              <h4>Sample AI Agent</h4>
              <p>
                A demonstration agent showing how governance works in practice
              </p>
              <div className="agent-stats">
                <span className="stat">
                  <span className="stat-label">Status:</span>
                  <span className="stat-value active">✅ Compliant</span>
                </span>
                <span className="stat">
                  <span className="stat-label">Policy:</span>
                  <span className="stat-value">Sample Governance Policy</span>
                </span>
                <span className="stat">
                  <span className="stat-label">Actions:</span>
                  <span className="stat-value">0 violations</span>
                </span>
              </div>
            </div>
          </div>

          <div className="agent-item">
            <div className="agent-avatar">🤖</div>
            <div className="agent-details">
              <h4>Integration Test Agent</h4>
              <p>
                An agent created during testing to verify the governance system
              </p>
              <div className="agent-stats">
                <span className="stat">
                  <span className="stat-label">Status:</span>
                  <span className="stat-value active">✅ Compliant</span>
                </span>
                <span className="stat">
                  <span className="stat-label">Policy:</span>
                  <span className="stat-value">Integration Test Policy</span>
                </span>
                <span className="stat">
                  <span className="stat-label">Actions:</span>
                  <span className="stat-value">0 violations</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActivity = () => (
    <div className="activity-section">
      <div className="section-header">
        <h2>📊 Live Blockchain Activity</h2>
        <p>Real-time view of what's happening on the Filecoin blockchain</p>
      </div>

      <div className="activity-explainer">
        <div className="explainer-card">
          <h3>Why Blockchain Matters</h3>
          <div className="blockchain-benefits">
            <div className="benefit">
              <span className="benefit-icon">🔒</span>
              <div>
                <h4>Immutable</h4>
                <p>Once recorded, data cannot be changed or deleted</p>
              </div>
            </div>
            <div className="benefit">
              <span className="benefit-icon">🌐</span>
              <div>
                <h4>Decentralized</h4>
                <p>No single entity controls the data</p>
              </div>
            </div>
            <div className="benefit">
              <span className="benefit-icon">👁️</span>
              <div>
                <h4>Transparent</h4>
                <p>Anyone can verify the data independently</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Transactions</h3>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-icon">📋</div>
            <div className="activity-details">
              <h4>Policy Created</h4>
              <p>
                Integration Test Policy was created and stored on blockchain
              </p>
              <span className="activity-time">Recently</span>
            </div>
            <div className="activity-status success">✅ Confirmed</div>
          </div>

          <div className="activity-item">
            <div className="activity-icon">🤖</div>
            <div className="activity-details">
              <h4>Agent Registered</h4>
              <p>
                Integration Test Agent was registered and assigned to policy
              </p>
              <span className="activity-time">Recently</span>
            </div>
            <div className="activity-status success">✅ Confirmed</div>
          </div>

          <div className="activity-item">
            <div className="activity-icon">💾</div>
            <div className="activity-details">
              <h4>Storage Request</h4>
              <p>Governance data was stored on Filecoin network</p>
              <span className="activity-time">Recently</span>
            </div>
            <div className="activity-status success">✅ Confirmed</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview();
      case "policies":
        return renderPolicies();
      case "agents":
        return renderAgents();
      case "activity":
        return renderActivity();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="simplified-dashboard">
      <div className="dashboard-sidebar">
        <div className="user-info">
          <div className="user-avatar">
            {userType === "explorer"
              ? "🔍"
              : userType === "developer"
                ? "👩‍💻"
                : "🏢"}
          </div>
          <div className="user-details">
            <h3>{userType.charAt(0).toUpperCase() + userType.slice(1)}</h3>
            <p>Viewing as {userType}</p>
          </div>
        </div>

        <nav className="dashboard-nav">
          {Object.entries(sections).map(([key, section]) => (
            <button
              key={key}
              className={`nav-item ${activeSection === key ? "active" : ""}`}
              onClick={() => setActiveSection(key)}
            >
              <span className="nav-icon">{section.icon}</span>
              <div className="nav-content">
                <span className="nav-title">{section.title}</span>
                <span className="nav-description">{section.description}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      <div className="dashboard-main">{renderSection()}</div>
    </div>
  );
}
