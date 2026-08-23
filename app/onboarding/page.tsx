import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getProspectInvitePublic } from "@/lib/admin/prospectInviteDb";
import { userCanCreateRestaurant } from "@/lib/pro/signupEntitlementDb";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { OnboardingForm } from "./OnboardingForm";

export const maxDuration = 300;

type Props = { searchParams: Promise<{ invite?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await isCurrentUserAdmin()) redirect("/admin");

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) redirect("/dashboard");

  const { invite } = await searchParams;
  const inviteToken = typeof invite === "string" && invite.length > 10 ? invite : undefined;
  const inviteInfo = inviteToken ? await getProspectInvitePublic(inviteToken) : null;

  const canCreate = await userCanCreateRestaurant({
    userId: user.id,
    hasProspectInvite: Boolean(inviteToken && inviteInfo),
  });
  if (!canCreate) redirect("/onboarding/start");

  const templates = getRestaurantTemplates();

  return (
    <OnboardingPageShell
      accentIcon={Sparkles}
      eyebrow={inviteInfo ? "Invitation Ubion Pro" : "Première configuration"}
      subtitle={
        inviteInfo
          ? "Votre essai démarre à la création de l'établissement. Complétez les informations ci-dessous."
          : "Choisissez votre type d'établissement : le modèle applique automatiquement les composants stock et les plats suggérés. Vous pourrez tout ajuster ensuite."
      }
      title={inviteInfo?.restaurant_name ? `Configurez ${inviteInfo.restaurant_name}` : "Créez votre restaurant"}
    >
      <OnboardingForm
        templates={templates}
        inviteToken={inviteToken}
        defaultRestaurantName={inviteInfo?.restaurant_name ?? undefined}
      />
    </OnboardingPageShell>
  );
}
