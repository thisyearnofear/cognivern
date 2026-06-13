"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http, fallback } from "wagmi";
import { mainnet, sepolia, arbitrumSepolia } from "wagmi/chains";

export const xLayerTestnet = defineChain({
  id: 195,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
  },
});

export const filecoinCalibration = defineChain({
  id: 314159,
  name: "Filecoin Calibration",
  nativeCurrency: { name: "Filecoin", symbol: "tFIL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.calibration.node.glif.io/rpc/v1"] },
  },
  blockExplorers: {
    default: {
      name: "Filfox",
      url: "https://calibration.filfox.info",
    },
  },
});

export const config = getDefaultConfig({
  appName: "Cognivern",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "cognivern-dev",
  chains: [
    mainnet,
    sepolia,
    arbitrumSepolia,
    xLayerTestnet,
    filecoinCalibration,
  ],
  transports: {
    [mainnet.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_MAINNET || "https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://cloudflare-eth.com"),
    ]),
    [sepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://ethereum-sepolia.publicnode.com"),
    ]),
    [arbitrumSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || "https://sepolia-rollup.arbitrum.io/rpc"),
    ]),
    [xLayerTestnet.id]: http("https://testrpc.xlayer.tech"),
    [filecoinCalibration.id]: http("https://api.calibration.node.glif.io/rpc/v1"),
  },
  ssr: true,
});
