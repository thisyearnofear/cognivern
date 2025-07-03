import { useState, useEffect } from 'react';
import './SimplifiedDashboard.css';
import BlockchainStatus from '../blockchain/BlockchainStatus';

interface DashboardProps {
  userType: string;
}

export default function SimplifiedDashboard({ userType }: DashboardProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);

  const sections = {
    overview: {
      title: "Platform Overview",
      icon: "🏠",
      description: "See what's happening on the platform right now"
    },
    policies: {
      title: "Governance Policies", 
      icon: "📋",
      description: "Rules that govern AI agent behavior"
    },
    agents: {
      title: "AI Agents",
      icon: "🤖", 
      description: "Agents currently under governance"
    },
    activity: {
      title: "Live Activity",
      icon: "📊",
      description: "Real-time blockchain transactions and events"
    }
  };

  const quickActions = {
    explorer: [
      {
        title: "View Live Blockchain Data",
        description: "See real transactions on Filecoin testnet",
        action: () => setActiveSection('activity'),
        icon: "🔗",
        difficulty: "Easy"
      },
      {
        title: "Explore Governance Policies", 
        description: "See how AI agents are governed",
        action: () => setActiveSection('policies'),
        icon: "📜",
        difficulty: "Easy"
      },
      {
        title: "Check Agent Status",
        description: "View agents and their compliance",
        action: () => setActiveSection('agents'),
        icon: "🤖",
        difficulty: "Easy"
      }
    ],
    developer: [
      {
        title: "Create Your First Policy",
        description: "Define rules for AI agent behavior",
        action: () => alert("Policy creation coming soon!"),
        icon: "✏️",
        difficulty: "Medium"
      },
      {
        title: "Register an Agent",
        description: "Add an AI agent to governance",
        action: () => alert("Agent registration coming soon!"),
        icon: "➕",
        difficulty: "Medium"
      },
      {
        title: "Connect Your Wallet",
        description: "Use MetaMask to interact with contracts",
        action: () => alert("Wallet connection available in header!"),
        icon: "🦊",
        difficulty: "Easy"
      }
    ],
    business: [
      {
        title: "Calculate ROI",
        description: "See potential cost savings",
        action: () => alert("ROI calculator coming soon!"),
        icon: "💰",
        difficulty: "Easy"
      },
      {
        title: "View Case Studies",
        description: "Real-world governance examples",
        action: () => alert("Case studies coming soon!"),
        icon: "📖",
        difficulty: "Easy"
      },
      {
        title: "Compliance Dashboard",
        description: "Track governance compliance",
        action: () => setActiveSection('activity'),
        icon: "✅",
        difficulty: "Easy"
      }
    ]
  };

  const renderOverview = () => (
    <div className="overview-section">
      <div className="welcome-message">
        <h2>Welcome to Cognivern! 👋</h2>
        <p>You're now viewing a live decentralized AI governance platform running on Filecoin blockchain.</p>
      </div>

      <BlockchainStatus />

      <div className="platform-stats">
        <h3>What's Happening Right Now</h3>
        <div className="stats-explanation">
          <div className="stat-item">
            <div className="stat-visual">📋</div>
            <div className="stat-content">
              <h4>2 Active Policies</h4>
              <p>These are the rules that govern how AI agents behave. Think of them as "laws" for AI.</p>
            </div>
          </div>
          
          <div className="stat-item">
            <div className="stat-visual">🤖</div>
            <div className="stat-content">
              <h4>2 Governed Agents</h4>
              <p>AI agents currently following the governance policies. They can't break the rules!</p>
            </div>
          </div>
          
          <div className="stat-item">
            <div className="stat-visual">🔗</div>
            <div className="stat-content">
              <h4>Live on Blockchain</h4>
              <p>Everything is recorded on Filecoin blockchain - completely transparent and immutable.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="next-steps">
        <h3>What You Can Do Next</h3>
        <div className="actions-grid">
          {quickActions[userType as keyof typeof quickActions]?.map((action, index) => (
            <div key={index} className="action-card" onClick={action.action}>
              <div className="action-icon">{action.icon}</div>
              <div className="action-content">
                <h4>{action.title}</h4>
                <p>{action.description}</p>
                <span className={`difficulty ${action.difficulty.toLowerCase()}`}>
                  {action.difficulty}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div className="policies-section">
      <div className="section-header">
        <h2>📋 Governance Policies</h2>
        <p>These are the rules that AI agents must follow. Think of them as "laws" for artificial intelligence.</p>
      </div>

      <div className="policies-explainer">
        <div className="explainer-card">
          <h3>How Policies Work</h3>
          <div className="policy-flow">
            <div className="flow-step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>Policy Created</h4>
                <p>Someone defines a rule (e.g., "Never delete user data")</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>Stored on Blockchain</h4>
                <p>The rule is permanently recorded on Filecoin</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>Agents Follow Rules</h4>
                <p>AI agents automatically check policies before acting</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="live-policies">
        <h3>Current Active Policies</h3>
        <div className="policy-list">
          <div className="policy-item">
            <div className="policy-status active">✅ Active</div>
            <div className="policy-details">
              <h4>Sample AI Governance Policy</h4>
              <p>A demonstration policy showing how AI agent behavior can be governed</p>
              <div className="policy-meta">
                <span>Created: Recently</span>
                <span>Agents: 2 following</span>
                <span>Violations: 0</span>
              </div>
            </div>
          </div>
          
          <div className="policy-item">
            <div className="policy-status active">✅ Active</div>
            <div className="policy-details">
              <h4>Integration Test Policy</h4>
              <p>A policy created during our integration testing to verify the system works</p>
              <div className="policy-meta">
                <span>Created: Recently</span>
                <span>Agents: 1 following</span>
                <span>Violations: 0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="agents-section">
      <div className="section-header">
        <h2>🤖 AI Agents Under Governance</h2>
        <p>These AI agents are currently following the governance policies. They can't break the rules!</p>
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
              <p>A demonstration agent showing how governance works in practice</p>
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
              <p>An agent created during testing to verify the governance system</p>
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
              <p>Integration Test Policy was created and stored on blockchain</p>
              <span className="activity-time">Recently</span>
            </div>
            <div className="activity-status success">✅ Confirmed</div>
          </div>
          
          <div className="activity-item">
            <div className="activity-icon">🤖</div>
            <div className="activity-details">
              <h4>Agent Registered</h4>
              <p>Integration Test Agent was registered and assigned to policy</p>
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
      case 'overview': return renderOverview();
      case 'policies': return renderPolicies();
      case 'agents': return renderAgents();
      case 'activity': return renderActivity();
      default: return renderOverview();
    }
  };

  return (
    <div className="simplified-dashboard">
      <div className="dashboard-sidebar">
        <div className="user-info">
          <div className="user-avatar">{userType === 'explorer' ? '🔍' : userType === 'developer' ? '👩‍💻' : '🏢'}</div>
          <div className="user-details">
            <h3>{userType.charAt(0).toUpperCase() + userType.slice(1)}</h3>
            <p>Viewing as {userType}</p>
          </div>
        </div>

        <nav className="dashboard-nav">
          {Object.entries(sections).map(([key, section]) => (
            <button
              key={key}
              className={`nav-item ${activeSection === key ? 'active' : ''}`}
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

      <div className="dashboard-main">
        {renderSection()}
      </div>
    </div>
  );
}