import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listDiningTables, listOpenDiningOrders } from "@/lib/dining/diningDb";
import { uiBackLink, uiCard, uiLead, uiPageTitle, uiSectionTitleSm } from "@/components/ui/premium";

export default async function SallePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: tables, error: tErr }, { data: openOrders, error: oErr }] = await Promise.all([
    listDiningTables(restaurant.id),
    listOpenDiningOrders(restaurant.id),
  ]);

  if (tErr || oErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {tErr?.message ?? oErr?.message ?? "Erreur de chargement."}
        </p>
      </div>
    );
  }

  const openByTable = new Map(
    openOrders
      .filter((o) => o.dining_table_id != null)
      .map((o) => [o.dining_table_id as string, o.id])
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={uiPageTitle}>Salle</h1>
          <p className={`mt-2 ${uiLead}`}>Tables actives et commandes en cours.</p>
        </div>
        <Link
          href="/salle/tables"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Gérer les tables
        </Link>
      </div>

      {!tables.length ? (
        <div className={`${uiCard} space-y-3`}>
          <p className={uiLead}>Aucune table active. Créez des tables pour prendre des commandes.</p>
          <Link href="/salle/tables" className="inline-block text-sm font-semibold text-indigo-600">
            Ajouter des tables →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tables.map((t) => {
            const orderId = openByTable.get(t.id);
            return (
              <li key={t.id}>
                <Link
                  href={`/salle/table/${t.id}`}
                  className={`${uiCard} block transition hover:border-indigo-100 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={uiSectionTitleSm}>{t.label}</p>
                      <p className={`mt-1 ${uiLead}`}>
                        {orderId ? "Commande en cours — reprendre" : "Ouvrir une commande"}
                      </p>
                    </div>
                    {orderId ? (
                      <span className="inline-flex shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Ouverte
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Libre
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
