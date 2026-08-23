import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
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

  const user = await getCurrentUser();
  const ctx = user ? await getShellAccessContext(user.id) : null;
  const isOwner = ctx?.isOwner ?? false;

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

      {isOwner && (
        <section className={`${uiCard} space-y-4`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <CreditCard className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-stone-900">Abonnement Ubion Pro</h2>
              <p className="mt-1 text-sm text-stone-600">
                Souscrire, gérer votre abonnement, vos factures et votre moyen de paiement.
              </p>
              <Link
                href="/settings/billing"
                className="mt-3 inline-flex text-sm font-medium text-orange-700 hover:text-orange-800"
              >
                Gérer l&apos;abonnement →
              </Link>
            </div>
          </div>
        </section>
      )}

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
