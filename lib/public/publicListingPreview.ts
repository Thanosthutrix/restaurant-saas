import type { Restaurant } from "@/lib/auth";
import { getEstablishmentLabels } from "@/lib/restaurant/establishmentLabels";
import { getHygieneScoreForRestaurant } from "@/lib/hygiene/hygieneDb";
import { formatOpeningHoursForPublic } from "@/lib/public/formatOpeningHours";
import { mapLiveHygieneToPublicView } from "@/lib/public/liveHygieneLabel";
import { getRestaurantPlanningHourMaps } from "@/lib/staff/staffDb";
import { supabaseServer } from "@/lib/supabaseServer";

export type PublicListingPreview = {
  address: string;
  cuisine_type: string;
  opening_hours: string;
  hygiene_label: string;
  hygiene_score_live: number | null;
  hygiene_has_live_data: boolean;
  hygiene_detail: string;
};

export async function getPublicListingPreview(
  restaurant: Restaurant
): Promise<PublicListingPreview> {
  const labels = getEstablishmentLabels(restaurant);

  const [{ opening }, hygiene, closedDaysRow] = await Promise.all([
    getRestaurantPlanningHourMaps(restaurant.id),
    getHygieneScoreForRestaurant(restaurant.id, 7),
    supabaseServer
      .from("restaurants")
      .select("closed_days_of_week")
      .eq("id", restaurant.id)
      .maybeSingle(),
  ]);

  const closedDays = Array.isArray(
    (closedDaysRow.data as { closed_days_of_week?: unknown } | null)?.closed_days_of_week
  )
    ? ((closedDaysRow.data as { closed_days_of_week: number[] }).closed_days_of_week ?? [])
    : [];

  const hygieneView = mapLiveHygieneToPublicView(
    hygiene.score,
    hygiene.max > 0,
    hygiene.detail
  );

  return {
    address: labels.addressLabel ?? "Adresse non renseignée",
    cuisine_type: labels.activityLabel !== "—" ? labels.activityLabel : "Restaurant",
    opening_hours: formatOpeningHoursForPublic(opening, closedDays),
    hygiene_label: hygieneView.label,
    hygiene_score_live: hygieneView.numericScore,
    hygiene_has_live_data: hygieneView.hasData,
    hygiene_detail: hygieneView.detail,
  };
}
