import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { uiCard } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { ClosedDaysForm } from "./ClosedDaysForm";

export default async function SettingsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: settingsRow } = await supabaseServer
    .from("restaurants")
    .select("closed_days_of_week")
    .eq("id", restaurant.id)
    .maybeSingle();

  const closedDays: number[] =
    Array.isArray((settingsRow as { closed_days_of_week?: unknown } | null)?.closed_days_of_week)
      ? ((settingsRow as { closed_days_of_week: number[] }).closed_days_of_week)
      : [];

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Réglages" }]}
        title="Réglages du restaurant"
      />

      <section className={`${uiCard} space-y-4`}>
        <h2 className="text-sm font-semibold text-stone-900">Jours de fermeture hebdomadaires</h2>
        <ClosedDaysForm initialDays={closedDays} />
      </section>
    </PageContainer>
  );
}
