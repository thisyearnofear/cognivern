import type { NextConfig } from "next";
import { DEFAULT_API_ORIGIN } from "./src/lib/runtime-config";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  // Keep this allowlist in sync with the RPC transports configured in
  // src/lib/wagmi.ts — any new fallback host must be added here or it
  // will be blocked at runtime.
  "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://*.web3modal.org https://*.reown.com wss://*.walletconnect.com wss://*.walletconnect.org wss://*.reown.com https://*.llamarpc.com https://*.publicnode.com https://rpc.ankr.com https://*.infura.io https://cloudflare-eth.com https://sepolia-rollup.arbitrum.io https://sepolia.base.org https://eth.merkle.io https://*.merkle.io https://eth.drpc.org https://*.drpc.org https://1rpc.io https://rpc.mevblocker.io https://verify.walletconnect.org https://verify.walletconnect.com https://ipfs.io https://*.ipfs.io https://cloudflare-ipfs.com https://gateway.pinata.cloud https://testrpc.xlayer.tech https://api.calibration.node.glif.io",
  "frame-src 'self' https://verify.walletconnect.org https://verify.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  distDir: "dist",
  output: "standalone",
  async headers() {
    return [
      {
        source: "/((?!api).*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_ORIGIN;
    // The backend mounts most feature routers under `/api`, but auth,
    // workspace and api-key routers are mounted at the root (see
    // `ApiModule.setupRoutes`). Anything the browser calls has to have a
    // matching entry here or it never leaves the Next server — a request to
    // `/workspace` was being answered by Next itself with a 404, which is why
    // "Switch to Production" always failed.
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${apiUrl}/auth/:path*`,
      },
      {
        source: "/workspace",
        destination: `${apiUrl}/workspace`,
      },
      {
        source: "/workspaces/:path*",
        destination: `${apiUrl}/workspaces/:path*`,
      },
      {
        source: "/workspaces",
        destination: `${apiUrl}/workspaces`,
      },
      {
        source: "/api-keys/:path*",
        destination: `${apiUrl}/api-keys/:path*`,
      },
      {
        source: "/api-keys",
        destination: `${apiUrl}/api-keys`,
      },
    ];
  },
};

export default nextConfig;
