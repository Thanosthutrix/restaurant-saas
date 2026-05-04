import Link from "next/link";
import type { RestaurantMonthlyRevenue } from "@/lib/db";
import { hasImportedRevenueDetail } from "@/lib/revenue-statement-analysisJson";
import { ImportedRevenueDetailBlock } from "@/components/insights/ImportedRevenueDetailBlock";
import { uiCard } from "@/components/ui/premium";

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatMonthFr(isoMonth: string) {
  return new Date(isoMonth + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

/** Comparaison YYYY-MM pour inclure les mois calendaires couverts par la plage de dates. */
function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function rowMonthInRange(monthFirstDay: string, from: string, to: string): boolean {
  const mk = monthKey(monthFirstDay);
  const fk = monthKey(from);
  const tk = monthKey(to);
  return mk >= fk && mk <= tk;
}

function primaryAmount(r: RestaurantMonthlyRevenue): number | null {
  if (r.revenue_ttc != null && Number.isFinite(r.revenue_ttc)) return r.revenue_ttc;
  if (r.revenue_ht != null && Number.isFinite(r.revenue_ht)) return r.revenue_ht;
  return null;
}

export function ImportedMonthlyCaSection({
  rows,
  rangeFrom,
  rangeTo,
}: {
  rows: RestaurantMonthlyRevenue[];
  rangeFrom: string;
  rangeTo: string;
}) {
  const sorted = [...rows].sort((a, b) => b.month.localeCompare(a.month));
  const maxAmt =
    sorted.reduce((m, r) => Math.max(m, primaryAmount(r) ?? 0), 0) || 1;

  const inRangeCount = sorted.filter((r) =>
    rowMonthInRange(r.month, rangeFrom, rangeTo)
  ).length;

  return (
    <section className="space-y-4">
      <div className={uiCard}>
        <h2 className="text-lg font-semibold text-slate-900">CA importé (photos & relevés)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Les montants saisis <strong className="font-medium text-slate-800">avant ou en parallèle</strong> de
          l&apos;usage quotidien — extraits de vos documents à l&apos;intégration — sont enregistrés{" "}
          <strong className="font-medium text-slate-800">mois par mois</strong>. Le bloc « détail par plat » plus bas
          dans cette page repose sur les <strong className="font-medium text-slate-800">services</strong> saisis dans
          l&apos;application (autre niveau de précision).
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Quand le relevé photo contient un <strong className="font-medium text-slate-800">détail</strong> (lignes
          plats, familles, montants), il est affiché sous chaque mois. Les totaux ci‑dessus restent la référence
          mensuelle ; le détail est une <strong className="font-medium text-slate-800">lecture du document</strong>{" "}
          (non reliée automatiquement à votre carte).
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Ils servent de <strong className="font-medium text-slate-800">référence de CA</strong> pour
          la dynamique dans le temps, y compris pour les mois sans utilisation de l&apos;app.
        </p>
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/insights/revenue"
            className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Voir l&apos;historique CA importé (tableau détaillé)
          </Link>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">
            {inRangeCount > 0
              ? `${inRangeCount} mois concernés par la période filtrée ci‑dessus (sur ${sorted.length} mois en base).`
              : `Aucun mois importé ne tombe dans la période ${rangeFrom} → ${rangeTo} ; les barres montrent tout l&apos;historique disponible.`}
          </span>
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className={uiCard}>
          <p className="text-sm text-slate-700">
            Aucun CA mensuel importé pour l&apos;instant. Vous pouvez l&apos;ajouter depuis le parcours
            d&apos;intégration (documents de chiffre d&apos;affaires) ; les montants apparaîtront ici et sur{" "}
            <Link href="/insights/revenue" className="font-medium text-indigo-600 underline">
              CA importé
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:hidden">
            Faites défiler horizontalement si besoin.
          </p>
          <div className="overflow-x-auto p-4">
            <div className="space-y-4">
              {sorted.map((r) => {
                const amt = primaryAmount(r);
                const inRange = rowMonthInRange(r.month, rangeFrom, rangeTo);
                const pct = amt != null ? Math.max(10, (amt / maxAmt) * 100) : 8;
                return (
                  <div key={r.id} className="min-w-[280px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize text-slate-900">
                          {formatMonthFr(r.month)}
                        </span>
                        {inRange ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                            Période analyse
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Hors plage filtre
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums text-sm font-semibold text-slate-900">
                        {formatEur(r.revenue_ttc ?? null)}
                        <span className="ml-2 font-normal text-slate-500">TTC</span>
                        {r.revenue_ht != null ? (
                          <>
                            <span className="mx-1 text-slate-300">·</span>
                            {formatEur(r.revenue_ht)}
                            <span className="ml-1 font-normal text-slate-500">HT</span>
                          </>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          inRange ? "bg-indigo-500" : "bg-slate-400/70"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {(r.source_label?.trim() || r.notes?.trim()) && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        {[r.source_label?.trim(), r.notes?.trim()].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {hasImportedRevenueDetail(r.analysis_result_json) ? (
                      <div className="mt-3">
                        <ImportedRevenueDetailBlock
                          analysisJson={r.analysis_result_json}
                          className="p-3"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
