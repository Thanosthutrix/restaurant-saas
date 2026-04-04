import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { AccountDangerZones } from "./AccountDangerZones";
import { uiAuthCard, uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurants = await getAccessibleRestaurantsForUser(user.id);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Compte</h1>
        <p className={`mt-2 ${uiLead}`}>
          Connecté en tant que <span className="font-medium text-slate-700">{user.email}</span>
        </p>
      </div>
      <div className={uiAuthCard}>
        <AccountDangerZones restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))} />
      </div>
    </div>
  );
}
