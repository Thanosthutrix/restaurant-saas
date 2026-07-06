import type { Metadata } from "next";
import { PublicDirectoryClient } from "@/components/public/PublicDirectoryClient";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";
import { listPublicRestaurants } from "@/lib/public/data";

export const metadata: Metadata = {
  title: "Trouver un restaurant",
  description:
    "Annuaire restaurants : carte en direct, avis certifiés, score d'hygiène et réservation en ligne.",
};

export default async function PublicHomePage() {
  const restaurants = await listPublicRestaurants();

  return (
    <PublicLayoutShell>
      <PublicDirectoryClient restaurants={restaurants} />
    </PublicLayoutShell>
  );
}
