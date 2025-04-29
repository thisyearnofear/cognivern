import { useState, useEffect, useRef } from 'react';
import './AgentMarketplace.css';

interface MCPAgent {
  name: string;
  type: string;
  status: string;
  capabilities: string[];
}

interface MCPStatus {
  status: string;
  server: string;
  agents: MCPAgent[];
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  capabilities: string[];
  integrations: string[];
}

export default function AgentMarketplace() {
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [deploymentStep, setDeploymentStep] = useState<number>(0);

  // Fetch MCP status on component mount
  useEffect(() => {
    fetchMCPStatus();
  }, []);

  const fetchMCPStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mcp/status', {
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setMcpStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching MCP status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMcpStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const reconnectMCP = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/mcp/reconnect', {
        method: 'POST',
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Refresh status after reconnection
      setTimeout(fetchMCPStatus, 2000);
      
    } catch (err) {
      console.error('Error reconnecting to MCP:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sample agent templates
  const agentTemplates: AgentTemplate[] = [
    {
      id: 'ad-allocation',
      name: 'Ad Allocation Agent',
      description: 'Intelligently allocates ad placements based on contract terms, content relevance, and audience targeting',
      icon: '📊',
      category: 'marketing',
      capabilities: ['Contract Analysis', 'Content Relevance Scoring', 'Audience Targeting', 'Performance Tracking'],
      integrations: ['Google Analytics', 'Mailchimp', 'HubSpot']
    },
    {
      id: 'compliance-guardian',
      name: 'Compliance Guardian',
      description: 'Ensures all content and operations meet regulatory requirements with automatic policy enforcement',
      icon: '🛡️',
      category: 'governance',
      capabilities: ['Policy Enforcement', 'Regulatory Monitoring', 'Audit Trail Generation', 'Violation Detection'],
      integrations: ['DocuSign', 'Salesforce', 'Microsoft 365']
    },
    {
      id: 'content-moderator',
      name: 'Content Moderation Agent',
      description: 'Automatically reviews and moderates user-generated content according to platform policies',
      icon: '🔍',
      category: 'content',
      capabilities: ['Text Analysis', 'Image Recognition', 'Policy Enforcement', 'Escalation Management'],
      integrations: ['Slack', 'Discord', 'WordPress']
    },
    {
      id: 'financial-advisor',
      name: 'Financial Advisory Agent',
      description: 'Provides personalized financial advice while ensuring compliance with regulations',
      icon: '💰',
      category: 'finance',
      capabilities: ['Risk Assessment', 'Portfolio Analysis', 'Regulatory Compliance', 'Document Generation'],
      integrations: ['Plaid', 'QuickBooks', 'Stripe']
    },
    {
      id: 'supply-chain',
      name: 'Supply Chain Optimizer',
      description: 'Optimizes inventory and logistics while maintaining compliance with trade regulations',
      icon: '🚚',
      category: 'operations',
      capabilities: ['Inventory Optimization', 'Logistics Planning', 'Compliance Verification', 'Cost Analysis'],
      integrations: ['SAP', 'Shopify', 'ShipStation']
    },
    {
      id: 'healthcare-assistant',
      name: 'Healthcare Assistant',
      description: 'Assists healthcare providers with patient management while ensuring HIPAA compliance',
      icon: '🏥',
      category: 'healthcare',
      capabilities: ['Patient Data Management', 'Appointment Scheduling', 'Compliance Verification', 'Documentation'],
      integrations: ['Epic', 'Cerner', 'Athenahealth']
    },
    {
      id: 'legal-document',
      name: 'Legal Document Analyzer',
      description: 'Reviews legal documents and identifies potential issues while maintaining confidentiality',
      icon: '⚖️',
      category: 'legal',
      capabilities: ['Document Analysis', 'Risk Identification', 'Compliance Checking', 'Citation Verification'],
      integrations: ['DocuSign', 'Clio', 'LexisNexis']
    },
    {
      id: 'customer-support',
      name: 'Customer Support Agent',
      description: 'Handles customer inquiries while ensuring compliance with company policies and regulations',
      icon: '🎧',
      category: 'customer-service',
      capabilities: ['Query Resolution', 'Escalation Management', 'Policy Enforcement', 'Satisfaction Tracking'],
      integrations: ['Zendesk', 'Intercom', 'Salesforce']
    }
  ];

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'governance', name: 'Governance' },
    { id: 'content', name: 'Content' },
    { id: 'finance', name: 'Finance' },
    { id: 'operations', name: 'Operations' },
    { id: 'healthcare', name: 'Healthcare' },
    { id: 'legal', name: 'Legal' },
    { id: 'customer-service', name: 'Customer Service' }
  ];

  // Filter agents based on category and search query
  const filteredAgents = agentTemplates.filter(agent => {
    const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const handleAgentSelect = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setDeploymentStep(1);
  };

  const handleDeployment = () => {
    setDeploymentStep(prev => prev + 1);
    
    // Simulate deployment completion after 2 seconds
    if (deploymentStep === 2) {
      setTimeout(() => {
        setDeploymentStep(4);
      }, 2000);
    }
  };

  const resetDeployment = () => {
    setSelectedAgent(null);
    setDeploymentStep(0);
  };

  const renderAgentCatalog = () => (
    <div className="agent-catalog">
      <div className="catalog-header">
        <h2>Agent Marketplace</h2>
        <p className="catalog-description">
          Discover and deploy pre-built agents with built-in governance and compliance capabilities
        </p>
      </div>
      
      <div className="catalog-filters">
        <div className="category-filter">
          <div className="filter-label">Filter by Category:</div>
          <div className="category-tabs">
            {categories.map(category => (
              <button 
                key={category.id}
                className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        
        <div className="search-filter">
          <input 
            type="text" 
            placeholder="Search agents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="agents-grid">
        {filteredAgents.length === 0 ? (
          <div className="no-agents">
            No agents found matching your criteria
          </div>
        ) : (
          filteredAgents.map(agent => (
            <div 
              key={agent.id}
              className="agent-card"
              onClick={() => handleAgentSelect(agent)}
            >
              <div className="agent-icon">{agent.icon}</div>
              <h3>{agent.name}</h3>
              <p className="agent-description">{agent.description}</p>
              
              <div className="agent-capabilities">
                <h4>Capabilities</h4>
                <ul>
                  {agent.capabilities.map((capability, index) => (
                    <li key={index}>{capability}</li>
                  ))}
                </ul>
              </div>
              
              <div className="agent-integrations">
                <h4>Integrations</h4>
                <div className="integration-tags">
                  {agent.integrations.map((integration, index) => (
                    <span key={index} className="integration-tag">{integration}</span>
                  ))}
                </div>
              </div>
              
              <button className="deploy-button">
                Deploy Agent
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderDeploymentFlow = () => {
    if (!selectedAgent) return null;
    
    return (
      <div className="deployment-flow">
        <div className="deployment-header">
          <button className="back-button" onClick={resetDeployment}>
            ← Back to Marketplace
          </button>
          <h2>Deploy {selectedAgent.name}</h2>
        </div>
        
        <div className="deployment-progress">
          <div className={`progress-step ${deploymentStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Configure</div>
          </div>
          <div className="progress-connector"></div>
          <div className={`progress-step ${deploymentStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Review</div>
          </div>
          <div className="progress-connector"></div>
          <div className={`progress-step ${deploymentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Deploy</div>
          </div>
          <div className="progress-connector"></div>
          <div className={`progress-step ${deploymentStep >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">Complete</div>
          </div>
        </div>
        
        <div className="deployment-content">
          {deploymentStep === 1 && (
            <div className="configuration-step">
              <div className="agent-preview">
                <div className="preview-icon">{selectedAgent.icon}</div>
                <h3>{selectedAgent.name}</h3>
                <p>{selectedAgent.description}</p>
              </div>
              
              <div className="configuration-form">
                <h3>Agent Configuration</h3>
                
                <div className="form-group">
                  <label>Agent Name</label>
                  <input type="text" defaultValue={`My ${selectedAgent.name}`} />
                </div>
                
                <div className="form-group">
                  <label>Environment</label>
                  <select>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Governance Policy</label>
                  <select>
                    <option value="standard">Standard Policy</option>
                    <option value="strict">Strict Compliance</option>
                    <option value="custom">Custom Policy</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Audit Level</label>
                  <select>
                    <option value="basic">Basic (Actions Only)</option>
                    <option value="detailed">Detailed (Actions + Reasoning)</option>
                    <option value="comprehensive">Comprehensive (Full Audit Trail)</option>
                  </select>
                </div>
                
                <div className="form-actions">
                  <button className="next-button" onClick={handleDeployment}>
                    Next: Review
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {deploymentStep === 2 && (
            <div className="review-step">
              <div className="review-summary">
                <h3>Deployment Summary</h3>
                
                <div className="summary-item">
                  <div className="summary-label">Agent Type</div>
                  <div className="summary-value">{selectedAgent.name}</div>
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Agent Name</div>
                  <div className="summary-value">{`My ${selectedAgent.name}`}</div>
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Environment</div>
                  <div className="summary-value">Development</div>
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Governance Policy</div>
                  <div className="summary-value">Standard Policy</div>
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Audit Level</div>
                  <div className="summary-value">Detailed (Actions + Reasoning)</div>
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Capabilities</div>
                  <div className="summary-value capabilities-list">
                    {selectedAgent.capabilities.map((capability, index) => (
                      <span key={index} className="capability-tag">{capability}</span>
                    ))}
                  </div>
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Integrations</div>
                  <div className="summary-value integrations-list">
                    {selectedAgent.integrations.map((integration, index) => (
                      <span key={index} className="integration-tag">{integration}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="governance-preview">
                <h3>Governance & Compliance</h3>
                
                <div className="governance-features">
                  <div className="governance-feature">
                    <div className="feature-icon">🔍</div>
                    <div className="feature-content">
                      <h4>Complete Audit Trail</h4>
                      <p>Every agent action is logged with detailed reasoning and policy checks</p>
                    </div>
                  </div>
                  
                  <div className="governance-feature">
                    <div className="feature-icon">🛡️</div>
                    <div className="feature-content">
                      <h4>Policy Enforcement</h4>
                      <p>Automatic enforcement of governance policies with violation prevention</p>
                    </div>
                  </div>
                  
                  <div className="governance-feature">
                    <div className="feature-icon">📊</div>
                    <div className="feature-content">
                      <h4>Performance Metrics</h4>
                      <p>Real-time metrics on agent performance, compliance, and efficiency</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="review-actions">
                <button className="back-button" onClick={() => setDeploymentStep(1)}>
                  Back
                </button>
                <button className="deploy-button" onClick={handleDeployment}>
                  Deploy Agent
                </button>
              </div>
            </div>
          )}
          
          {deploymentStep === 3 && (
            <div className="deploying-step">
              <div className="deployment-progress-indicator">
                <div className="spinner"></div>
                <h3>Deploying Agent...</h3>
                <p>This may take a few moments</p>
                
                <div className="deployment-logs">
                  <div className="log-entry">Initializing agent environment...</div>
                  <div className="log-entry">Loading governance policies...</div>
                  <div className="log-entry">Configuring audit logging...</div>
                  <div className="log-entry">Setting up integrations...</div>
                  <div className="log-entry">Registering with MCP server...</div>
                </div>
              </div>
            </div>
          )}
          
          {deploymentStep === 4 && (
            <div className="complete-step">
              <div className="completion-message">
                <div className="success-icon">✓</div>
                <h3>Deployment Complete!</h3>
                <p>Your agent has been successfully deployed and is ready to use</p>
                
                <div className="agent-details">
                  <div className="detail-item">
                    <div className="detail-label">Agent Name</div>
                    <div className="detail-value">{`My ${selectedAgent.name}`}</div>
                  </div>
                  
                  <div className="detail-item">
                    <div className="detail-label">Status</div>
                    <div className="detail-value status-active">Active</div>
                  </div>
                  
                  <div className="detail-item">
                    <div className="detail-label">Environment</div>
                    <div className="detail-value">Development</div>
                  </div>
                  
                  <div className="detail-item">
                    <div className="detail-label">Deployment ID</div>
                    <div className="detail-value">{`dep_${Math.random().toString(36).substring(2, 10)}`}</div>
                  </div>
                </div>
                
                <div className="next-steps">
                  <h4>Next Steps</h4>
                  <div className="next-steps-options">
                    <button className="view-agent-btn">
                      View Agent Dashboard
                    </button>
                    <button className="configure-btn">
                      Configure Integrations
                    </button>
                    <button className="marketplace-btn" onClick={resetDeployment}>
                      Return to Marketplace
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && !mcpStatus) {
    return <div className="marketplace-loading">Loading Agent Marketplace...</div>;
  }

  if (error && !mcpStatus) {
    return (
      <div className="marketplace-error">
        <h3>Error Loading Marketplace</h3>
        <p>{error}</p>
        <button onClick={fetchMCPStatus}>Retry</button>
      </div>
    );
  }

  return (
    <div className="agent-marketplace">
      <div className="marketplace-status">
        <div className="connection-status">
          <span className={`status-dot ${mcpStatus?.status === 'connected' ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            {mcpStatus?.status === 'connected' ? 'Connected' : 'Disconnected'} to Agent Network
          </span>
          {mcpStatus?.status !== 'connected' && (
            <button 
              className="reconnect-button" 
              onClick={reconnectMCP} 
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
        
        <div className="active-agents">
          <span className="agents-count">
            {mcpStatus?.agents?.length || 0} Active Agents
          </span>
        </div>
      </div>
      
      {deploymentStep === 0 ? renderAgentCatalog() : renderDeploymentFlow()}
    </div>
  );
}
