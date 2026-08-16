import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { PublicDirectoryClient } from "@/components/public/PublicDirectoryClient";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";
import { getCurrentUser } from "@/lib/auth";
import { getConsumerSearchPreferences } from "@/lib/b2c/experience/consumerPreferencesDb";
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
  const user = await getCurrentUser();
  const [restaurants, searchPrefs] = await Promise.all([
    listPublicRestaurants(),
    user ? getConsumerSearchPreferences(user.id) : Promise.resolve(null),
  ]);

  return (
    <PublicLayoutShell>
      <JsonLd data={buildOrganizationJsonLd()} />
      <PublicDirectoryClient
        restaurants={restaurants}
        searchPrefs={searchPrefs}
        isLoggedIn={Boolean(user)}
      />
    </PublicLayoutShell>
  );
}
