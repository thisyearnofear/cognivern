import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import { designTokens, easings } from "../../styles/design-system";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { LogOut, Wallet } from "lucide-react";

interface WalletConnectProps {
  onConnect: (address: string, network: "filecoin" | "xlayer") => void;
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
  const [network, setNetwork] = useState<string>(""); // "filecoin" or "xlayer"
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>("");

  const { isMobile } = useBreakpoint();

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

            if (chainId === 195 || chainId === 196) {
              // X Layer testnet (195) or mainnet (196)
              setNetwork("xlayer");
              onConnect(accounts[0], "xlayer");
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

          if (chainId === 195 || chainId === 196) {
            // X Layer testnet (195) or mainnet (196)
            setNetwork("xlayer");
            onConnect(userAddress, "xlayer");
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
    return isMobile
      ? `${addr.slice(0, 4)}...${addr.slice(-2)}`
      : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const containerStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
  `;

  const buttonBaseStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${isMobile
      ? `${designTokens.spacing[1]} ${designTokens.spacing[2]}`
      : `${designTokens.spacing[2]} ${designTokens.spacing[4]}`};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    transition: ${easings.smooth};
    cursor: pointer;
    border: 1px solid ${designTokens.colors.neutral[300]};
    background: ${designTokens.colors.neutral[0]};
    color: ${designTokens.colors.neutral[700]};

    &:hover {
      background: ${designTokens.colors.neutral[50]};
      transform: translateY(-1px);
      box-shadow: ${designTokens.shadows.sm};
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  const connectedButtonStyles = css`
    ${buttonBaseStyles}
    background: ${designTokens.colorSystem.gradients.primary};
    color: white;
    border: none;

    &:hover {
      opacity: 0.9;
      background: ${designTokens.colorSystem.gradients.primary};
    }
  `;

  if (isConnected) {
    const networkName =
      network === "xlayer" ? "X Layer" : "Filecoin Calibration";
    return (
      <div css={containerStyles}>
        <button css={connectedButtonStyles} title={networkName}>
          <Wallet size={16} />
          <span>{formatAddress(address)}</span>
        </button>
        <button
          css={buttonBaseStyles}
          onClick={disconnectWallet}
          title="Disconnect Wallet"
        >
          <LogOut size={16} />
          {!isMobile && <span>Disconnect</span>}
        </button>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      {error && !isMobile && (
        <div
          css={css`
            color: ${designTokens.colors.semantic.error[500]};
            font-size: ${designTokens.typography.fontSize.xs};
          `}
        >
          <span>⚠️ Error</span>
        </div>
      )}

      <button
        css={buttonBaseStyles}
        onClick={connectWallet}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <span
              css={css`
                width: 14px;
                height: 14px;
                border: 2px solid currentColor;
                border-right-color: transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              `}
            ></span>
            {!isMobile && "Connecting..."}
          </>
        ) : (
          <>
            <Wallet size={16} />
            <span>{!isMobile ? "Connect Wallet" : "Connect"}</span>
          </>
        )}
      </button>
    </div>
  );
}
