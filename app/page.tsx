import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { PublicDirectoryClient } from "@/components/public/PublicDirectoryClient";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";
import { listPublicRestaurants } from "@/lib/public/data";
import { buildOrganizationJsonLd } from "@/lib/seo/organizationJsonLd";
import { absoluteUrl } from "@/lib/seo/siteUrl";

export const metadata: Metadata = {
  title: "Trouver un restaurant",
  description:
    "Annuaire restaurants : carte en direct, avis certifiés, score d'hygiène et réservation en ligne.",
  openGraph: {
    title: "Trouver un restaurant · ubion",
    description:
      "Annuaire restaurants : carte en direct, avis certifiés, score d'hygiène et réservation en ligne.",
    url: absoluteUrl("/"),
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "ubion" }],
  },
};

export default async function PublicHomePage() {
  const restaurants = await listPublicRestaurants();

  return (
    <PublicLayoutShell>
      <JsonLd data={buildOrganizationJsonLd()} />
      <PublicDirectoryClient restaurants={restaurants} />
    </PublicLayoutShell>
  );
}
