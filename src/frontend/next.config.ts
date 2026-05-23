import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.thisyearnofear.com";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  // shadcn sidebar uses React context which breaks static generation
  // of Next.js internal error pages. Vercel builds handle this correctly.
  output: "standalone",
};

export default nextConfig;
