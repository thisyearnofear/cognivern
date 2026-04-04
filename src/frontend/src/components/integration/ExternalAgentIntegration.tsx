import { useState, useEffect } from "react";
import { getApiHeaders, getApiUrl } from "../../utils/api";

interface ExternalAgent {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: "connected" | "pending" | "disconnected";
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
    name: "",
    type: "llm",
    provider: "openai",
    connectionUrl: "",
    apiKey: "",
    capabilities: [],
  });
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(
    [],
  );
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletInfo, setWalletInfo] = useState<any>(null);

  // Available capabilities
  const availableCapabilities = [
    "text-generation",
    "image-generation",
    "code-completion",
    "data-analysis",
    "document-processing",
    "chat",
    "embeddings",
    "fine-tuning",
  ];

  // Available providers
  const availableProviders = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google AI" },
    { value: "mistral", label: "Mistral AI" },
    { value: "openclaw", label: "OpenClaw" },
    { value: "hermes", label: "Hermes Agent" },
    { value: "custom", label: "Custom Provider" },
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
      const response = await fetch(getApiUrl("/external-agents"), {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching external agents:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load external agents",
      );
      // For demo purposes, set some sample agents
      setAgents([
        {
          id: "ext-1",
          name: "Research Agent",
          type: "llm",
          provider: "openai",
          status: "connected",
          connectionUrl: "https://api.openai.com/v1",
          capabilities: ["text-generation", "chat", "data-analysis"],
        },
        {
          id: "ext-2",
          name: "Procurement Agent",
          type: "llm",
          provider: "anthropic",
          status: "connected",
          connectionUrl: "https://api.anthropic.com/v1",
          capabilities: ["document-processing", "text-generation", "chat"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const checkWalletConnection = async () => {
    try {
      const response = await fetch(getApiUrl("/api/ows/wallets"), {
        headers: getApiHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          setWalletConnected(true);
          setWalletInfo(data.data[0]);
        } else {
          setWalletConnected(false);
        }
      } else {
        setWalletConnected(false);
      }
    } catch (err) {
      console.error("Error checking wallet connection:", err);
      setWalletConnected(false);
    }
  };

  const connectWallet = async () => {
    try {
      const response = await fetch(getApiUrl("/api/ows/bootstrap"), {
        method: "POST",
        headers: getApiHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setWalletConnected(true);
          setWalletInfo(data.data);
        }
      }
    } catch (err) {
      console.error("Error connecting wallet:", err);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Add privacy-preserving metadata for OpenClaw/Hermes
      const privacyConfig =
        newAgent.provider === "openclaw" || newAgent.provider === "hermes"
          ? {
              redactionEnabled: true,
              zkProofsRequired: true,
              localOnlyForensics: false,
            }
          : {
              redactionEnabled: false,
              zkProofsRequired: false,
              localOnlyForensics: false,
            };

      // Add capabilities to the new agent
      const agentWithCapabilities = {
        ...newAgent,
        capabilities: selectedCapabilities,
        privacyConfig,
      };

      const response = await fetch(getApiUrl("/external-agents"), {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(agentWithCapabilities),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // For demo purposes, add the agent locally
      const newAgentWithId: ExternalAgent = {
        id: `ext-${Date.now()}`,
        name: newAgent.name || "Unnamed Agent",
        type: newAgent.type || "llm",
        provider: newAgent.provider || "custom",
        status: "connected",
        connectionUrl: newAgent.connectionUrl,
        apiKey: newAgent.apiKey,
        capabilities: selectedCapabilities,
      };

      setAgents([...agents, newAgentWithId]);

      // Reset form
      setNewAgent({
        name: "",
        type: "llm",
        provider: "openai",
        connectionUrl: "",
        apiKey: "",
        capabilities: [],
      });
      setSelectedCapabilities([]);
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding external agent:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add external agent",
      );
    }
  };

  const toggleCapability = (capability: string) => {
    if (selectedCapabilities.includes(capability)) {
      setSelectedCapabilities(
        selectedCapabilities.filter((cap) => cap !== capability),
      );
    } else {
      setSelectedCapabilities([...selectedCapabilities, capability]);
    }
  };

  const disconnectAgent = async (agentId: string) => {
    try {
      const response = await fetch(
        `/api/external-agents/${agentId}/disconnect`,
        {
          method: "POST",
          headers: getApiHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Update agent status locally
      setAgents(
        agents.map((agent) =>
          agent.id === agentId ? { ...agent, status: "disconnected" } : agent,
        ),
      );
    } catch (err) {
      console.error("Error disconnecting agent:", err);
      setError(
        err instanceof Error ? err.message : "Failed to disconnect agent",
      );
    }
  };

  const reconnectAgent = async (agentId: string) => {
    try {
      const response = await fetch(
        getApiUrl(`/external-agents/${agentId}/connect`),
        {
          method: "POST",
          headers: getApiHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Update agent status locally
      setAgents(
        agents.map((agent) =>
          agent.id === agentId ? { ...agent, status: "connected" } : agent,
        ),
      );
    } catch (err) {
      console.error("Error reconnecting agent:", err);
      setError(
        err instanceof Error ? err.message : "Failed to reconnect agent",
      );
    }
  };

  const removeAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to remove this agent?")) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/external-agents/${agentId}`), {
        method: "DELETE",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Remove agent locally
      setAgents(agents.filter((agent) => agent.id !== agentId));
    } catch (err) {
      console.error("Error removing agent:", err);
      setError(err instanceof Error ? err.message : "Failed to remove agent");
    }
  };

  return (
    <div className="external-agent-integration">
      <div className="integration-header">
        <h2>Agent Spend Control</h2>
        <p>
          Connect external agents, assign governance boundaries, and review how
          every spend attempt is handled
        </p>
      </div>

      {!walletConnected && (
        <div className="wallet-connection-banner">
          <div className="banner-content">
            <div className="banner-icon">🔒</div>
            <div className="banner-text">
              <h3>No OWS Wallet Configured</h3>
              <p>
                Cognivern now expects an OWS local vault and delegated API keys
                for spend execution. Bootstrap a wallet to enable live governed
                spend from this workspace.
              </p>
            </div>
            <button className="connect-wallet-button" onClick={connectWallet}>
              Bootstrap Wallet
            </button>
          </div>
        </div>
      )}

      {walletConnected && walletInfo && (
        <div className="wallet-info">
          <div className="wallet-status">
            <div className="status-dot connected"></div>
            <span>Execution Wallet Connected</span>
          </div>
          <div className="wallet-address">
            {walletInfo.accounts?.[0]?.address
              ? `Address: ${walletInfo.accounts[0].address.substring(0, 6)}...${walletInfo.accounts[0].address.substring(walletInfo.accounts[0].address.length - 4)}`
              : "No accounts available"}
          </div>
          <div className="wallet-balance">Wallet: {walletInfo.name}</div>
        </div>
      )}

      <div className="agents-controls">
        <button
          className="add-agent-button"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Agent"}
        </button>
        <button
          className="refresh-button"
          onClick={fetchAgents}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <div className="add-agent-form">
          <h3>Add Managed Agent</h3>
          <form onSubmit={handleAddAgent}>
            <div className="form-group">
              <label>Agent Name</label>
              <input
                type="text"
                value={newAgent.name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
                placeholder="Enter agent name"
                required
              />
            </div>

            <div className="form-group">
              <label>Provider</label>
              <select
                value={newAgent.provider}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, provider: e.target.value })
                }
                required
              >
                {availableProviders.map((provider) => (
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
                onChange={(e) =>
                  setNewAgent({ ...newAgent, connectionUrl: e.target.value })
                }
                placeholder="API endpoint URL"
                required
              />
            </div>

            <div className="form-group">
              <label>Agent Credential</label>
              <input
                type="password"
                value={newAgent.apiKey}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, apiKey: e.target.value })
                }
                placeholder="Enter API key or integration secret"
                required
              />
            </div>

            <div className="form-group">
              <label>Capabilities</label>
              <div className="capabilities-grid">
                {availableCapabilities.map((capability) => (
                  <div
                    key={capability}
                    className={`capability-option ${selectedCapabilities.includes(capability) ? "selected" : ""}`}
                    onClick={() => toggleCapability(capability)}
                  >
                    <div className="checkbox">
                      {selectedCapabilities.includes(capability) && (
                        <span className="checkmark">✓</span>
                      )}
                    </div>
                    <span>{capability}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="submit-button">
                Save Agent
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
            <p>No managed agents connected yet.</p>
            <p>Click "Add Agent" to create your first governed agent entry.</p>
          </div>
        ) : (
          agents.map((agent) => (
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
                  {agent.capabilities.map((capability) => (
                    <span key={capability} className="capability-tag">
                      {capability}
                    </span>
                  ))}
                </div>
              </div>

              <div className="agent-actions">
                {agent.status === "connected" ? (
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
        <h3>How Agent Spend Control Works</h3>
        <div className="integration-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Register The Agent</h4>
              <p>
                Store the endpoint and credential used to identify the agent
                inside your control plane
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Apply Spend Guardrails</h4>
              <p>
                Assign policies, budgets, restrictions, and approval thresholds
                before the agent can act
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Review Evidence</h4>
              <p>
                Track approvals, denials, and held actions through the audit log
                and run ledger
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
