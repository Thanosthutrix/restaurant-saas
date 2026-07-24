import Link from "next/link";
import { redirect } from "next/navigation";
import { Armchair } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listAllDiningTablesForAdmin } from "@/lib/dining/diningDb";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiError } from "@/components/ui/premium";
import { SalleTablesClient } from "./SalleTablesClient";

const headerActionBtn =
  "inline-flex min-h-10 items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 active:scale-[0.98]";

export default async function SalleTablesAdminPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: tables, error } = await listAllDiningTablesForAdmin(restaurant.id);

  if (error) {
    return (
      <PageContainer width="narrow">
        <p className={uiError}>{error.message}</p>
      </PageContainer>
    );
  }

  const rows = tables ?? [];
  const activeCount = rows.filter((t) => t.is_active).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Salle", href: "/salle" },
          { label: "Tables" },
        ]}
        title="Gérer les tables"
        subtitle={
          rows.length
            ? `${rows.length} table${rows.length > 1 ? "s" : ""} · ${activeCount} active${activeCount > 1 ? "s" : ""} en salle`
            : "Créez les libellés affichés sur le plan et en service (T.1, Terrasse 3…)."
        }
        accentIcon={Armchair}
        accentTone="bg-copper-50 text-copper-800"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/salle/plan" className={headerActionBtn}>
              Configurer le plan
            </Link>
            <Link href="/salle" className={headerActionBtn}>
              Retour à la salle
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="Aucune table"
          description="Utilisez le formulaire ci-dessous pour créer votre première table — elle pourra ensuite être placée sur le plan de salle."
        />
      ) : null}

      <SalleTablesClient
        restaurantId={restaurant.id}
        tables={rows}
        stats={{ total: rows.length, active: activeCount, inactive: inactiveCount }}
      />
    </PageContainer>
  );
}
