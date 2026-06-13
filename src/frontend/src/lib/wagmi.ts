"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "wagmi";
import { mainnet, sepolia, arbitrumSepolia, baseSepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Cognivern",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "cognivern-dev",
  chains: [mainnet, sepolia, arbitrumSepolia, baseSepolia],
  transports: {
    [mainnet.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_MAINNET || "https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://cloudflare-eth.com"),
    ]),
    [sepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://ethereum-sepolia.publicnode.com"),
      http("https://rpc.sepolia.org"),
    ]),
    [arbitrumSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || "https://sepolia-rollup.arbitrum.io/rpc"),
    ]),
    [baseSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || "https://sepolia.base.org"),
    ]),
  },
  ssr: true,
});
