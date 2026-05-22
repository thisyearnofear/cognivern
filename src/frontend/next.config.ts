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
  // Static generation of dashboard pages requires SidebarProvider
  // context, which is only available at runtime. Skip during build.
  outputFileTracingIncludes: {
    "/*": [],
  },
};

export default nextConfig;