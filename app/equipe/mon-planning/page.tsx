import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import {
  getRestaurantPlanningHourMaps,
  getRestaurantPlanningStaffTargetsWeekly,
  getStaffMemberByUserAndRestaurant,
  listPlanningDayOverridesInRange,
  listStaffMembers,
  listWorkShiftsInRange,
} from "@/lib/staff/staffDb";
import { addDays, mondayFromWeekParam, toISODateString } from "@/lib/staff/weekUtils";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { MonPlanningClient } from "./MonPlanningClient";

type Props = { searchParams: Promise<{ week?: string }> };

export const dynamic = "force-dynamic";

export default async function MonPlanningPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const staff = await getStaffMemberByUserAndRestaurant(user.id, restaurant.id);

  if (!staff) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <Link href="/equipe" className={uiBackLink}>
          ← Équipe & planning
        </Link>
        <h1 className={uiPageTitle}>Mon planning</h1>
        <p className={uiLead}>
          Aucune fiche collaborateur n’est liée à votre compte pour ce restaurant. Le gérant doit créer votre fiche sur
          la page Équipe puis utiliser « Lier mon compte » (ou vous associer manuellement).
        </p>
        <p>
          <Link href="/equipe" className="font-medium text-indigo-700 underline">
            Ouvrir Équipe & planning
          </Link>
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const monday = mondayFromWeekParam(sp.week);
  const weekEndExclusive = addDays(monday, 7);
  const rangeStartIso = monday.toISOString();
  const rangeEndExclusiveIso = weekEndExclusive.toISOString();
  const weekFromYmd = toISODateString(monday);
  const weekToYmdExclusive = toISODateString(weekEndExclusive);
  const prevWeekYmd = toISODateString(addDays(monday, -7));
  const nextWeekYmd = toISODateString(addDays(monday, 7));

  const [staffList, allShifts, hourMaps, staffTargetsWeekly, overrides] = await Promise.all([
    listStaffMembers(restaurant.id, true),
    listWorkShiftsInRange(restaurant.id, rangeStartIso, rangeEndExclusiveIso),
    getRestaurantPlanningHourMaps(restaurant.id),
    getRestaurantPlanningStaffTargetsWeekly(restaurant.id),
    listPlanningDayOverridesInRange(restaurant.id, weekFromYmd, weekToYmdExclusive),
  ]);

  const myShifts = allShifts
    .filter((s) => s.staff_member_id === staff.id)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 px-4 py-6">
      <div>
        <Link href="/equipe" className={uiBackLink}>
          ← Équipe & planning
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Mon planning</h1>
        <p className={`mt-2 ${uiLead}`}>
          Bonjour {staff.display_name}. Consultez le planning de l’équipe et votre récapitulatif hebdomadaire ; le
          démarrage et la fin de journée se font avec les boutons dédiés (également disponibles sur le tableau de bord).
        </p>
      </div>

      <MonPlanningClient
        restaurantId={restaurant.id}
        weekMondayIso={weekFromYmd}
        prevWeekYmd={prevWeekYmd}
        nextWeekYmd={nextWeekYmd}
        allShifts={allShifts}
        myShifts={myShifts}
        staff={staffList}
        planningOpeningHours={hourMaps.opening}
        planningStaffExtraBands={hourMaps.staffExtra}
        planningStaffTargetsWeekly={staffTargetsWeekly}
        planningDayOverrides={overrides}
      />
    </div>
  );
}
