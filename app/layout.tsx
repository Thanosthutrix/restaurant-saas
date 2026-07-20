import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { PremiumAppShell } from "@/components/app/PremiumAppShell";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { buildShellHeaderBootstrap } from "@/lib/app/shellHeaderBootstrap";
import { getSiteBaseUrl } from "@/lib/seo/siteUrl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#9c431c",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: {
    default: "ubion",
    template: "%s · ubion",
  },
  description:
    "Gestion des services, plats, stock, fournisseurs, base clients et analyses pour les restaurants.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ubion",
  },
  openGraph: {
    type: "website",
    siteName: "ubion",
    locale: "fr_FR",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerBootstrap = await buildShellHeaderBootstrap();

  return (
    <html lang="fr" className="scroll-smooth">
      <body
        className={`${geistSans.variable} font-sans antialiased`}
      >
        <ServiceWorkerRegister />
        <PremiumAppShell headerBootstrap={headerBootstrap}>{children}</PremiumAppShell>
      </body>
    </html>
  );
}
