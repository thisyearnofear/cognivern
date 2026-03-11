import { useState, useEffect } from "react";

interface WalletConnectProps {
  onConnect: (address: string, network: "filecoin" | "polkadot") => void;
  onDisconnect: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function WalletConnect({
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [network, setNetwork] = useState<string>(""); // "filecoin" or "polkadot"
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);

          // Detect current network
          try {
            const chainIdHex = await window.ethereum.request({
              method: "eth_chainId",
            });
            const chainId = parseInt(chainIdHex, 16);

            if (chainId === 100000) {
              // Polkadot Hub placeholder chainId
              setNetwork("polkadot");
              onConnect(accounts[0], "polkadot");
            } else if (chainId === 314159) {
              // Filecoin Calibration
              setNetwork("filecoin");
              onConnect(accounts[0], "filecoin");
            } else {
              // Default to filecoin for unknown networks
              setNetwork("filecoin");
              onConnect(accounts[0], "filecoin");
            }
          } catch (networkError) {
            console.error("Error detecting network:", networkError);
            // Default to filecoin
            setNetwork("filecoin");
            onConnect(accounts[0], "filecoin");
          }
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      setError(
        "MetaMask is not installed. Please install MetaMask to continue.",
      );
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        const userAddress = accounts[0];
        setAddress(userAddress);
        setIsConnected(true);

        // Detect current network
        try {
          const chainIdHex = await window.ethereum.request({
            method: "eth_chainId",
          });
          const chainId = parseInt(chainIdHex, 16);

          if (chainId === 100000) {
            // Polkadot Hub placeholder chainId
            setNetwork("polkadot");
            onConnect(userAddress, "polkadot");
          } else if (chainId === 314159) {
            // Filecoin Calibration
            setNetwork("filecoin");
            onConnect(userAddress, "filecoin");
          } else {
            // Default to filecoin for unknown networks
            setNetwork("filecoin");
            onConnect(userAddress, "filecoin");
          }
        } catch (networkError) {
          console.error("Error detecting network:", networkError);
          // Default to filecoin
          setNetwork("filecoin");
          onConnect(userAddress, "filecoin");
        }
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      setError(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress("");
    setError("");
    onDisconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected) {
    const networkName =
      network === "polkadot" ? "Polkadot Hub" : "Filecoin Calibration";
    return (
      <div className="wallet-connect connected">
        <div className="wallet-info">
          <div className="wallet-status">
            <span className="status-indicator connected"></span>
            <span className="network-name">{networkName}</span>
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
        className={`connect-btn ${isConnecting ? "connecting" : ""}`}
        onClick={connectWallet}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <span className="spinner"></span>
            Connecting...
          </>
        ) : (
          <>🦊 Connect Wallet</>
        )}
      </button>

      {typeof window.ethereum === "undefined" && (
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
