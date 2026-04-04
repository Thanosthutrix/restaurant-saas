import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PremiumAppShell } from "@/components/app/PremiumAppShell";
import { buildShellHeaderBootstrap } from "@/lib/app/shellHeaderBootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Session + header bootstrap (cookies) — évite un rendu statique incohérent avec l’hydratation. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Restaurant SaaS",
    template: "%s · Restaurant SaaS",
  },
  description:
    "Gestion des services, plats, stock, fournisseurs et analyses pour les restaurants.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shellHeaderBootstrap = await buildShellHeaderBootstrap();

  return (
    <html lang="fr" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <PremiumAppShell headerBootstrap={shellHeaderBootstrap}>{children}</PremiumAppShell>
      </body>
    </html>
  );
}
