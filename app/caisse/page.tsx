import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getRestaurantForPage } from "@/lib/auth";
import { cachedLoadDiningOrderCatalogData } from "@/lib/cache";
import { listOpenOrdersForCaisse, listSettledOrdersToday, type SettledOrderSummary } from "@/lib/dining/diningDb";
import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { toNumber } from "@/lib/utils/safeNumeric";
import { Armchair, Receipt } from "lucide-react";
import { uiCard, uiLead, uiSectionTitleSm } from "@/components/ui/premium";
import { EmptyState } from "@/components/ui/EmptyState";
import { CaisseDishPicker } from "./CaisseDishPicker";
import { CaisseOpenOrdersGrid } from "./CaisseOpenOrdersGrid";
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

function CaisseSettledFallback() {
  return (
    <section className="space-y-3">
      <h2 className={uiSectionTitleSm}>Encaissements du jour</h2>
      <div className={`${uiCard} space-y-2`}>
        <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-stone-100" />
      </div>
      <p className={`text-xs ${uiLead}`}>Chargement des encaissements…</p>
    </section>
  );
}

async function CaisseSettledSection({ restaurantId }: { restaurantId: string }) {
  const { data: settledRows, error: settledErr } = await listSettledOrdersToday(restaurantId);

  if (settledErr) {
    return (
      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>Encaissements du jour</h2>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {settledErr.message}
        </p>
      </section>
    );
  }

  const settledList = settledRows ?? [];
  const totals = totalsByPayment(settledList);
  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);

  return (
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
  );
}

export default async function CaissePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: openRows, error: openErr }, catalogRes, customerSearchPool] = await Promise.all([
    listOpenOrdersForCaisse(restaurant.id),
    cachedLoadDiningOrderCatalogData(restaurant.id),
    listRecentCustomersForLookup(restaurant.id, 40),
  ]);

  if (openErr || catalogRes.error || !catalogRes.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {openErr?.message ?? catalogRes.error ?? "Erreur de chargement."}
        </p>
      </div>
    );
  }

  const orderSession = {
    ...catalogRes.data,
    customerSearchPool,
  };

  const open = openRows ?? [];
  const { catalogRoots, directByCategoryId, uncategorized } = catalogRes.data;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-4">
      <CaisseDishPicker
        restaurantId={restaurant.id}
        roots={catalogRoots}
        directByCategoryId={directByCategoryId}
        uncategorized={uncategorized}
        recentCustomerPool={customerSearchPool}
      />

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
          <CaisseOpenOrdersGrid
            restaurantId={restaurant.id}
            orders={open}
            orderSession={orderSession}
          />
        )}
      </section>

      <Suspense fallback={<CaisseSettledFallback />}>
        <CaisseSettledSection restaurantId={restaurant.id} />
      </Suspense>
    </div>
  );
}
