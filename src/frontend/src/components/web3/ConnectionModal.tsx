import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { useAppStore } from '../../stores/appStore';
import { designTokens, easings } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Modal } from '../ui/Modal';
import { Wallet, Shield, Lock, ChevronRight, CheckCircle2, Activity, Unlink } from 'lucide-react';
import { owsApi } from '../../services/apiService';

// CoFHE types
interface CofheClient {
  isConnected?: boolean;
  account?: string;
  disconnect?: () => Promise<void>;
}

// CoFHE context - handled gracefully if module unavailable
type CofheHook = () => { client?: CofheClient };
let useCofheContext: CofheHook | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cofheModule = require('@cofhe/react');
  useCofheContext = cofheModule.useCofheContext;
} catch {
  // Module not available
}

export type ConnectionModalMode = 'modal' | 'embedded';

export interface ConnectionModalProps {
  /** Display mode: 'modal' for header trigger, 'embedded' for onboarding */
  mode?: ConnectionModalMode;
  /** Whether modal is open (only used when mode='modal') */
  isOpen?: boolean;
  /** Close handler (only used when mode='modal') */
  onClose?: () => void;
  /** Callback when all connections are established */
  onComplete?: () => void;
  /** Show only specific connection types (default: all) */
  connectionsToShow?: ('wallet' | 'treasury' | 'fhenix')[];
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  mode = 'modal',
  isOpen: externalIsOpen,
  onClose,
  onComplete,
  connectionsToShow = ['wallet', 'treasury', 'fhenix'],
}) => {
  const { user, setUser } = useAppStore();
  const { isMobile } = useBreakpoint();

  // For embedded mode, always show; for modal mode, use external isOpen
  const isEmbedded = mode === 'embedded';
  const isOpen = isEmbedded || externalIsOpen;

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

  // Check if all required connections are complete
  const allRequiredConnected = connectionsToShow.every((type) => {
    if (type === 'wallet') return user.isConnected;
    if (type === 'treasury') return user.owsWalletConnected;
    if (type === 'fhenix') return user.fhenixConnected;
    return false;
  });

  // Sync Fhenix connection state with actual CoFHE client state
  useEffect(() => {
    if (client?.isConnected && !user.fhenixConnected) {
      setUser({ fhenixConnected: true });
    }
  }, [client?.isConnected]);

  // Call onComplete when all connections are established
  useEffect(() => {
    if (allRequiredConnected && onComplete) {
      onComplete();
    }
  }, [allRequiredConnected, onComplete]);

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

    const cofheButton = document.querySelector('.cofhe-floating-button') as HTMLElement;

    if (cofheButton) {
      cofheButton.click();
      setUser({ fhenixConnected: true });
    } else {
      const altButtons = document.querySelectorAll('[class*="cofhe"], [data-cofhe]');

      if (altButtons.length > 0) {
        (altButtons[0] as HTMLElement).click();
        setUser({ fhenixConnected: true });
      } else {
        setFhenixError(
          "CoFHE portal not found. Ensure you're on a page with FhenixProvider active.",
        );
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

  // Render connection card for a given type
  const renderConnectionCard = (
    type: 'wallet' | 'treasury' | 'fhenix',
    title: string,
    description: string,
    icon: React.ReactNode,
    isConnected: boolean,
    onConnect: () => void,
    onDisconnect: () => void,
    isConnecting: boolean,
    connectedLabel?: string,
  ) => {
    if (!connectionsToShow.includes(type)) return null;

    return (
      <div
        css={css`
          margin-bottom: ${designTokens.spacing[5]};
        `}
        key={type}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          {icon}
          <h4
            css={css`
              margin: 0;
              font-size: ${designTokens.typography.fontSize.md};
              color: var(--text-primary);
            `}
          >
            {title}
          </h4>
        </div>
        <p
          css={css`
            margin: 0 0 ${designTokens.spacing[3]} 0;
            font-size: ${designTokens.typography.fontSize.sm};
            color: var(--text-secondary);
          `}
        >
          {description}
        </p>

        {isConnected ? (
          <div css={connectedCardStyle}>
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[3]};
              `}
            >
              <div>
                <div
                  css={css`
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    color: var(--text-primary);
                  `}
                >
                  {connectedLabel || title}
                </div>
                {type === 'wallet' && user.address && (
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: var(--text-secondary);
                    `}
                  >
                    {formatAddress(user.address)}
                    {user.network && (
                      <span
                        css={css`
                          margin-left: ${designTokens.spacing[2]};
                          color: ${designTokens.colors.neutral[400]};
                        `}
                      >
                        • {user.network}
                      </span>
                    )}
                  </div>
                )}
                {type === 'treasury' && user.owsWalletAddress && (
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: var(--text-secondary);
                    `}
                  >
                    {formatAddress(user.owsWalletAddress)}
                  </div>
                )}
                {type === 'fhenix' && (
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: var(--text-secondary);
                    `}
                  >
                    Confidential Network Ready
                  </div>
                )}
              </div>
              <CheckCircle2 size={20} color={designTokens.colors.semantic.success[500]} />
            </div>
            {!isEmbedded && (
              <button css={disconnectButtonStyle} onClick={onDisconnect} title="Disconnect">
                <Unlink size={16} />
              </button>
            )}
          </div>
        ) : (
          <div css={optionCardStyle} onClick={onConnect}>
            <div>
              <div
                css={css`
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  color: var(--text-primary);
                `}
              >
                {title}
              </div>
              <div
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: var(--text-secondary);
                `}
              >
                {description}
              </div>
            </div>
            {isConnecting ? (
              <Activity
                size={20}
                css={css`
                  animation: spin 2s linear infinite;
                `}
              />
            ) : (
              <ChevronRight size={20} color={designTokens.colors.neutral[400]} />
            )}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div
      css={css`
        padding: ${designTokens.spacing[2]} 0;
      `}
    >
      {renderConnectionCard(
        'wallet',
        'User Identity',
        'Connect your personal wallet to sign approvals.',
        <Wallet size={18} color={designTokens.colors.primary[600]} />,
        user.isConnected,
        handleConnectBrowserWallet,
        handleDisconnectBrowserWallet,
        isConnectingIdentity,
        'Browser Wallet',
      )}

      {renderConnectionCard(
        'treasury',
        'Governance Treasury',
        'The vault your agents use to execute trades.',
        <Shield size={18} color={designTokens.colors.primary[600]} />,
        user.owsWalletConnected,
        handleBootstrapTreasury,
        handleDisconnectTreasury,
        isConnectingTreasury,
        user.owsWalletName || 'Local Vault (OWS)',
      )}

      {renderConnectionCard(
        'fhenix',
        'Confidential Compute',
        'Enable encrypted policy execution via Fhenix CoFHE.',
        <Lock size={18} color={designTokens.colors.primary[600]} />,
        user.fhenixConnected,
        handleConnectFhenix,
        handleDisconnectFhenix,
        false,
      )}

      {/* Error message for Fhenix connection */}
      {fhenixError && (
        <div
          css={css`
            margin-top: ${designTokens.spacing[2]};
            padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
            background: ${designTokens.colors.semantic.error[50]};
            border: 1px solid ${designTokens.colors.semantic.error[200]};
            border-radius: ${designTokens.borderRadius.md};
            color: ${designTokens.colors.semantic.error[700]};
            font-size: ${designTokens.typography.fontSize.sm};
          `}
        >
          {fhenixError}
        </div>
      )}

      {/* Complete indicator */}
      {allRequiredConnected && (
        <div
          css={css`
            margin-top: ${designTokens.spacing[4]};
            padding: ${designTokens.spacing[3]};
            background: ${designTokens.colors.semantic.success[50]};
            border: 1px solid ${designTokens.colors.semantic.success[200]};
            border-radius: ${designTokens.borderRadius.md};
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
            color: ${designTokens.colors.semantic.success[700]};
            font-size: ${designTokens.typography.fontSize.sm};
          `}
        >
          <CheckCircle2 size={18} />
          All connections established!
        </div>
      )}
    </div>
  );

  // Modal mode: wrap in Modal component
  if (!isEmbedded) {
    return (
      <Modal isOpen={isOpen} onClose={onClose!} title="Connect to Cognivern" size="md">
        {content}
      </Modal>
    );
  }

  // Embedded mode: return content directly
  return content;
};
