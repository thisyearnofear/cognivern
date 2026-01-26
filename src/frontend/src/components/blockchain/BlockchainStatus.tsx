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
    <div css={css`
      margin-top: ${designTokens.spacing[10]};
      width: 100%;
      max-width: 1200px;
    `}>
      <h3 css={css`
        font-size: ${designTokens.typography.fontSize.xl};
        font-weight: ${designTokens.typography.fontWeight.bold};
        margin-bottom: ${designTokens.spacing[6]};
        display: flex;
        align-items: center;
        gap: ${designTokens.spacing[2]};
      `}>
        🔗 Live Blockchain Infrastructure
      </h3>

      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
        gap: ${designTokens.spacing[6]};
      `}>
        {/* Governance Contract */}
        <div css={css`
          background: white;
          border-radius: ${designTokens.borderRadius.xl};
          padding: ${designTokens.spacing[6]};
          border: 1px solid ${designTokens.colors.neutral[200]};
          box-shadow: ${designTokens.shadows.sm};
        `}>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]}; margin-bottom: ${designTokens.spacing[4]};`}>
            <div css={css`font-size: 1.5rem;`}>🏛️</div>
            <h4 css={css`font-weight: bold; font-size: 1.1rem;`}>Governance Engine</h4>
          </div>
          
          <div css={css`
            background: ${designTokens.colors.neutral[50]};
            padding: ${designTokens.spacing[3]};
            border-radius: ${designTokens.borderRadius.md};
            margin-bottom: ${designTokens.spacing[6]};
            font-family: monospace;
            font-size: 0.85rem;
            color: ${designTokens.colors.neutral[600]};
            word-break: break-all;
            border: 1px solid ${designTokens.colors.neutral[200]};
          `}>
            <span css={css`color: ${designTokens.colors.primary[600]}; font-weight: bold; margin-right: 8px;`}>ADDR:</span>
            {stats.governance?.address || '0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880'}
          </div>

          <div css={css`display: grid; grid-template-columns: repeat(3, 1fr); gap: ${designTokens.spacing[4]};`}>
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.25rem; font-weight: bold; color: ${designTokens.colors.primary[600]};`}>{stats.governance?.policies || 2}</div>
              <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase;`}>Policies</div>
            </div>
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.25rem; font-weight: bold; color: ${designTokens.colors.primary[600]};`}>{stats.governance?.agents || 1}</div>
              <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase;`}>Agents</div>
            </div>
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.25rem; font-weight: bold; color: ${designTokens.colors.primary[600]};`}>{stats.governance?.actions || 1}</div>
              <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase;`}>Actions</div>
            </div>
          </div>
        </div>

        {/* Storage Contract */}
        <div css={css`
          background: white;
          border-radius: ${designTokens.borderRadius.xl};
          padding: ${designTokens.spacing[6]};
          border: 1px solid ${designTokens.colors.neutral[200]};
          box-shadow: ${designTokens.shadows.sm};
        `}>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]}; margin-bottom: ${designTokens.spacing[4]};`}>
            <div css={css`font-size: 1.5rem;`}>💾</div>
            <h4 css={css`font-weight: bold; font-size: 1.1rem;`}>Audit Storage</h4>
          </div>
          
          <div css={css`
            background: ${designTokens.colors.neutral[50]};
            padding: ${designTokens.spacing[3]};
            border-radius: ${designTokens.borderRadius.md};
            margin-bottom: ${designTokens.spacing[6]};
            font-family: monospace;
            font-size: 0.85rem;
            color: ${designTokens.colors.neutral[600]};
            word-break: break-all;
            border: 1px solid ${designTokens.colors.neutral[200]};
          `}>
            <span css={css`color: ${designTokens.colors.secondary[600]}; font-weight: bold; margin-right: 8px;`}>ADDR:</span>
            {stats.filecoin?.storageContract || '0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada'}
          </div>

          <div css={css`display: grid; grid-template-columns: repeat(3, 1fr); gap: ${designTokens.spacing[4]};`}>
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.25rem; font-weight: bold; color: ${designTokens.colors.secondary[600]};`}>{stats.governance?.actions || 1}</div>
              <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase;`}>Records</div>
            </div>
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.25rem; font-weight: bold; color: ${designTokens.colors.secondary[600]};`}>{stats.governance?.agents || 1}</div>
              <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase;`}>Nodes</div>
            </div>
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.25rem; font-weight: bold; color: ${designTokens.colors.secondary[600]};`}>{stats.governance?.policies || 2}</div>
              <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase;`}>Versions</div>
            </div>
          </div>
        </div>
      </div>

      <div css={css`
        margin-top: ${designTokens.spacing[6]};
        display: flex;
        justify-content: center;
        gap: ${designTokens.spacing[4]};
      `}>
        <span css={css`
          padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
          background: ${designTokens.colors.primary[50]};
          color: ${designTokens.colors.primary[700]};
          border-radius: ${designTokens.borderRadius.full};
          font-size: 0.8rem;
          font-weight: 600;
          border: 1px solid ${designTokens.colors.primary[100]};
        `}>
          🌐 Filecoin Calibration
        </span>
        <span css={css`
          padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
          background: ${designTokens.colors.semantic.success[50]};
          color: ${designTokens.colors.semantic.success[700]};
          border-radius: ${designTokens.borderRadius.full};
          font-size: 0.8rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid ${designTokens.colors.semantic.success[100]};
        `}>
          <span css={css`
            width: 8px;
            height: 8px;
            background: ${designTokens.colors.semantic.success[500]};
            border-radius: 50%;
            ${keyframeAnimations.pulse}
          `} />
          Live Network
        </span>
      </div>
    </div>
  );
}
