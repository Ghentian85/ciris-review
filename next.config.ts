import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
  images: { remotePatterns: [] },
};

export default nextConfig;
