import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** FormData (carte, BL, factures, relevés CA) — relevés traités aussi en requêtes séparées côté client. */
      bodySizeLimit: "64mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
