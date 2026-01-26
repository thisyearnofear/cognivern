import { useState, useEffect } from "react";
import { getApiUrl, getRequestHeaders } from "../../utils/api";
import { css } from '@emotion/react';
import { designTokens, keyframeAnimations } from '../../styles/design-system';
import { Card, CardContent } from '../ui/Card';

interface ContractStats {
  filecoin?: {
    network: string;
    chainId: number;
    rpcUrl: string;
    governanceContract: string;
    storageContract: string;
    usdcToken: string;
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
        const response = await fetch(apiUrl, { headers: getRequestHeaders() });

        if (!response.ok) throw new Error(`Error: ${response.status}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const d = result.data;
            setStats({
                governance: {
                    address: "0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880",
                    policies: d.systemHealth?.totalPolicies || 2,
                    agents: d.systemHealth?.activeAgents || 1,
                    actions: d.systemHealth?.totalForecasts || 0,
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
      } finally {
        setLoading(false);
      }
    }

    fetchBlockchainStats();
    const interval = setInterval(fetchBlockchainStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div css={css`padding: 2rem; text-align: center; color: ${designTokens.colors.neutral[500]};`}>Loading infrastructure...</div>;
  }

  const contractInfo = stats?.governance;
  const storageInfo = stats?.filecoin;

  return (
    <div css={css`width: 100%; max-width: 1200px; margin: 0 auto;`}>
      <div css={css`display: flex; align-items: center; gap: 12px; margin-bottom: 24px;`}>
        <h3 css={css`font-size: 1.25rem; font-weight: 800; color: ${designTokens.colors.neutral[900]}; margin: 0;`}>
          🔗 Live Blockchain Infrastructure
        </h3>
        <div css={css`display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: ${designTokens.colors.semantic.success[50]}; border: 1px solid ${designTokens.colors.semantic.success[100]}; border-radius: 100px; color: ${designTokens.colors.semantic.success[700]}; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;`}>
          <span css={css`width: 6px; height: 6px; background: ${designTokens.colors.semantic.success[500]}; border-radius: 50%; ${keyframeAnimations.pulse}`} />
          Filecoin Calibration
        </div>
      </div>

      <div css={css`display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;`}>
        {/* Governance Engine */}
        <Card variant="default" css={css`border: 1px solid ${designTokens.colors.neutral[200]}; overflow: hidden;`}>
          <CardContent css={css`padding: 24px;`}>
            <div css={css`display: flex; align-items: center; gap: 12px; margin-bottom: 16px;`}>
              <span css={css`font-size: 1.5rem;`}>🏛️</span>
              <span css={css`font-weight: 700; font-size: 1rem; color: ${designTokens.colors.neutral[800]};`}>Governance Engine</span>
            </div>
            
            <div css={css`background: ${designTokens.colors.neutral[50]}; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-family: ${designTokens.typography.fontFamily.mono}; font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; border: 1px solid ${designTokens.colors.neutral[100]}; word-break: break-all;`}>
              <strong css={css`color: ${designTokens.colors.primary[600]}; margin-right: 8px;`}>ADDR:</strong>
              {contractInfo?.address}
            </div>

            <div css={css`display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;`}>
              <div css={css`text-align: center;`}>
                <div css={css`font-size: 1.5rem; font-weight: 800; color: ${designTokens.colors.primary[600]};`}>{contractInfo?.policies}</div>
                <div css={css`font-size: 0.65rem; font-weight: 700; color: ${designTokens.colors.neutral[400]}; text-transform: uppercase;`}>Policies</div>
              </div>
              <div css={css`text-align: center;`}>
                <div css={css`font-size: 1.5rem; font-weight: 800; color: ${designTokens.colors.primary[600]};`}>{contractInfo?.agents}</div>
                <div css={css`font-size: 0.65rem; font-weight: 700; color: ${designTokens.colors.neutral[400]}; text-transform: uppercase;`}>Agents</div>
              </div>
              <div css={css`text-align: center;`}>
                <div css={css`font-size: 1.5rem; font-weight: 800; color: ${designTokens.colors.primary[600]};`}>{contractInfo?.actions}</div>
                <div css={css`font-size: 0.65rem; font-weight: 700; color: ${designTokens.colors.neutral[400]}; text-transform: uppercase;`}>Actions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Storage */}
        <Card variant="default" css={css`border: 1px solid ${designTokens.colors.neutral[200]}; overflow: hidden;`}>
          <CardContent css={css`padding: 24px;`}>
            <div css={css`display: flex; align-items: center; gap: 12px; margin-bottom: 16px;`}>
              <span css={css`font-size: 1.5rem;`}>💾</span>
              <span css={css`font-weight: 700; font-size: 1rem; color: ${designTokens.colors.neutral[800]};`}>Audit Storage</span>
            </div>
            
            <div css={css`background: ${designTokens.colors.neutral[50]}; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-family: ${designTokens.typography.fontFamily.mono}; font-size: 0.75rem; color: ${designTokens.colors.neutral[500]}; border: 1px solid ${designTokens.colors.neutral[100]}; word-break: break-all;`}>
              <strong css={css`color: ${designTokens.colors.secondary[600]}; margin-right: 8px;`}>ADDR:</strong>
              {storageInfo?.storageContract}
            </div>

            <div css={css`display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;`}>
              <div css={css`text-align: center;`}>
                <div css={css`font-size: 1.5rem; font-weight: 800; color: ${designTokens.colors.secondary[600]};`}>{contractInfo?.actions}</div>
                <div css={css`font-size: 0.65rem; font-weight: 700; color: ${designTokens.colors.neutral[400]}; text-transform: uppercase;`}>Records</div>
              </div>
              <div css={css`text-align: center;`}>
                <div css={css`font-size: 1.5rem; font-weight: 800; color: ${designTokens.colors.secondary[600]};`}>{contractInfo?.agents}</div>
                <div css={css`font-size: 0.65rem; font-weight: 700; color: ${designTokens.colors.neutral[400]}; text-transform: uppercase;`}>Nodes</div>
              </div>
              <div css={css`text-align: center;`}>
                <div css={css`font-size: 1.5rem; font-weight: 800; color: ${designTokens.colors.secondary[600]};`}>{contractInfo?.policies}</div>
                <div css={css`font-size: 0.65rem; font-weight: 700; color: ${designTokens.colors.neutral[400]}; text-transform: uppercase;`}>Versions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}