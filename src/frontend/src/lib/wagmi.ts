'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http, fallback } from 'wagmi';
import { mainnet, sepolia, arbitrumSepolia, baseSepolia } from 'wagmi/chains';

const INFURA_KEY = '21dadabcaa93488e84cce263d9e0ffb0';

export const config = getDefaultConfig({
  appName: 'Cognivern',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'cognivern-dev',
  chains: [mainnet, sepolia, arbitrumSepolia, baseSepolia],
  transports: {
    [mainnet.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_MAINNET),
      http(`https://mainnet.infura.io/v3/${INFURA_KEY}`),
      http('https://eth.llamarpc.com'),
      http('https://rpc.ankr.com/eth'),
    ]),
    [sepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_SEPOLIA),
      http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
      http('https://ethereum-sepolia.publicnode.com'),
    ]),
    [arbitrumSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA),
      http(`https://arbitrum-sepolia.infura.io/v3/${INFURA_KEY}`),
      http('https://sepolia-rollup.arbitrum.io/rpc'),
    ]),
    [baseSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA),
      http(`https://base-sepolia.infura.io/v3/${INFURA_KEY}`),
      http('https://sepolia.base.org'),
    ]),
  },
  ssr: true,
});
