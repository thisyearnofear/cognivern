import { useState, useEffect } from 'react';
import './WalletConnect.css';

interface WalletConnectProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');

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
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const userAddress = accounts[0];
        setAddress(userAddress);
        setIsConnected(true);
        onConnect(userAddress);

        // Switch to Filecoin Calibration testnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x4cb2f' }], // 314159 in hex (Filecoin Calibration)
          });
        } catch (switchError: any) {
          // If the chain doesn't exist, add it
          if (switchError.code === 4902) {
            try {
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
                    blockExplorerUrls: ['https://calibration.filscan.io/'],
                  },
                ],
              });
            } catch (addError) {
              console.error('Error adding Filecoin network:', addError);
              setError('Failed to add Filecoin network to wallet');
            }
          } else {
            console.error('Error switching to Filecoin network:', switchError);
            setError('Failed to switch to Filecoin network');
          }
        }
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress('');
    setError('');
    onDisconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected) {
    return (
      <div className="wallet-connect connected">
        <div className="wallet-info">
          <div className="wallet-status">
            <span className="status-indicator connected"></span>
            <span className="network-name">Filecoin Calibration</span>
          </div>
          <div className="wallet-address">
            <code>{formatAddress(address)}</code>
          </div>
        </div>
        <button className="disconnect-btn" onClick={disconnectWallet}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      {error && (
        <div className="wallet-error">
          <span>⚠️ {error}</span>
        </div>
      )}
      
      <button 
        className={`connect-btn ${isConnecting ? 'connecting' : ''}`}
        onClick={connectWallet}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <span className="spinner"></span>
            Connecting...
          </>
        ) : (
          <>
            🦊 Connect Wallet
          </>
        )}
      </button>
      
      {typeof window.ethereum === 'undefined' && (
        <div className="install-metamask">
          <p>Need MetaMask?</p>
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="install-link"
          >
            Install MetaMask
          </a>
        </div>
      )}
    </div>
  );
}