import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import {
  listOpenOrdersForCaisse,
  listSettledOrdersToday,
  type SettledOrderSummary,
} from "@/lib/dining/diningDb";
import { toNumber } from "@/lib/utils/safeNumeric";
import { uiBackLink, uiCard, uiLead, uiPageTitle, uiSectionTitleSm } from "@/components/ui/premium";
import { CaisseNewTicketForm } from "./CaisseNewTicketForm";

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

export default async function CaissePage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const [{ data: openRows, error: openErr }, { data: settledRows, error: settledErr }] =
    await Promise.all([
      listOpenOrdersForCaisse(restaurant.id),
      listSettledOrdersToday(restaurant.id),
    ]);

  if (openErr || settledErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {openErr?.message ?? settledErr?.message ?? "Erreur de chargement."}
        </p>
      </div>
    );
  }

  const open = openRows ?? [];
  const list = settledRows ?? [];
  const totals = totalsByPayment(list);
  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Caisse</h1>
        <p className={`mt-2 ${uiLead}`}>
          Commandes en cours (salle et comptoir), nouveaux tickets, puis encaissements du jour (Paris).
        </p>
      </div>

      <CaisseNewTicketForm restaurantId={restaurant.id} />

      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>En cours</h2>
        {open.length === 0 ? (
          <div className={uiCard}>
            <p className={uiLead}>Aucune commande ouverte.</p>
            <p className={`mt-2 ${uiLead}`}>
              Les tables lancées depuis la{" "}
              <Link href="/salle" className="font-semibold text-indigo-600">
                salle
              </Link>{" "}
              apparaissent ici aussi.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {open.map((row) => (
              <li key={row.orderId} className={uiCard}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {row.kind === "counter" ? "Comptoir · " : "Table "}
                      {row.label}
                    </p>
                    <p className={`mt-0.5 text-sm ${uiLead}`}>
                      {row.lineCount} ligne{row.lineCount !== 1 ? "s" : ""} · {fmtEur(row.totalTtc)}
                    </p>
                  </div>
                  <Link
                    href={`/salle/commande/${row.orderId}?from=caisse`}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    Ouvrir / encaisser
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>Encaissements du jour</h2>
        {list.length === 0 ? (
          <div className={uiCard}>
            <p className={uiLead}>Aucun encaissement aujourd’hui.</p>
          </div>
        ) : (
          <>
            <div className={`${uiCard} space-y-3`}>
              <p className="text-sm font-semibold text-slate-700">Totaux</p>
              <ul className="space-y-1 text-sm text-slate-700">
                {[...totals.entries()].map(([method, sum]) => (
                  <li key={method} className="flex justify-between gap-4">
                    <span>{paymentLabel(method)}</span>
                    <span className="font-semibold tabular-nums">
                      {fmtEur(Math.round(sum * 100) / 100)}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between gap-4 border-t border-slate-100 pt-2 font-semibold text-slate-900">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtEur(Math.round(grandTotal * 100) / 100)}</span>
                </li>
              </ul>
            </div>

            <div>
              <p className={`mb-2 text-sm font-semibold text-slate-700`}>Détail</p>
              <ul className="space-y-2">
                {list.map(({ order, table_label: displayLabel, payment }) => (
                  <li key={order.id} className="space-y-2">
                    <Link
                      href={`/salle/commande/${order.id}?from=caisse`}
                      className={`${uiCard} block transition hover:border-indigo-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{displayLabel}</p>
                          <p className={`mt-0.5 text-sm ${uiLead}`}>
                            {settledTimeParis(order.settled_at)} ·{" "}
                            {paymentLabel(payment?.payment_method)}
                          </p>
                        </div>
                        <p className="text-lg font-semibold tabular-nums text-slate-900">
                          {fmtEur(toNumber(payment?.amount_ttc))}
                        </p>
                      </div>
                    </Link>
                    {order.service_id ? (
                      <p className="px-1">
                        <Link
                          href={`/service/${order.service_id}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          Service →
                        </Link>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
