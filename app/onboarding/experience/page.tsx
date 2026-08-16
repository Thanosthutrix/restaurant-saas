import { redirect, notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { getExperienceProfile } from "@/lib/b2c/experience/experienceDb";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { OnboardingExperienceClient } from "./OnboardingExperienceClient";
import { suggestExperienceFromTemplate } from "@/lib/b2c/experience/templateMapping";

type Props = {
  searchParams: Promise<{ restaurantId?: string }>;
};

export default async function OnboardingExperiencePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { restaurantId } = await searchParams;
  const restaurants = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = restaurantId
    ? restaurants.find((r) => r.id === restaurantId)
    : restaurants[0];

  if (!restaurant) notFound();

  const existing = await getExperienceProfile(restaurant.id);
  if (existing.data?.completed_at) redirect("/dashboard");

  const suggestion = suggestExperienceFromTemplate(restaurant.template_slug ?? restaurant.activity_type);

  return (
    <OnboardingPageShell
      accentIcon={Sparkles}
      eyebrow="Portail client ubion"
      title="Décrivez votre expérience"
      subtitle="Dernière étape pour apparaître dans les recherches clients avec le bon positionnement — type, ambiance, budget."
    >
      <OnboardingExperienceClient
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        suggestedEstablishmentType={suggestion.establishmentType}
        suggestedPriceTier={suggestion.priceTier}
      />
    </OnboardingPageShell>
  );
}
