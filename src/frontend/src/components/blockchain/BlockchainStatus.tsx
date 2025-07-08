import { useState, useEffect } from "react";
import { getApiUrl } from "../../utils/api";
import "./BlockchainStatus.css";

interface ContractStats {
  filecoin: {
    network: string;
    chainId: number;
    rpcUrl: string;
    governanceContract: string;
    storageContract: string;
    usdcToken: string;
  };
  recall: {
    network: string;
    tradingAPI: string;
    configured: boolean;
  };
  governance: {
    address: string;
    policies: number;
    agents: number;
    actions: number;
    violations: number;
    approvalRate: number;
  };
}

export default function BlockchainStatus() {
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlockchainStats() {
      try {
        setLoading(true);
        const apiUrl = getApiUrl("/api/proxy/dashboard/unified");

        // Only log in development (removed for security)
        // No logging in production to prevent sensitive data exposure

        // In production, Vercel proxy handles authentication
        // In development, we need to include the API key
        const headers: Record<string, string> = {};
        if (import.meta.env.DEV) {
          const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
          headers["X-API-KEY"] = apiKey;
        }

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching blockchain stats:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStats(null);
      } finally {
        setLoading(false);
      }
    }

    fetchBlockchainStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBlockchainStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="blockchain-status loading">
        <div className="loading-spinner"></div>
        <p>Loading blockchain status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="blockchain-status error">
        <h3>⚠️ Blockchain Connection Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="blockchain-status error">
        <h3>📡 No Blockchain Data</h3>
        <p>Unable to fetch contract statistics</p>
      </div>
    );
  }

  return (
    <div className="blockchain-status">
      <h3>🔗 Live Blockchain Status</h3>

      <div className="contract-grid">
        <div className="contract-card governance">
          <h4>🏛️ Governance Contract</h4>
          <div className="contract-address">
            <span className="label">Address:</span>
            <code>
              {stats.governance.address.slice(0, 10)}...
              {stats.governance.address.slice(-8)}
            </code>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{stats.governance.policies}</span>
              <span className="label">Policies</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance.agents}</span>
              <span className="label">Agents</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance.actions}</span>
              <span className="label">Actions</span>
            </div>
          </div>
        </div>

        <div className="contract-card storage">
          <h4>💾 Storage Contract</h4>
          <div className="contract-address">
            <span className="label">Address:</span>
            <code>
              {stats.filecoin.storageContract.slice(0, 10)}...
              {stats.filecoin.storageContract.slice(-8)}
            </code>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{stats.governance.actions}</span>
              <span className="label">Total Actions</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance.agents}</span>
              <span className="label">Active Agents</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance.policies}</span>
              <span className="label">Policies</span>
            </div>
          </div>
        </div>
      </div>

      <div className="network-info">
        <span className="network-badge">🌐 Filecoin Calibration Testnet</span>
        <span className="status-badge live">🟢 Live</span>
      </div>
    </div>
  );
}
