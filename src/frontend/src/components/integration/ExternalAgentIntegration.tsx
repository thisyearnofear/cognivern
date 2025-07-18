import { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { designTokens, tradingStyles } from '../../styles/designTokens';

interface ExternalAgent {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: 'connected' | 'pending' | 'disconnected';
  connectionUrl?: string;
  apiKey?: string;
  capabilities: string[];
}

export default function ExternalAgentIntegration() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgent, setNewAgent] = useState<Partial<ExternalAgent>>({
    name: '',
    type: 'llm',
    provider: 'openai',
    connectionUrl: '',
    apiKey: '',
    capabilities: []
  });
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletInfo, setWalletInfo] = useState<any>(null);

  // Available capabilities
  const availableCapabilities = [
    'text-generation',
    'image-generation',
    'code-completion',
    'data-analysis',
    'document-processing',
    'chat',
    'embeddings',
    'fine-tuning'
  ];

  // Available providers
  const availableProviders = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'google', label: 'Google AI' },
    { value: 'mistral', label: 'Mistral AI' },
    { value: 'custom', label: 'Custom Provider' }
  ];

  // Fetch external agents
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch wallet status
  useEffect(() => {
    checkWalletConnection();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/external-agents', {
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching external agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load external agents');
      // For demo purposes, set some sample agents
      setAgents([
        {
          id: 'ext-1',
          name: 'GPT-4 Assistant',
          type: 'llm',
          provider: 'openai',
          status: 'connected',
          connectionUrl: 'https://api.openai.com/v1',
          capabilities: ['text-generation', 'chat', 'code-completion']
        },
        {
          id: 'ext-2',
          name: 'Claude Document Processor',
          type: 'llm',
          provider: 'anthropic',
          status: 'connected',
          connectionUrl: 'https://api.anthropic.com/v1',
          capabilities: ['document-processing', 'text-generation']
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const checkWalletConnection = async () => {
    try {
      const response = await fetch('/api/wallet/info', {
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.wallet) {
          setWalletConnected(true);
          setWalletInfo(data.wallet);
        } else {
          setWalletConnected(false);
        }
      } else {
        setWalletConnected(false);
      }
    } catch (err) {
      console.error('Error checking wallet connection:', err);
      setWalletConnected(false);
    }
  };

  const connectWallet = async () => {
    try {
      const response = await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.wallet) {
          setWalletConnected(true);
          setWalletInfo(data.wallet);
        }
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Add capabilities to the new agent
      const agentWithCapabilities = {
        ...newAgent,
        capabilities: selectedCapabilities
      };
      
      const response = await fetch('/api/external-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        },
        body: JSON.stringify(agentWithCapabilities)
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // For demo purposes, add the agent locally
      const newAgentWithId: ExternalAgent = {
        id: `ext-${Date.now()}`,
        name: newAgent.name || 'Unnamed Agent',
        type: newAgent.type || 'llm',
        provider: newAgent.provider || 'custom',
        status: 'connected',
        connectionUrl: newAgent.connectionUrl,
        apiKey: newAgent.apiKey,
        capabilities: selectedCapabilities
      };
      
      setAgents([...agents, newAgentWithId]);
      
      // Reset form
      setNewAgent({
        name: '',
        type: 'llm',
        provider: 'openai',
        connectionUrl: '',
        apiKey: '',
        capabilities: []
      });
      setSelectedCapabilities([]);
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding external agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to add external agent');
    }
  };

  const toggleCapability = (capability: string) => {
    if (selectedCapabilities.includes(capability)) {
      setSelectedCapabilities(selectedCapabilities.filter(cap => cap !== capability));
    } else {
      setSelectedCapabilities([...selectedCapabilities, capability]);
    }
  };

  const disconnectAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/external-agents/${agentId}/disconnect`, {
        method: 'POST',
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Update agent status locally
      setAgents(agents.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'disconnected' } 
          : agent
      ));
    } catch (err) {
      console.error('Error disconnecting agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect agent');
    }
  };

  const reconnectAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/external-agents/${agentId}/connect`, {
        method: 'POST',
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Update agent status locally
      setAgents(agents.map(agent => 
        agent.id === agentId 
          ? { ...agent, status: 'connected' } 
          : agent
      ));
    } catch (err) {
      console.error('Error reconnecting agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to reconnect agent');
    }
  };

  const removeAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/external-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456'
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Remove agent locally
      setAgents(agents.filter(agent => agent.id !== agentId));
    } catch (err) {
      console.error('Error removing agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove agent');
    }
  };

  return (
    <div className="external-agent-integration">
      <div className="integration-header">
        <h2>External Agent Integration</h2>
        <p>Connect your existing AI agents to our governance platform</p>
      </div>
      
      {!walletConnected && (
        <div className="wallet-connection-banner">
          <div className="banner-content">
            <div className="banner-icon">🔒</div>
            <div className="banner-text">
              <h3>Connect Your Bitte Wallet</h3>
              <p>Connect your wallet to enable secure agent deployments and onchain tracking</p>
            </div>
            <button className="connect-wallet-button" onClick={connectWallet}>
              Connect Wallet
            </button>
          </div>
        </div>
      )}
      
      {walletConnected && walletInfo && (
        <div className="wallet-info">
          <div className="wallet-status">
            <div className="status-dot connected"></div>
            <span>Wallet Connected</span>
          </div>
          <div className="wallet-address">
            Address: {walletInfo.address.substring(0, 6)}...{walletInfo.address.substring(walletInfo.address.length - 4)}
          </div>
          <div className="wallet-balance">
            Balance: {walletInfo.balance}
          </div>
        </div>
      )}
      
      <div className="agents-controls">
        <button 
          className="add-agent-button"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add External Agent'}
        </button>
        <button 
          className="refresh-button"
          onClick={fetchAgents}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {showAddForm && (
        <div className="add-agent-form">
          <h3>Add New External Agent</h3>
          <form onSubmit={handleAddAgent}>
            <div className="form-group">
              <label>Agent Name</label>
              <input 
                type="text" 
                value={newAgent.name} 
                onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                placeholder="Enter agent name"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Provider</label>
              <select 
                value={newAgent.provider} 
                onChange={(e) => setNewAgent({...newAgent, provider: e.target.value})}
                required
              >
                {availableProviders.map(provider => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Connection URL</label>
              <input 
                type="text" 
                value={newAgent.connectionUrl} 
                onChange={(e) => setNewAgent({...newAgent, connectionUrl: e.target.value})}
                placeholder="API endpoint URL"
                required
              />
            </div>
            
            <div className="form-group">
              <label>API Key</label>
              <input 
                type="password" 
                value={newAgent.apiKey} 
                onChange={(e) => setNewAgent({...newAgent, apiKey: e.target.value})}
                placeholder="Enter API key"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Capabilities</label>
              <div className="capabilities-grid">
                {availableCapabilities.map(capability => (
                  <div 
                    key={capability} 
                    className={`capability-option ${selectedCapabilities.includes(capability) ? 'selected' : ''}`}
                    onClick={() => toggleCapability(capability)}
                  >
                    <div className="checkbox">
                      {selectedCapabilities.includes(capability) && <span className="checkmark">✓</span>}
                    </div>
                    <span>{capability}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="submit-button">
                Add Agent
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="agents-list">
        {loading ? (
          <div className="loading">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="no-agents">
            <p>No external agents connected yet.</p>
            <p>Click "Add External Agent" to connect your first agent.</p>
          </div>
        ) : (
          agents.map(agent => (
            <div key={agent.id} className={`agent-card ${agent.status}`}>
              <div className="agent-header">
                <h3>{agent.name}</h3>
                <div className={`agent-status ${agent.status}`}>
                  {agent.status}
                </div>
              </div>
              
              <div className="agent-details">
                <div className="detail-item">
                  <span className="detail-label">Provider:</span>
                  <span className="detail-value">{agent.provider}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Type:</span>
                  <span className="detail-value">{agent.type}</span>
                </div>
                {agent.connectionUrl && (
                  <div className="detail-item">
                    <span className="detail-label">URL:</span>
                    <span className="detail-value">{agent.connectionUrl}</span>
                  </div>
                )}
              </div>
              
              <div className="agent-capabilities">
                <h4>Capabilities</h4>
                <div className="capabilities-list">
                  {agent.capabilities.map(capability => (
                    <span key={capability} className="capability-tag">
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="agent-actions">
                {agent.status === 'connected' ? (
                  <button 
                    className="disconnect-button"
                    onClick={() => disconnectAgent(agent.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button 
                    className="reconnect-button"
                    onClick={() => reconnectAgent(agent.id)}
                  >
                    Reconnect
                  </button>
                )}
                <button 
                  className="remove-button"
                  onClick={() => removeAgent(agent.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="integration-info">
        <h3>How External Agent Integration Works</h3>
        <div className="integration-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Connect Your Agent</h4>
              <p>Provide your agent's API endpoint and authentication details</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Apply Governance Policies</h4>
              <p>Select which governance policies to apply to your external agent</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Monitor & Audit</h4>
              <p>Track all agent actions through our comprehensive audit system</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
