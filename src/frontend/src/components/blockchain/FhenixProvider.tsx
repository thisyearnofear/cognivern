import React, { useMemo } from 'react';
import { Global, css } from '@emotion/react';
import { CofheProvider, createCofheConfig } from '@cofhe/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const queryClient = new QueryClient();

const fhenixHelium = {
  id: 8008135,
  name: 'Fhenix Helium',
  nativeCurrency: { name: 'tFHE', symbol: 'tFHE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.testnet.fhenix.zone'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.fhenix.zone' },
  },
} as const;

export function FhenixProvider({ children }: { children: React.ReactNode }) {
  const cofheConfig = useMemo(() => {
    return createCofheConfig({
      environment: 'react',
      supportedChains: [
        {
          id: 8008135,
          name: 'Fhenix Helium',
          network: 'helium',
          coFheUrl: 'https://api.testnet.fhenix.zone',
          verifierUrl: 'https://api.testnet.fhenix.zone',
          thresholdNetworkUrl: 'https://api.testnet.fhenix.zone',
          environment: 'TESTNET',
        },
      ],
      react: {
        projectName: 'Enable Confidential Governance',
        position: 'bottom-right',
      },
    });
  }, []);

  // We use window.ethereum directly as the project doesn't use Wagmi yet
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: fhenixHelium as any,
      transport: http('https://api.testnet.fhenix.zone'),
    });
  }, []);

  const walletClient = useMemo(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return createWalletClient({
        chain: fhenixHelium as any,
        transport: custom(window.ethereum),
      });
    }
    return undefined;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CofheProvider
        config={cofheConfig}
        publicClient={publicClient as any}
        walletClient={walletClient as any}
      >
        <Global
          styles={css`
            /* Hide the CoFHE Portal widget by default, only show when .show-cofhe-portal class is present */
            body:not(.show-cofhe-portal) .cofhe-floating-button {
              display: none !important;
            }
            /* Tame the CoFHE Portal widget */
            .cofhe-floating-button {
              z-index: 50 !important;
              transition: all 0.3s ease !important;
            }
            .cofhe-floating-button:hover {
              transform: translateY(-2px) !important;
              box-shadow: 0 10px 25px -5px rgba(6, 182, 212, 0.4) !important;
            }
            /* Fix massive logo and negative space inside the CoFHE modal/portal */
            div[class*='cofhe-'] img {
              max-width: 48px !important;
              max-height: 48px !important;
              object-fit: contain !important;
            }
            div[class*='cofhe-'] {
              border-radius: 16px !important;
            }
          `}
        />
        {children}
      </CofheProvider>
    </QueryClientProvider>
  );
}
