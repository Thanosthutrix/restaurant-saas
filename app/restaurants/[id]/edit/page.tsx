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
  getRestaurantPlanningStaffTargetsWeekly,
  listPlanningDayOverridesInRange,
} from "@/lib/staff/staffDb";
import { getTemplateSuggestions } from "../../actions";
import { EditRestaurantForm } from "./EditRestaurantForm";
import { ApplyTemplateBlock } from "./ApplyTemplateBlock";

type Props = { params: Promise<{ id: string }> };

export default async function EditRestaurantPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const list = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = list.find((r) => r.id === id);
  if (!restaurant) notFound();

  const templates = getRestaurantTemplates();
  const { suggestions } = await getTemplateSuggestions(restaurant.id);

  const [hourMaps, staffTargetsWeekly, overrides, bandPresets] = await Promise.all([
    getRestaurantPlanningHourMaps(restaurant.id),
    getRestaurantPlanningStaffTargetsWeekly(restaurant.id),
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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Tableau de bord
          </Link>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          Modifier le restaurant
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {restaurant.name}
        </p>
        <EditRestaurantForm restaurant={restaurant} templates={templates} />
        <div className="mt-6">
          <ApplyTemplateBlock
            restaurantId={restaurant.id}
            templateSlug={restaurant.template_slug}
            suggestions={suggestions}
          />
        </div>

        <div className="mt-10 border-t border-slate-200 pt-8">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Planning et horaires</h2>
          <p className="mb-6 text-sm text-slate-500">
            Modèle hebdomadaire, objectifs d’effectif par jour, et exceptions (fermetures, jours spéciaux).
          </p>
          <RestaurantPlanningSection
            restaurantId={restaurant.id}
            openingHours={hourMaps.opening}
            staffExtraBands={hourMaps.staffExtra}
            staffTargetsWeekly={staffTargetsWeekly}
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
