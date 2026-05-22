import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
  images: { remotePatterns: [] },
  // Include Sharp native binaries in Vercel serverless bundle
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
};

export default nextConfig;
