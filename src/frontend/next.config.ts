import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.thisyearnofear.com/:path*",
      },
    ];
  },
  // shadcn sidebar uses React context which breaks static generation
  // of Next.js internal error pages. Vercel builds handle this correctly.
  output: "standalone",
};

export default nextConfig;