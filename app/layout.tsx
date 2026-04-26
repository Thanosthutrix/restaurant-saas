import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PremiumAppShell } from "@/components/app/PremiumAppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Restaurant SaaS",
    template: "%s · Restaurant SaaS",
  },
  description:
    "Gestion des services, plats, stock, fournisseurs, base clients et analyses pour les restaurants.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <PremiumAppShell headerBootstrap={null}>{children}</PremiumAppShell>
      </body>
    </html>
  );
}
