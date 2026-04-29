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
        projectName: 'Cognivern',
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

            /* Floating button positioning & styling */
            .cofhe-floating-button {
              position: fixed !important;
              bottom: 28px !important;
              right: 28px !important;
              z-index: 50 !important;
              transition: all 0.3s ease !important;
            }
            .cofhe-floating-button:hover {
              transform: translateY(-2px) !important;
              box-shadow: 0 10px 25px -5px rgba(6, 182, 212, 0.4) !important;
            }

            /* Fix logo sizing inside the portal components */
            div[class*='cofhe-'] img {
              max-width: 48px !important;
              max-height: 48px !important;
              object-fit: contain !important;
            }

            /* Ensure any direct child portal overlay (not the floating button) is centered and within viewport */
            body > div[class*='cofhe-']:not(.cofhe-floating-button) {
              position: fixed !important;
              inset: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              z-index: 99999 !important;
              padding: 24px !important;
              box-sizing: border-box !important;
            }

            /* Modal content container constraints (within the overlay) */
            body > div[class*='cofhe-']:not(.cofhe-floating-button) > div {
              max-height: 90vh !important;
              max-width: 480px !important;
              width: 100% !important;
              overflow-y: auto !important;
              border-radius: 20px !important;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
            }

            /* Rounded corners for any other cofhe containers */
            div[class*='cofhe-']:not(.cofhe-floating-button) {
              border-radius: 16px !important;
            }
          `}
        />
        {children}
      </CofheProvider>
    </QueryClientProvider>
  );
}
