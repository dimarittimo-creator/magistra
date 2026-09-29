import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // File di magazzino e PDF dei DDT caricati dall'area admin
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
