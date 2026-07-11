import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les routes.
 *
 * Volontairement SANS Content-Security-Policy stricte sur les scripts : l'app charge
 * Google Maps, @google/model-viewer (3D/AR), Supabase, etc. Une CSP `script-src` doit
 * être calibrée puis testée écran par écran (chantier séparé). On protège ici contre
 * le clickjacking (frame-ancestors + X-Frame-Options), le MIME-sniffing et les fuites
 * de referrer, et on force HTTPS via HSTS.
 *
 * Permissions-Policy : caméra + géolocalisation autorisées uniquement pour l'app
 * elle-même (import de tickets/photos de traçabilité, AR, cartes), le reste désactivé.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
    /**
     * Cache routeur client : conserve le rendu d'une page déjà visitée quelques
     * secondes/minutes. Revenir sur une page récente est alors instantané (pas de
     * nouveau rendu serveur), ce qui supprime le « flash » lors des allers-retours.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
