import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { MobileShellBootstrap } from "@/components/app/MobileShellBootstrap";
import { PremiumAppShell } from "@/components/app/PremiumAppShell";
import { NativeShellBootstrap } from "@/components/capacitor/NativeShellBootstrap";
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
  maximumScale: 1,
  viewportFit: "cover",
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
    <html lang="fr" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ServiceWorkerRegister />
        <MobileShellBootstrap />
        <NativeShellBootstrap />
        <PremiumAppShell headerBootstrap={headerBootstrap}>{children}</PremiumAppShell>
      </body>
    </html>
  );
}
