import type { NextConfig } from "next";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  // IPFS gateways added so audit/agent metadata fetches are not blocked.
  // The merkle.io entries are kept for compatibility but wagmi has been
  // switched to use only the CORS-friendly providers in src/lib/wagmi.ts.
  "connect-src 'self' https://cognivern.thisyearnofear.com wss://cognivern.thisyearnofear.com https://*.walletconnect.com https://*.walletconnect.org https://*.web3modal.org https://*.reown.com wss://*.walletconnect.com wss://*.walletconnect.org wss://*.reown.com https://*.llamarpc.com https://*.publicnode.com https://rpc.ankr.com https://*.infura.io https://cloudflare-eth.com https://sepolia-rollup.arbitrum.io https://sepolia.base.org https://eth.merkle.io https://*.merkle.io https://verify.walletconnect.org https://verify.walletconnect.com https://ipfs.io https://*.ipfs.io https://cloudflare-ipfs.com https://gateway.pinata.cloud https://testrpc.xlayer.tech https://api.calibration.node.glif.io",
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
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "https://cognivern.thisyearnofear.com";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
