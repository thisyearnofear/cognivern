import { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';

interface Web3AuthProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Web3Auth({ onConnect, onDisconnect }: Web3AuthProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          onConnect(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        // Switch to Filecoin Calibration testnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x4cb2f' }], // Filecoin Calibration testnet
          });
        } catch (switchError: any) {
          // If the chain doesn't exist, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x4cb2f',
                  chainName: 'Filecoin Calibration',
                  nativeCurrency: {
                    name: 'Filecoin',
                    symbol: 'FIL',
                    decimals: 18,
                  },
                  rpcUrls: ['https://api.calibration.node.glif.io/rpc/v1'],
                  blockExplorerUrls: ['https://calibration.filfox.info/'],
                },
              ],
            });
          }
        }

        setAddress(accounts[0]);
        setIsConnected(true);
        onConnect(accounts[0]);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress('');
    setIsConnected(false);
    onDisconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="web3-auth">
      {!isConnected ? (
        <button 
          css={css`
            background: ${designTokens.colors.primary[600]};
            color: white;
            border: none;
            padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
            border-radius: ${designTokens.borderRadius.md};
            cursor: pointer;
            font-size: ${designTokens.typography.fontSize.sm};
            
            &:hover {
              background: ${designTokens.colors.primary[700]};
            }
            
            &:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
          `}
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[3]};
          
          @media (max-width: ${designTokens.breakpoints.md}) {
            flex-direction: column;
            gap: ${designTokens.spacing[2]};
          }
        `}>
          <div css={css`
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            
            @media (max-width: ${designTokens.breakpoints.md}) {
              display: none; /* Hide on mobile/tablet */
            }
          `}>
            <div css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              font-weight: ${designTokens.typography.fontWeight.medium};
              color: ${designTokens.colors.text.primary};
            `}>
              {formatAddress(address)}
            </div>
            <div css={css`
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${designTokens.colors.text.secondary};
            `}>
              Filecoin
            </div>
          </div>
          <button 
            css={css`
              background: ${designTokens.colors.semantic.error};
              color: white;
              border: none;
              padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
              border-radius: ${designTokens.borderRadius.md};
              cursor: pointer;
              font-size: ${designTokens.typography.fontSize.xs};
              
              &:hover {
                background: ${designTokens.colors.semantic.errorHover};
              }
              
              @media (max-width: ${designTokens.breakpoints.md}) {
                padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
                font-size: ${designTokens.typography.fontSize.sm};
              }
            `}
            onClick={disconnectWallet}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}