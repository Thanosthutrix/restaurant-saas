import { redirect, notFound } from "next/navigation";
import { Building2, CalendarClock } from "lucide-react";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { RestaurantPlanningSection } from "@/components/staff/RestaurantPlanningSection";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
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
import { SocialAccountsSection } from "./SocialAccountsSection";
import { getRestaurantPublicProfileFromDb } from "@/lib/public/publicDb";
import { getRestaurantGoogleState } from "@/lib/google/googleDb";
import { getRestaurantSocialState } from "@/lib/meta/metaDb";
import { getPublicListingPreview } from "@/lib/public/publicListingPreview";
import { uiWarn } from "@/components/ui/premium";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ google?: string; meta?: string }> };

export default async function EditRestaurantPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { google: googleFlash, meta: metaFlash } = await searchParams;
  const list = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = list.find((r) => r.id === id);
  if (!restaurant) notFound();

  const templates = getRestaurantTemplates();
  const [
    { suggestions },
    publicProfile,
    publicPreview,
    googleState,
    socialState,
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
    getRestaurantSocialState(restaurant.id),
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
    <PageContainer>
      <PageHeader
        accentIcon={Building2}
        accentTone="bg-copper-50 text-copper-700"
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Fiche établissement" },
        ]}
        title="Fiche établissement"
        subtitle={`${restaurant.name} · identité, visibilité publique, Google Business, réseaux sociaux et planning.`}
      />

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
          <SocialAccountsSection
            restaurantId={restaurant.id}
            initialState={socialState}
            metaFlash={metaFlash === "connected" || metaFlash === "error" ? metaFlash : null}
          />
        </>
      ) : (
        <p className={uiWarn}>
          Le portail public nécessite la migration B2C. Exécutez{" "}
          <code className="text-xs">npm run db:apply</code> puis rechargez cette page.
        </p>
      )}

      <ApplyTemplateBlock
        restaurantId={restaurant.id}
        templateSlug={restaurant.template_slug}
        suggestions={suggestions}
      />

      <EstablishmentSection
        id="planning"
        icon={CalendarClock}
        iconTone="bg-violet-50 text-violet-700 ring-violet-100"
        title="Planning et horaires"
        subtitle="Modèle hebdomadaire, objectifs d'effectif, plages de pointe et exceptions (fermetures, jours spéciaux). Synchronisés vers le portail public et Google Business."
      >
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
      </EstablishmentSection>
    </PageContainer>
  );
}
