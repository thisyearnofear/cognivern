import React, { useState } from 'react';
import { css } from '@emotion/react';
import { useAppStore } from '../../stores/appStore';
import { designTokens, easings } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Wallet, Shield, Lock, ChevronRight, CheckCircle2, Activity } from 'lucide-react';
import { owsApi } from '../../services/apiService';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose }) => {
  const { user, setUser } = useAppStore();
  const { isMobile } = useBreakpoint();

  const [isConnectingIdentity, setIsConnectingIdentity] = useState(false);
  const [isConnectingTreasury, setIsConnectingTreasury] = useState(false);

  const handleConnectBrowserWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnectingIdentity(true);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const address = accounts[0];
        let network: 'filecoin' | 'xlayer' = 'filecoin';

        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const chainId = parseInt(chainIdHex, 16);
          if (chainId === 195 || chainId === 196 || chainId === 1952) {
            network = 'xlayer';
          }
        } catch (e) {
          // Default to filecoin
        }

        setUser({
          address,
          isConnected: true,
          network,
        });
      }
    } catch (error) {
      console.error('Failed to connect browser wallet:', error);
    } finally {
      setIsConnectingIdentity(false);
    }
  };

  const handleBootstrapTreasury = async () => {
    setIsConnectingTreasury(true);
    try {
      const res = await owsApi.bootstrap();
      const data = res?.data as any;
      const address = data?.accounts?.[0]?.address || data?.address || '';
      const name = data?.name || 'Cognivern Treasury';
      const chain = data?.accounts?.[0]?.chainId || data?.chainType || 'eip155:314159';

      setUser({
        owsWalletConnected: true,
        owsWalletAddress: address,
        owsWalletName: name,
        owsWalletChain: chain,
      });
    } catch (error) {
      console.error('Failed to bootstrap wallet:', error);
    } finally {
      setIsConnectingTreasury(false);
    }
  };

  const handleConnectFhenix = () => {
    // Trigger the hidden CoFHE Portal button
    const cofheBtn = document.querySelector('.cofhe-floating-button');
    if (cofheBtn) {
      (cofheBtn as HTMLElement).click();
      // Optimistically set fhenix connected state (or let the user do it in the modal)
      setUser({ fhenixConnected: true });
      onClose(); // Close our modal so they can see the Fhenix modal
    } else {
      console.error('CoFHE Portal button not found. Make sure FhenixProvider is wrapping the app.');
    }
  };

  const optionCardStyle = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${designTokens.spacing[4]};
    border: 1px solid ${designTokens.colors.neutral[200]};
    border-radius: ${designTokens.borderRadius.lg};
    background: var(--surface-bg-alt, ${designTokens.colors.neutral[50]});
    transition: ${easings.smooth};
    cursor: pointer;
    margin-bottom: ${designTokens.spacing[3]};

    &:hover {
      border-color: ${designTokens.colors.primary[300]};
      background: var(--surface-bg, ${designTokens.colors.neutral[0]});
      transform: translateY(-2px);
      box-shadow: ${designTokens.shadows.md};
    }
  `;

  const connectedCardStyle = css`
    ${optionCardStyle}
    border-color: ${designTokens.colors.semantic.success[300]};
    background: ${designTokens.colors.semantic.success[50]};

    &:hover {
      border-color: ${designTokens.colors.semantic.success[400]};
      transform: none;
      box-shadow: none;
      cursor: default;
    }
  `;

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect to Cognivern" size="md">
      <div css={css`padding: ${designTokens.spacing[2]} 0;`}>

        {/* User Identity */}
        <div css={css`margin-bottom: ${designTokens.spacing[5]};`}>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[2]}; margin-bottom: ${designTokens.spacing[2]};`}>
            <Wallet size={18} color={designTokens.colors.primary[600]} />
            <h4 css={css`margin: 0; font-size: ${designTokens.typography.fontSize.md}; color: var(--text-primary);`}>User Identity</h4>
          </div>
          <p css={css`margin: 0 0 ${designTokens.spacing[3]} 0; font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>
            Connect your personal wallet to sign approvals.
          </p>

          {user.isConnected ? (
            <div css={connectedCardStyle}>
              <div>
                <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>Browser Wallet</div>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>{formatAddress(user.address || '')}</div>
              </div>
              <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
            </div>
          ) : (
            <div css={optionCardStyle} onClick={handleConnectBrowserWallet}>
              <div>
                <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>MetaMask / Browser Wallet</div>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>Connect via window.ethereum</div>
              </div>
              {isConnectingIdentity ? <Activity size={20} css={css`animation: spin 2s linear infinite;`} /> : <ChevronRight size={20} color={designTokens.colors.neutral[400]} />}
            </div>
          )}
        </div>

        {/* Governance Treasury */}
        <div css={css`margin-bottom: ${designTokens.spacing[5]};`}>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[2]}; margin-bottom: ${designTokens.spacing[2]};`}>
            <Shield size={18} color={designTokens.colors.primary[600]} />
            <h4 css={css`margin: 0; font-size: ${designTokens.typography.fontSize.md}; color: var(--text-primary);`}>Governance Treasury</h4>
          </div>
          <p css={css`margin: 0 0 ${designTokens.spacing[3]} 0; font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>
            The vault your agents use to execute trades.
          </p>

          {user.owsWalletConnected ? (
            <div css={connectedCardStyle}>
              <div>
                <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>{user.owsWalletName || 'Local Vault (OWS)'}</div>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>{formatAddress(user.owsWalletAddress || '')}</div>
              </div>
              <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
            </div>
          ) : (
            <div css={optionCardStyle} onClick={handleBootstrapTreasury}>
              <div>
                <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>Create New Treasury</div>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>Bootstrap a local OWS Vault</div>
              </div>
              {isConnectingTreasury ? <Activity size={20} css={css`animation: spin 2s linear infinite;`} /> : <ChevronRight size={20} color={designTokens.colors.neutral[400]} />}
            </div>
          )}
        </div>

        {/* Confidential Compute */}
        <div css={css`margin-bottom: ${designTokens.spacing[2]};`}>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[2]}; margin-bottom: ${designTokens.spacing[2]};`}>
            <Lock size={18} color={designTokens.colors.primary[600]} />
            <h4 css={css`margin: 0; font-size: ${designTokens.typography.fontSize.md}; color: var(--text-primary);`}>Confidential Compute</h4>
          </div>
          <p css={css`margin: 0 0 ${designTokens.spacing[3]} 0; font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>
            Enable encrypted policy execution.
          </p>

          {user.fhenixConnected ? (
            <div css={connectedCardStyle}>
              <div>
                <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>Fhenix CoFHE Connected</div>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>Confidential Network Ready</div>
              </div>
              <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
            </div>
          ) : (
            <div css={optionCardStyle} onClick={handleConnectFhenix}>
              <div>
                <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>Connect Fhenix CoFHE</div>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>Required for encrypted spend limits</div>
              </div>
              <ChevronRight size={20} color={designTokens.colors.neutral[400]} />
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
};
