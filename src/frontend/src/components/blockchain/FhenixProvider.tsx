import React, { useMemo } from 'react';
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
        projectName: 'Cognivern SpendOS',
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
      <CofheProvider config={cofheConfig} publicClient={publicClient as any} walletClient={walletClient as any}>
        {children}
      </CofheProvider>
    </QueryClientProvider>
  );
}
