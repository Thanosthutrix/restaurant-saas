import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessibleRestaurantsForUser, getCurrentRestaurant, getCurrentUser } from "@/lib/auth";
import { buildCategoryTree, listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { CategoriesTreeClient } from "@/app/categories/CategoriesTreeClient";
import { AccountRubriquesCollapsible } from "@/components/account/AccountRubriquesCollapsible";
import { AccountDangerZones } from "./AccountDangerZones";
import { uiAuthCard, uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurants = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = await getCurrentRestaurant();

  let categoriesSection: ReactNode = null;
  if (restaurant) {
    const { data: flat, error } = await listRestaurantCategories(restaurant.id);
    if (error) {
      categoriesSection = (
        <section id="rubriques" className="scroll-mt-4">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error.message}
          </p>
        </section>
      );
    } else {
      const tree = buildCategoryTree(flat);
      const count = flat.length;
      categoriesSection = (
        <AccountRubriquesCollapsible rubriqueCount={count}>
          <CategoriesTreeClient restaurantId={restaurant.id} tree={tree} />
        </AccountRubriquesCollapsible>
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Compte</h1>
        <p className={`mt-2 ${uiLead}`}>
          Connecté en tant que <span className="font-medium text-slate-700">{user.email}</span>
        </p>
      </div>

      {categoriesSection}

      <div className={uiAuthCard}>
        <AccountDangerZones restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))} />
      </div>
    </div>
  );
}
