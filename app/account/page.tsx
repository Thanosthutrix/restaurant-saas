import type { ReactNode } from "react";
import Link from "next/link";
import { CreditCard, Settings, Shield } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { getAccessibleRestaurantsForUser, getRestaurantForPage, getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { buildCategoryTree, listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { CategoriesTreeClient } from "@/app/categories/CategoriesTreeClient";
import { AccountRubriquesCollapsible } from "@/components/account/AccountRubriquesCollapsible";
import { AccountDangerZones } from "./AccountDangerZones";
import { uiAuthCard } from "@/components/ui/premium";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurants = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = await getRestaurantForPage();
  const ctx = await getShellAccessContext(user.id);
  const isOwner = ctx?.isOwner ?? false;

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
          <CategoriesTreeClient restaurantId={restaurant.id} tree={tree} flat={flat} />
        </AccountRubriquesCollapsible>
      );
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Compte" }]}
        title="Compte"
        subtitle={
          <>
            Connecté en tant que <span className="font-medium text-stone-700">{user.email}</span>
          </>
        }
      />

      <section className={`${uiAuthCard} space-y-3`}>
        <h2 className="text-sm font-semibold text-stone-900">Sécurité</h2>
        <Link
          href="/account/security"
          className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3 text-sm font-medium text-stone-800 transition hover:border-emerald-200 hover:bg-emerald-50/60"
        >
          <Shield className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          Mot de passe & double authentification
        </Link>
      </section>

      {isOwner && (
        <section className={`${uiAuthCard} space-y-3`}>
          <h2 className="text-sm font-semibold text-stone-900">Propriétaire</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/settings/billing"
              className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3 text-sm font-medium text-stone-800 transition hover:border-orange-200 hover:bg-orange-50/60"
            >
              <CreditCard className="h-5 w-5 shrink-0 text-orange-600" aria-hidden />
              Abonnement & facturation
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3 text-sm font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-100"
            >
              <Settings className="h-5 w-5 shrink-0 text-stone-600" aria-hidden />
              Réglages du restaurant
            </Link>
          </div>
        </section>
      )}

      {categoriesSection}

      <div className={uiAuthCard}>
        <AccountDangerZones restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))} />
      </div>
    </PageContainer>
  );
}
