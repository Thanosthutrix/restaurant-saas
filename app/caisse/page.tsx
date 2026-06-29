import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  buildCategoryTree,
  buildDirectItemsByCategoryId,
  filterCategoryTreeByIds,
  listRestaurantCategories,
  pruneCategoryTreeWithItems,
  visibleCategoryIdsWithAncestors,
} from "@/lib/catalog/restaurantCategories";
import {
  listOpenOrdersForCaisse,
  listSettledOrdersToday,
  type SettledOrderSummary,
} from "@/lib/dining/diningDb";
import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { getDishes } from "@/lib/db";
import { toNumber } from "@/lib/utils/safeNumeric";
import { Armchair, Receipt, ShoppingBag } from "lucide-react";
import { uiCard, uiLead, uiSectionTitleSm } from "@/components/ui/premium";
import { EmptyState } from "@/components/ui/EmptyState";
import { CaisseDishPicker } from "./CaisseDishPicker";
import { CaisseSettledTickets } from "./CaisseSettledTickets";

function fmtEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function paymentLabel(method: string | undefined): string {
  switch (method) {
    case "cash":
      return "Espèces";
    case "card":
      return "Carte bancaire";
    case "cheque":
      return "Chèques";
    case "other":
      return "Autre";
    default:
      return method ?? "—";
  }
}

function settledTimeParis(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function totalsByPayment(rows: SettledOrderSummary[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const m = r.payment?.payment_method ?? "—";
    const amt = toNumber(r.payment?.amount_ttc);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    map.set(m, (map.get(m) ?? 0) + amt);
  }
  return map;
}

async function CaisseCatalogSection({ restaurantId }: { restaurantId: string }) {
  const [
    { data: dishesList, error: dishesErr },
    { data: flatCats, error: catErr },
    recentCustomerPool,
  ] = await Promise.all([
    getDishes(restaurantId),
    listRestaurantCategories(restaurantId),
    listRecentCustomersForLookup(restaurantId, 80),
  ]);

  if (dishesErr || catErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {dishesErr?.message ?? catErr?.message ?? "Erreur de chargement."}
        </p>
      </div>
    );
  }

  const dishes = dishesList ?? [];
  const cats = flatCats ?? [];
  const directMap = buildDirectItemsByCategoryId(dishes);
  const assignedIds = [...new Set(dishes.map((d) => d.category_id).filter(Boolean) as string[])];
  const visible = visibleCategoryIdsWithAncestors(cats, assignedIds);
  const tree = buildCategoryTree(cats);
  const filtered = filterCategoryTreeByIds(tree, visible);
  const prunedRoots = pruneCategoryTreeWithItems(filtered, directMap);
  const uncategorized = dishes.filter((d) => !d.category_id);
  const directByCategoryId = Object.fromEntries(directMap);

  return (
    <CaisseDishPicker
      restaurantId={restaurantId}
      roots={prunedRoots}
      directByCategoryId={directByCategoryId}
      uncategorized={uncategorized}
      recentCustomerPool={recentCustomerPool}
    />
  );
}

function CaisseCatalogFallback() {
  return (
    <section className={`${uiCard} space-y-3`}>
      <div className="h-5 w-44 animate-pulse rounded-lg bg-stone-200" />
      <div className="space-y-2">
        <div className="h-10 w-full animate-pulse rounded-xl bg-stone-100" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-stone-100" />
        <div className="h-10 w-2/3 animate-pulse rounded-xl bg-stone-100" />
      </div>
      <p className={uiLead}>Chargement rapide de la carte caisse…</p>
    </section>
  );
}

export default async function CaissePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [
    { data: openRows, error: openErr },
    { data: settledRows, error: settledErr },
  ] = await Promise.all([
    listOpenOrdersForCaisse(restaurant.id),
    listSettledOrdersToday(restaurant.id),
  ]);

  if (openErr || settledErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {openErr?.message ??
            settledErr?.message ??
            "Erreur de chargement."}
        </p>
      </div>
    );
  }

  const open = openRows ?? [];
  const settledList = settledRows ?? [];
  const totals = totalsByPayment(settledList);
  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-4">
      <Suspense fallback={<CaisseCatalogFallback />}>
        <CaisseCatalogSection restaurantId={restaurant.id} />
      </Suspense>

      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>En cours</h2>
        {open.length === 0 ? (
          <EmptyState
            icon={Armchair}
            title="Aucune commande ouverte"
            description="Lancez un ticket ci-dessus, ou ouvrez une table en salle — elle apparaîtra ici aussi."
            actionLabel="Aller en salle"
            actionHref="/salle"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {open.map((row) => {
              const RowIcon = row.kind === "counter" ? ShoppingBag : Armchair;
              return (
                <li key={row.orderId}>
                  <Link
                    href={`/salle/commande/${row.orderId}?from=caisse`}
                    className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-copper-300 bg-copper-50/60 p-3 text-center shadow-sm ring-1 ring-copper-200 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-600"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-copper-100 text-copper-800">
                      <RowIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="line-clamp-1 font-semibold text-stone-900">
                      {row.kind === "counter" ? row.label : `Table ${row.label}`}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-copper-800">{fmtEur(row.totalTtc)}</span>
                    <span className="text-[11px] text-stone-500">
                      {row.lineCount} ligne{row.lineCount !== 1 ? "s" : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>Encaissements du jour</h2>
        {settledList.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Aucun encaissement aujourd’hui"
            description="Les tickets réglés de la journée s’afficheront ici."
            compact
          />
        ) : (
          <>
            <div className={`${uiCard} space-y-3`}>
              <p className="text-sm font-semibold text-stone-700">Totaux</p>
              <ul className="space-y-1 text-sm text-stone-700">
                {[...totals.entries()].map(([method, sum]) => (
                  <li key={method} className="flex justify-between gap-4">
                    <span>{paymentLabel(method)}</span>
                    <span className="font-semibold tabular-nums">
                      {fmtEur(Math.round(sum * 100) / 100)}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between gap-4 border-t border-stone-100 pt-2 font-semibold text-stone-900">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtEur(Math.round(grandTotal * 100) / 100)}</span>
                </li>
              </ul>
            </div>

            <CaisseSettledTickets
              tickets={settledList.map(({ order, table_label: displayLabel, payment }) => ({
                orderId: order.id,
                label: displayLabel,
                time: settledTimeParis(order.settled_at),
                payment: paymentLabel(payment?.payment_method),
                amount: toNumber(payment?.amount_ttc),
                serviceId: order.service_id ?? null,
              }))}
            />
          </>
        )}
      </section>
    </div>
  );
}
