import React, { useMemo } from 'react';
import { CofheProvider, createCofheConfig } from '@cofhe/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const queryClient = new QueryClient();

export function FhenixProvider({ children }: { children: React.ReactNode }) {
  const cofheConfig = useMemo(() => {
    return createCofheConfig({
      chainId: baseSepolia.id,
      rpcUrl: 'https://api.testnet.fhenix.zone',
      react: {
        projectName: 'Cognivern SpendOS',
      },
    });
  }, []);

  // We use window.ethereum directly as the project doesn't use Wagmi yet
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http('https://api.testnet.fhenix.zone'),
    });
  }, []);

  const walletClient = useMemo(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });
    }
    return undefined;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CofheProvider config={cofheConfig} publicClient={publicClient} walletClient={walletClient}>
        {children}
      </CofheProvider>
    </QueryClientProvider>
  );
}
