import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { useAppStore } from '../../stores/appStore';
import { designTokens, easings } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Wallet, Shield, Lock, ChevronRight, CheckCircle2, Activity, Unlink } from 'lucide-react';
import { owsApi } from '../../services/apiService';

// CoFHE types - these may vary based on @cofhe/react version
// Using dynamic import or optional chaining to handle various versions
interface CofheClient {
  isConnected?: boolean;
  account?: string;
  disconnect?: () => Promise<void>;
}

// Try to import from @cofhe/react, fallback gracefully
let useCofheContext: any = null;
try {
  const cofheModule = require('@cofhe/react');
  useCofheContext = cofheModule.useCofheContext;
} catch (e) {
  console.warn('CoFHE module not available:', e);
}

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose }) => {
  const { user, setUser } = useAppStore();
  const { isMobile } = useBreakpoint();

  const [isConnectingIdentity, setIsConnectingIdentity] = useState(false);
  const [isConnectingTreasury, setIsConnectingTreasury] = useState(false);
  const [fhenixError, setFhenixError] = useState<string | null>(null);

  // Try to get CoFHE context if available
  let cofheContext: { client?: CofheClient } = {};
  try {
    if (useCofheContext) {
      cofheContext = useCofheContext() || {};
    }
  } catch (e) {
    // CoFHE context not available in this context
  }

  const client = cofheContext.client;

  // Sync Fhenix connection state with actual CoFHE client state
  useEffect(() => {
    if (client?.isConnected && !user.fhenixConnected) {
      setUser({ fhenixConnected: true });
    }
  }, [client?.isConnected]);

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

  const handleDisconnectBrowserWallet = () => {
    setUser({
      address: '',
      isConnected: false,
      network: undefined,
    });
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

  const handleDisconnectTreasury = () => {
    setUser({
      owsWalletConnected: false,
      owsWalletAddress: '',
      owsWalletName: '',
      owsWalletChain: '',
    });
  };

  const handleConnectFhenix = async () => {
    setFhenixError(null);

    // Try to trigger the CoFHE portal via its CSS class
    // The CoFHE SDK adds a floating button when CofheProvider is active
    const cofheButton = document.querySelector('.cofhe-floating-button') as HTMLElement;

    if (cofheButton) {
      cofheButton.click();
      // The actual connection happens in the CoFHE portal
      // We'll optimistically set it and let the useEffect sync if needed
      setUser({ fhenixConnected: true });
    } else {
      // If CoFHE portal button isn't found, try alternative methods
      // Some versions may use different selectors
      const altButtons = document.querySelectorAll('[class*="cofhe"], [data-cofhe]');

      if (altButtons.length > 0) {
        (altButtons[0] as HTMLElement).click();
        setUser({ fhenixConnected: true });
      } else {
        // Show clear messaging to user
        setFhenixError('CoFHE portal not found. Ensure you\'re on a page with FhenixProvider active.');

        // Auto-dismiss error after 3 seconds
        setTimeout(() => setFhenixError(null), 3000);
      }
    }
  };

  const handleDisconnectFhenix = async () => {
    try {
      if (client?.disconnect) {
        await client.disconnect();
      }
    } catch (e) {
      console.warn('Error disconnecting Fhenix:', e);
    }

    setUser({ fhenixConnected: false });
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
    cursor: default;

    &:hover {
      border-color: ${designTokens.colors.semantic.success[400]};
      transform: none;
      box-shadow: none;
    }
  `;

  const disconnectButtonStyle = css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: ${designTokens.borderRadius.md};
    border: 1px solid ${designTokens.colors.neutral[200]};
    background: transparent;
    color: ${designTokens.colors.neutral[500]};
    cursor: pointer;
    transition: ${easings.smooth};

    &:hover {
      background: ${designTokens.colors.neutral[100]};
      color: ${designTokens.colors.semantic.error[500]};
      border-color: ${designTokens.colors.semantic.error[200]};
    }
  `;

  const formatAddress = (addr: string) => `${addr?.slice(0, 6)}...${addr?.slice(-4) || ''}`;

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
              <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
                <div>
                  <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>Browser Wallet</div>
                  <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>
                    {formatAddress(user.address || '')}
                    {user.network && <span css={css`margin-left: ${designTokens.spacing[2]}; color: ${designTokens.colors.neutral[400]};`}>• {user.network}</span>}
                  </div>
                </div>
                <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
              </div>
              <button
                css={disconnectButtonStyle}
                onClick={handleDisconnectBrowserWallet}
                title="Disconnect wallet"
              >
                <Unlink size={16} />
              </button>
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
              <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
                <div>
                  <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>{user.owsWalletName || 'Local Vault (OWS)'}</div>
                  <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>{formatAddress(user.owsWalletAddress || '')}</div>
                </div>
                <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
              </div>
              <button
                css={disconnectButtonStyle}
                onClick={handleDisconnectTreasury}
                title="Disconnect treasury"
              >
                <Unlink size={16} />
              </button>
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
            Enable encrypted policy execution via Fhenix CoFHE.
          </p>

          {user.fhenixConnected ? (
            <div css={connectedCardStyle}>
              <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
                <div>
                  <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary);`}>Fhenix CoFHE Connected</div>
                  <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary);`}>Confidential Network Ready</div>
                </div>
                <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
              </div>
              <button
                css={disconnectButtonStyle}
                onClick={handleDisconnectFhenix}
                title="Disconnect Fhenix"
              >
                <Unlink size={16} />
              </button>
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

          {/* Error message for Fhenix connection */}
          {fhenixError && (
            <div css={css`
              margin-top: ${designTokens.spacing[2]};
              padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
              background: ${designTokens.colors.semantic.error[50]};
              border: 1px solid ${designTokens.colors.semantic.error[200]};
              border-radius: ${designTokens.borderRadius.md};
              color: ${designTokens.colors.semantic.error[700]};
              font-size: ${designTokens.typography.fontSize.sm};
            `}>
              {fhenixError}
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
};
