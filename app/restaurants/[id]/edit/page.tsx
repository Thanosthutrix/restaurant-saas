import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { RestaurantPlanningSection } from "@/components/staff/RestaurantPlanningSection";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { listPublicHolidaysFrMetropole } from "@/lib/franceCalendars/publicHolidays";
import { listSchoolVacationPeriods } from "@/lib/franceCalendars/schoolVacations";
import {
  getRestaurantPlanningBandPresets,
  getRestaurantPlanningHourMaps,
  getRestaurantPlanningPeakBandsWeekly,
  getRestaurantPlanningStaffTargetsWeekly,
  listPlanningDayOverridesInRange,
} from "@/lib/staff/staffDb";
import { getTemplateSuggestions } from "../../actions";
import { EditRestaurantForm } from "./EditRestaurantForm";
import { ApplyTemplateBlock } from "./ApplyTemplateBlock";
import { PublicListingSection } from "./PublicListingSection";
import { GoogleBusinessSection } from "./GoogleBusinessSection";
import { getRestaurantPublicProfileFromDb } from "@/lib/public/publicDb";
import { getRestaurantGoogleState } from "@/lib/google/googleDb";
import { getPublicListingPreview } from "@/lib/public/publicListingPreview";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ google?: string }> };

export default async function EditRestaurantPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { google: googleFlash } = await searchParams;
  const list = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = list.find((r) => r.id === id);
  if (!restaurant) notFound();

  const templates = getRestaurantTemplates();
  // Ces lectures sont toutes indépendantes (elles ne dépendent que de `restaurant`) :
  // un seul Promise.all évite d'empiler ~9 allers-retours DB en série.
  const [
    { suggestions },
    publicProfile,
    publicPreview,
    googleState,
    hourMaps,
    staffTargetsWeekly,
    peakBandsWeekly,
    overrides,
    bandPresets,
  ] = await Promise.all([
    getTemplateSuggestions(restaurant.id),
    getRestaurantPublicProfileFromDb(restaurant.id),
    getPublicListingPreview(restaurant),
    getRestaurantGoogleState(restaurant.id),
    getRestaurantPlanningHourMaps(restaurant.id),
    getRestaurantPlanningStaffTargetsWeekly(restaurant.id),
    getRestaurantPlanningPeakBandsWeekly(restaurant.id),
    listPlanningDayOverridesInRange(restaurant.id, "2020-01-01", "2040-01-01"),
    getRestaurantPlanningBandPresets(restaurant.id),
  ]);

  const calendarYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030] as const;
  const effectiveSchoolZone = restaurant.school_zone ?? "C";
  const publicHolidaysByYear = Object.fromEntries(
    calendarYears.map((y) => [y, listPublicHolidaysFrMetropole(y)])
  );
  const schoolPeriodsByYear = Object.fromEntries(
    calendarYears.map((y) => [y, listSchoolVacationPeriods(y, effectiveSchoolZone)])
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-stone-600 underline decoration-stone-400 underline-offset-2"
          >
            ← Tableau de bord
          </Link>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-stone-900">
          Modifier le restaurant
        </h1>
        <p className="mb-6 text-sm text-stone-500">
          {restaurant.name}
        </p>
        <EditRestaurantForm restaurant={restaurant} templates={templates} />
        {publicProfile ? (
          <>
            <PublicListingSection
              restaurantId={restaurant.id}
              initial={publicProfile}
              preview={publicPreview}
            />
            <GoogleBusinessSection
              restaurantId={restaurant.id}
              initialState={googleState}
              googleFlash={
                googleFlash === "connected" || googleFlash === "error" ? googleFlash : null
              }
            />
          </>
        ) : (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Le portail public nécessite la migration B2C. Exécutez{" "}
            <code className="text-xs">npm run db:apply</code> puis rechargez cette page.
          </p>
        )}
        <div className="mt-6">
          <ApplyTemplateBlock
            restaurantId={restaurant.id}
            templateSlug={restaurant.template_slug}
            suggestions={suggestions}
          />
        </div>

        <div className="mt-10 border-t border-stone-200 pt-8">
          <h2 className="mb-1 text-lg font-semibold text-stone-900">Planning et horaires</h2>
          <p className="mb-6 text-sm text-stone-500">
            Modèle hebdomadaire, objectifs d’effectif, plages de pointe, et exceptions (fermetures, jours spéciaux).
          </p>
          <RestaurantPlanningSection
            restaurantId={restaurant.id}
            openingHours={hourMaps.opening}
            staffExtraBands={hourMaps.staffExtra}
            staffTargetsWeekly={staffTargetsWeekly}
            peakBandsWeekly={peakBandsWeekly}
            overrides={overrides}
            effectiveSchoolZone={effectiveSchoolZone}
            zoneIsAssumed={restaurant.school_zone == null}
            calendarYears={calendarYears}
            publicHolidaysByYear={publicHolidaysByYear}
            schoolPeriodsByYear={schoolPeriodsByYear}
            bandPresets={bandPresets}
          />
        </div>
      </div>
    </div>
  );
}
