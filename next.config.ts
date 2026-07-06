import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "maps.google.com",
      },
      {
        protocol: "https",
        hostname: "www.google.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      /** FormData (carte, BL, factures, relevés CA) — relevés traités aussi en requêtes séparées côté client. */
      bodySizeLimit: "64mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
