"use client";

import { useRouter } from "next/navigation";
import { ExperienceProfileModal } from "@/components/restaurant/ExperienceProfileModal";
import { uiBtnSecondary, uiLead } from "@/components/ui/premium";
import type { EstablishmentType, PriceTier } from "@/lib/b2c/experience/taxonomy";

type Props = {
  restaurantId: string;
  restaurantName: string;
  suggestedEstablishmentType: EstablishmentType;
  suggestedPriceTier: PriceTier;
};

export function OnboardingExperienceClient({
  restaurantId,
  restaurantName,
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <p className={uiLead}>
        <span className="font-semibold text-stone-800">{restaurantName}</span> — ces informations alimentent le
        matching client. Un fast-food ne pourra pas apparaître en recherche gastronomique, même avec d&apos;excellentes
        notes.
      </p>

      <ExperienceProfileModal
        restaurantId={restaurantId}
        open
        onClose={() => router.push("/dashboard")}
        onSaved={() => router.push("/dashboard")}
      />

      <button type="button" className={uiBtnSecondary} onClick={() => router.push("/dashboard")}>
        Passer pour l&apos;instant
      </button>
    </div>
  );
}
