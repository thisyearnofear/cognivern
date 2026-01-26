import { useState, useEffect } from "react";
import { getApiUrl, getRequestHeaders } from "../../utils/api";
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';

interface ContractStats {
  filecoin?: {
    network: string;
    chainId: number;
    rpcUrl: string;
    governanceContract: string;
    storageContract: string;
    usdcToken: string;
  };
  recall?: {
    network: string;
    tradingAPI: string;
    configured: boolean;
  };
  governance?: {
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
        const apiUrl = getApiUrl("/api/dashboard/unified");

        const response = await fetch(apiUrl, { 
          headers: getRequestHeaders() 
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const result = await response.json();
        
        // Map unified data to component format
        if (result.success && result.data) {
            const d = result.data;
            setStats({
                governance: {
                    address: "0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880",
                    policies: d.systemHealth?.totalPolicies || 0,
                    agents: d.systemHealth?.totalAgents || 1,
                    actions: d.systemHealth?.totalActions || 0,
                    violations: 0,
                    approvalRate: 100
                },
                filecoin: {
                    network: "Calibration",
                    chainId: 314159,
                    rpcUrl: "https://api.calibration.node.glif.io/rpc/v1",
                    governanceContract: "0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880",
                    storageContract: "0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada",
                    usdcToken: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"
                }
            });
        }
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
              {stats.governance?.address ? (
                `${stats.governance.address.slice(0, 10)}...${stats.governance.address.slice(-8)}`
              ) : (
                'Not available'
              )}
            </code>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{stats.governance?.policies || 0}</span>
              <span className="label">Policies</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance?.agents || 0}</span>
              <span className="label">Agents</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance?.actions || 0}</span>
              <span className="label">Actions</span>
            </div>
          </div>
        </div>

        <div className="contract-card storage">
          <h4>💾 Storage Contract</h4>
          <div className="contract-address">
            <span className="label">Address:</span>
            <code>
              {stats.filecoin?.storageContract ? (
                `${stats.filecoin.storageContract.slice(0, 10)}...${stats.filecoin.storageContract.slice(-8)}`
              ) : (
                'Not available'
              )}
            </code>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{stats.governance?.actions || 0}</span>
              <span className="label">Total Actions</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance?.agents || 0}</span>
              <span className="label">Active Agents</span>
            </div>
            <div className="stat">
              <span className="value">{stats.governance?.policies || 0}</span>
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
