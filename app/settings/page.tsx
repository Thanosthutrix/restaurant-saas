import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { uiBackLink, uiCard, uiPageTitle } from "@/components/ui/premium";
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
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Réglages du restaurant</h1>
      </div>

      <section className={`${uiCard} space-y-4`}>
        <h2 className="text-sm font-semibold text-stone-900">Jours de fermeture hebdomadaires</h2>
        <ClosedDaysForm initialDays={closedDays} />
      </section>
    </div>
  );
}
