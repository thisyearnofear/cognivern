import { useState, useEffect } from 'react';
import './BlockchainStatus.css';

interface ContractStats {
  governance: {
    address: string;
    policies: number;
    agents: number;
    actions: number;
  };
  storage: {
    address: string;
    total: number;
    active: number;
    completed: number;
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
        const response = await fetch('/api/blockchain/stats', {
          headers: {
            'X-API-KEY': import.meta.env.VITE_API_KEY || 'development-api-key',
          },
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching blockchain stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
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
            <code>{stats.governance.address.slice(0, 10)}...{stats.governance.address.slice(-8)}</code>
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
            <code>{stats.storage.address.slice(0, 10)}...{stats.storage.address.slice(-8)}</code>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{stats.storage.total}</span>
              <span className="label">Total Requests</span>
            </div>
            <div className="stat">
              <span className="value">{stats.storage.active}</span>
              <span className="label">Active</span>
            </div>
            <div className="stat">
              <span className="value">{stats.storage.completed}</span>
              <span className="label">Completed</span>
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