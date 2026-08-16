import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { uiCard } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { ClosedDaysForm } from "./ClosedDaysForm";
import { DiningWaitSettingsForm } from "./DiningWaitSettingsForm";
import { ReservationCapacitySettingsForm } from "./ReservationCapacitySettingsForm";
import { ReservationPushRecipientsForm } from "./ReservationPushRecipientsForm";
import { TableMergeGroupsForm } from "./TableMergeGroupsForm";
import { parseDiningWaitThresholds } from "@/lib/dining/diningWaitSettings";
import { getReservationCapacitySummary } from "@/lib/reservations/availability";
import { listDiningTableMergeGroups } from "@/lib/reservations/capacitySettingsDb";
import {
  listReservationPushRecipientOptions,
  resolveActiveReservationPushRecipientIds,
} from "@/lib/reservations/reservationPushRecipients";

export default async function SettingsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: settingsRow } = await supabaseServer
    .from("restaurants")
    .select(
      "closed_days_of_week, dining_wait_green_minutes, dining_wait_orange_minutes, dining_wait_red_minutes"
    )
    .eq("id", restaurant.id)
    .maybeSingle();

  const closedDays: number[] =
    Array.isArray((settingsRow as { closed_days_of_week?: unknown } | null)?.closed_days_of_week)
      ? ((settingsRow as { closed_days_of_week: number[] }).closed_days_of_week)
      : [];
  const waitThresholds = parseDiningWaitThresholds(settingsRow);

  const { settings: reservationSettings, limits: reservationLimits } =
    await getReservationCapacitySummary(restaurant.id);

  const [{ data: diningTables }, mergeGroups] = await Promise.all([
    supabaseServer
      .from("dining_tables")
      .select("id, label")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("label"),
    listDiningTableMergeGroups(restaurant.id),
  ]);

  const tableOptions = (diningTables ?? []).map((t) => ({
    id: String(t.id),
    label: String(t.label),
  }));

  const [pushRecipientOptions, activePushRecipientIds] = await Promise.all([
    listReservationPushRecipientOptions(restaurant.id),
    resolveActiveReservationPushRecipientIds(restaurant.id),
  ]);

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

      <section className={`${uiCard} space-y-4`}>
        <h2 className="text-sm font-semibold text-stone-900">Temps d&apos;attente — plan de salle</h2>
        <DiningWaitSettingsForm initial={waitThresholds} />
      </section>

      <section className={`${uiCard} space-y-4`}>
        <h2 className="text-sm font-semibold text-stone-900">Réservations en ligne — capacité</h2>
        <ReservationCapacitySettingsForm
          initial={reservationSettings}
          limits={reservationLimits}
        />
      </section>

      <section className={`${uiCard} space-y-4`}>
        <h2 className="text-sm font-semibold text-stone-900">Notifications push — réservations</h2>
        <ReservationPushRecipientsForm
          options={pushRecipientOptions}
          initialSelectedUserIds={activePushRecipientIds}
        />
      </section>

      <section className={`${uiCard} space-y-4`}>
        <h2 className="text-sm font-semibold text-stone-900">Tables fusionnables</h2>
        <TableMergeGroupsForm initialGroups={mergeGroups} tables={tableOptions} />
      </section>
    </PageContainer>
  );
}
