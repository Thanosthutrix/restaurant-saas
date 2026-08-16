import type { Metadata } from "next";
import { ProLandingPageClient } from "@/components/public/pro/ProLandingPageClient";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";
import { absoluteUrl } from "@/lib/seo/siteUrl";

export const metadata: Metadata = {
  title: "Ubion Pro — L'application tout-en-un pour restaurateurs",
  description:
    "Ubion réunit stock, salle, cuisine, équipes, conformité et pilotage financier dans une seule application premium pour restaurateurs.",
  openGraph: {
    title: "Ubion Pro · Reprenez le contrôle de votre restaurant",
    description:
      "Temps, marges, image, équipes — une seule application pour gérer votre restaurant de A à Z.",
    url: absoluteUrl("/pro"),
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Ubion" }],
  },
};

export default function ProPresentationPage() {
  return (
    <PublicLayoutShell headerMode="pro">
      <ProLandingPageClient />
    </PublicLayoutShell>
  );
}
