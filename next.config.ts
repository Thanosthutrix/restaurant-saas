import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** Photos de carte (onboarding / nouveau restaurant) envoyées en FormData. */
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
