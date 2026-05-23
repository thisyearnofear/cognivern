import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "dist",
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.thisyearnofear.com";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
