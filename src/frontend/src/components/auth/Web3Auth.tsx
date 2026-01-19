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

// Arbitrum One mainnet configuration
const ARBITRUM_CHAIN_ID = '0xa4b1'; // 42161 in decimal
const ARBITRUM_CONFIG = {
  chainId: ARBITRUM_CHAIN_ID,
  chainName: 'Arbitrum One',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://arbiscan.io/'],
};

export default function Web3Auth({ onConnect, onDisconnect }: Web3AuthProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
    // Listen for account/chain changes
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAddress(accounts[0]);
      onConnect(accounts[0]);
    }
  };

  const checkConnection = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('Web3 wallet not detected');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        setError(null);
        onConnect(accounts[0]);
        
        // Ensure we're on Arbitrum
        if (chainId !== ARBITRUM_CHAIN_ID) {
          await switchToArbitrum();
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setError(null); // Clear error on initial check
    }
  };

  const switchToArbitrum = async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // Chain doesn't exist, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_CONFIG],
          });
        } catch (addError) {
          console.error('Failed to add Arbitrum chain:', addError);
          setError('Failed to add Arbitrum chain. Please add it manually.');
        }
      } else {
        console.error('Failed to switch to Arbitrum:', switchError);
        setError('Failed to switch network. Please switch to Arbitrum One manually.');
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('Web3 wallet not detected. Please install MetaMask or another compatible wallet.');
      return;
    }

    setIsConnecting(true);
    setError(null);
    
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        // Switch to Arbitrum
        await switchToArbitrum();
        
        setAddress(accounts[0]);
        setIsConnected(true);
        onConnect(accounts[0]);
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      // Only show error if user rejected the request
      if (error.code === 4001) {
        setError('Connection rejected. Please try again.');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress('');
    setIsConnected(false);
    setError(null);
    onDisconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="web3-auth">
      {error && (
        <div css={css`
          font-size: ${designTokens.typography.fontSize.xs};
          color: ${designTokens.colors.semantic.error[600]};
          padding: ${designTokens.spacing[2]};
          margin-bottom: ${designTokens.spacing[2]};
          background: ${designTokens.colors.semantic.error[50]};
          border-radius: ${designTokens.borderRadius.sm};
          border: 1px solid ${designTokens.colors.semantic.error[200]};
        `}>
          {error}
        </div>
      )}
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
              Arbitrum One
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