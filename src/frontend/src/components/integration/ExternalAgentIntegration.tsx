import { useState, useEffect } from "react";
import { getApiHeaders, getApiUrl } from "../../utils/api";

interface OwsApiKey {
  id: string;
  name: string;
  createdAt: string;
  walletIds: string[];
  policyIds: string[];
}

interface OwsWallet {
  id: string;
  name: string;
  accounts: Array<{ address: string }>;
}

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
  const [walletInfo, setWalletInfo] = useState<OwsWallet | null>(null);
  const [apiKeys, setApiKeys] = useState<OwsApiKey[]>([]);
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyWallet, setNewApiKeyWallet] = useState("");
  const [createdApiKeyToken, setCreatedApiKeyToken] = useState<string | null>(
    null,
  );

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
      const [walletsRes, apiKeysRes] = await Promise.all([
        fetch(getApiUrl("/api/ows/wallets"), { headers: getApiHeaders() }),
        fetch(getApiUrl("/api/ows/api-keys"), { headers: getApiHeaders() }),
      ]);

      if (walletsRes.ok) {
        const walletData = await walletsRes.json();
        if (
          walletData.success &&
          walletData.data &&
          walletData.data.length > 0
        ) {
          setWalletConnected(true);
          setWalletInfo(walletData.data[0]);
          setNewApiKeyWallet(walletData.data[0].id);
        } else {
          setWalletConnected(false);
        }
      } else {
        setWalletConnected(false);
      }

      if (apiKeysRes.ok) {
        const apiKeyData = await apiKeysRes.json();
        if (apiKeyData.success && apiKeyData.data) {
          setApiKeys(apiKeyData.data);
        }
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
          setNewApiKeyWallet(data.data.id);
          await checkWalletConnection();
        }
      }
    } catch (err) {
      console.error("Error connecting wallet:", err);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newApiKeyName || !newApiKeyWallet) return;

    try {
      const response = await fetch(getApiUrl("/api/ows/api-keys"), {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newApiKeyName,
          walletIds: [newApiKeyWallet],
          policyIds: [],
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.token) {
        setCreatedApiKeyToken(data.data.token);
        setNewApiKeyName("");
        await checkWalletConnection();
      }
    } catch (err) {
      console.error("Error creating API key:", err);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this API key? This cannot be undone.",
      )
    )
      return;

    try {
      const response = await fetch(getApiUrl(`/api/ows/api-keys/${keyId}`), {
        method: "DELETE",
        headers: getApiHeaders(),
      });

      if (response.ok) {
        await checkWalletConnection();
      }
    } catch (err) {
      console.error("Error deleting API key:", err);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1. Create OWS Agent
      const agentType =
        newAgent.provider === "openclaw"
          ? "procurement"
          : newAgent.provider === "hermes"
            ? "research"
            : "governance";

      const agentResponse = await fetch(getApiUrl("/api/ows/agents"), {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAgent.name,
          description: `External agent via ${newAgent.provider}`,
          type: agentType,
          metadata: {
            provider: newAgent.provider,
            connectionUrl: newAgent.connectionUrl,
            capabilities: selectedCapabilities,
            isExternal: true,
          },
        }),
      });

      if (!agentResponse.ok) {
        throw new Error("Failed to register agent");
      }

      const agentData = await agentResponse.json();

      // 2. Get wallet ID for API key
      const walletsRes = await fetch(getApiUrl("/api/ows/wallets"), {
        headers: getApiHeaders(),
      });
      const walletsJson = await walletsRes.json();
      const wallets = walletsJson.success ? walletsJson.data || [] : [];

      if (wallets.length === 0) {
        throw new Error("No wallet available - please connect wallet first");
      }

      // 3. Create scoped API key for the agent
      const apiKeyResponse = await fetch(getApiUrl("/api/ows/api-keys"), {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${newAgent.name}-key`,
          walletIds: [wallets[0].id],
          policyIds: [],
        }),
      });

      let apiKeyData = null;
      if (apiKeyResponse.ok) {
        const apiKeyResult = await apiKeyResponse.json();
        apiKeyData = apiKeyResult.data;
      }

      // Add to local state with OWS status
      const newAgentWithId: ExternalAgent = {
        id: agentData.data?.id || `ext-${Date.now()}`,
        name: newAgent.name || "Unnamed Agent",
        type: newAgent.type || "llm",
        provider: newAgent.provider || "custom",
        status: "connected",
        connectionUrl: newAgent.connectionUrl,
        apiKey: apiKeyData?.token || "",
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

      // Refresh wallet connection to see new agent
      await checkWalletConnection();
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

      {/* API Key Management */}
      {walletConnected && (
        <div
          className="api-keys-section"
          style={{
            marginTop: "24px",
            padding: "16px",
            background: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
              API Keys
            </h3>
            <button
              onClick={() => setShowApiKeyForm(!showApiKeyForm)}
              style={{
                padding: "6px 12px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              {showApiKeyForm ? "Cancel" : "+ Create Key"}
            </button>
          </div>

          {createdApiKeyToken && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                background: "#ecfdf5",
                border: "1px solid #10b981",
                borderRadius: "6px",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontWeight: 600,
                  color: "#065f46",
                }}
              >
                API Key Created (copy now - won't show again)
              </p>
              <code
                style={{
                  display: "block",
                  padding: "8px",
                  background: "white",
                  borderRadius: "4px",
                  fontSize: "13px",
                  wordBreak: "break-all",
                }}
              >
                {createdApiKeyToken}
              </code>
              <button
                onClick={() => setCreatedApiKeyToken(null)}
                style={{
                  marginTop: "8px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  background: "transparent",
                  border: "1px solid #10b981",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                I've copied it
              </button>
            </div>
          )}

          {showApiKeyForm && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  Key Name
                </label>
                <input
                  type="text"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                  placeholder="e.g., Trading Agent Key"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                />
              </div>
              <button
                onClick={handleCreateApiKey}
                disabled={!newApiKeyName || !newApiKeyWallet}
                style={{
                  padding: "8px 16px",
                  background:
                    newApiKeyName && newApiKeyWallet ? "#2563eb" : "#9ca3af",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    newApiKeyName && newApiKeyWallet
                      ? "pointer"
                      : "not-allowed",
                  fontSize: "14px",
                }}
              >
                Create API Key
              </button>
            </div>
          )}

          {apiKeys.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>
              No API keys yet. Create one to give agents wallet access.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    background: "white",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontWeight: 500,
                        fontSize: "14px",
                      }}
                    >
                      {key.name}
                    </p>
                    <p
                      style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}
                    >
                      Created: {new Date(key.createdAt).toLocaleDateString()} •{" "}
                      {key.walletIds.length} wallet(s)
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteApiKey(key.id)}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      color: "#dc2626",
                      border: "1px solid #dc2626",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
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
