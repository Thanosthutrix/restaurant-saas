import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { computePlanningAlerts } from "@/lib/staff/planningAlerts";
import { resolveWeekPlanningDays } from "@/lib/staff/planningResolve";
import {
  getPlanningWeekSimulation,
  getRestaurantPlanningHourMaps,
  getRestaurantPlanningPeakBandsWeekly,
  getRestaurantPlanningSecurityFloor,
  getRestaurantPlanningStaffTargetsWeekly,
  listPlanningDayOverridesInRange,
  listSimulationShiftsWithDetails,
  listWorkShiftsInRange,
} from "@/lib/staff/staffDb";
import { cachedListStaffMembers } from "@/lib/cache";
import { hydratePlanningWizard } from "@/lib/staff/wizard/hydratePlanningWizard";
import { addDays, mondayFromWeekParam, toISODateString } from "@/lib/staff/weekUtils";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { EquipePlanningClient } from "./EquipePlanningClient";

type Props = { searchParams: Promise<{ week?: string; planning?: string }> };

export const dynamic = "force-dynamic";

export default async function EquipePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");
  const restaurant = ctx.currentRestaurant;

  const sp = await searchParams;
  const initialPlanningMode = sp.planning === "sim" ? ("simulation" as const) : ("real" as const);
  const monday = mondayFromWeekParam(sp.week);
  const weekEndExclusive = addDays(monday, 7);
  const rangeStartIso = monday.toISOString();
  const rangeEndExclusiveIso = weekEndExclusive.toISOString();
  const weekFromYmd = toISODateString(monday);
  const weekToYmdExclusive = toISODateString(weekEndExclusive);

  const [staff, shifts, hourMaps, staffTargetsWeekly, peakBandsWeekly, overrides, weekSim, securityFloor] =
    await Promise.all([
      cachedListStaffMembers(restaurant.id),
      listWorkShiftsInRange(restaurant.id, rangeStartIso, rangeEndExclusiveIso),
      getRestaurantPlanningHourMaps(restaurant.id),
      getRestaurantPlanningStaffTargetsWeekly(restaurant.id),
      getRestaurantPlanningPeakBandsWeekly(restaurant.id),
      listPlanningDayOverridesInRange(restaurant.id, weekFromYmd, weekToYmdExclusive),
      getPlanningWeekSimulation(restaurant.id, weekFromYmd),
      getRestaurantPlanningSecurityFloor(restaurant.id),
    ]);

  // Hydratation complète du wizard (OBJECTIF 1) : pré-remplissage avec provenance par champ.
  const wizardData = await hydratePlanningWizard(restaurant.id, weekFromYmd, {
    templateSlug: restaurant.template_slug ?? null,
    schoolZone: restaurant.school_zone ?? null,
  });

  const weekMondayStr = weekFromYmd;
  const simulationId = weekSim?.id ?? null;
  const simulationShifts =
    simulationId != null
      ? await listSimulationShiftsWithDetails(restaurant.id, simulationId)
      : [];
  const resolvedWeekDays = resolveWeekPlanningDays(
    monday,
    hourMaps.opening,
    hourMaps.staffExtra,
    staffTargetsWeekly,
    overrides
  );
  const planningAlerts = computePlanningAlerts({
    weekStartMonday: monday,
    shifts,
    staff,
    resolvedWeekDays,
  });
  const simulationAlerts = computePlanningAlerts({
    weekStartMonday: monday,
    shifts: simulationShifts,
    staff,
    resolvedWeekDays,
  });

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Équipe & planning</h1>
        <p className={`mt-2 ${uiLead}`}>
          Créneaux planifiés et temps d’équipe : le gérant gère l’équipe ; chaque collaborateur dont la fiche est liée
          au compte enregistre le début et la fin de journée depuis « Mon planning » ou le tableau de bord.
        </p>
      </div>

      <p className="flex flex-wrap gap-4 text-sm">
        <Link href="/equipe/mon-planning" className="font-medium text-copper-800 underline">
          Mon planning (collaborateur)
        </Link>
        <Link href="/equipe/contrats" className="font-medium text-copper-800 underline">
          Contrats HCR
        </Link>
      </p>

      <EquipePlanningClient
        restaurantId={restaurant.id}
        currentUserId={user.id}
        weekMondayIso={weekMondayStr}
        initialPlanningMode={initialPlanningMode}
        staff={staff}
        shifts={shifts}
        simulationId={simulationId}
        simulationShifts={simulationShifts}
        resolvedWeekDays={resolvedWeekDays}
        planningOpeningHours={hourMaps.opening}
        planningStaffExtraBands={hourMaps.staffExtra}
        planningStaffTargetsWeekly={staffTargetsWeekly}
        planningPeakBandsWeekly={peakBandsWeekly}
        planningDayOverrides={overrides}
        planningAlerts={planningAlerts}
        simulationAlerts={simulationAlerts}
        planningSecurityFloor={securityFloor}
        wizardData={wizardData}
      />
    </div>
  );
}
