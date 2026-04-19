import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getStaffMemberByUserAndRestaurant, listWorkShiftsForStaffFrom } from "@/lib/staff/staffDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { MonPlanningClient } from "./MonPlanningClient";

export default async function MonPlanningPage() {
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

  const from = new Date();
  from.setDate(from.getDate() - 1);
  from.setHours(0, 0, 0, 0);

  const shifts = await listWorkShiftsForStaffFrom(restaurant.id, staff.id, from.toISOString(), 60);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <Link href="/equipe" className={uiBackLink}>
          ← Équipe & planning
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Mon planning</h1>
        <p className={`mt-2 ${uiLead}`}>
          Bonjour {staff.display_name}. Pointez votre arrivée et votre sortie sur chaque créneau.
        </p>
      </div>

      <MonPlanningClient restaurantId={restaurant.id} shifts={shifts} />
    </div>
  );
}
