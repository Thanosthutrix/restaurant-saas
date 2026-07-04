import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { PremiumAppShell } from "@/components/app/PremiumAppShell";
import { buildShellHeaderBootstrap } from "@/lib/app/shellHeaderBootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "ubion",
    template: "%s · ubion",
  },
  description:
    "Gestion des services, plats, stock, fournisseurs, base clients et analyses pour les restaurants.",
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
        <PremiumAppShell headerBootstrap={headerBootstrap}>{children}</PremiumAppShell>
      </body>
    </html>
  );
}
