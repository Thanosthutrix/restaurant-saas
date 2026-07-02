import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Coins, Info, Receipt, UtensilsCrossed, Wallet } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getMarginAnalysisRows } from "@/lib/margins/dishMarginAnalysis";
import { getRealizedMarginRowsByDish } from "@/lib/margins/realizedDishMargins";
import {
  defaultMarginDateRange,
  fetchServicesInDateRange,
  getRealizedMarginRowsForServices,
  parseMarginDateParam,
} from "@/lib/margins/realizedServiceMargins";
import { MarginsCardTable } from "./MarginsCardTable";
import { MarginsCustomRangeForm } from "./MarginsCustomRangeForm";
import { MarginsDateRangeLinks } from "./MarginsDateRangeLinks";
import {
  DishLeaderboard,
  type LeaderItem,
  MarginDonut,
  RateCell,
  RateChip,
  SplitBar,
  StatCard,
  fmtEur,
  fmtPct,
  marginTier,
} from "./marginsUi";
import { uiTableLink } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

function formatServiceType(t: string) {
  return t === "lunch" ? "Midi" : t === "dinner" ? "Soir" : t;
}

function formatServiceDate(iso: string) {
  return new Date(iso + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Top n et flop n (sans recouvrement) parmi les items ayant un taux connu. */
function topFlop(items: LeaderItem[], n = 3): { top: LeaderItem[]; flop: LeaderItem[] } {
  const withPct = items.filter((x) => x.pct != null);
  const sorted = [...withPct].sort((a, b) => (b.pct as number) - (a.pct as number));
  const top = sorted.slice(0, n);
  const flopStart = Math.max(n, sorted.length - n);
  const flop = sorted.slice(flopStart).reverse();
  return { top, flop };
}

type SearchParams = { from?: string; to?: string };

export default async function MarginsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const defaults = defaultMarginDateRange();
  let from = parseMarginDateParam(sp.from, defaults.from);
  let to = parseMarginDateParam(sp.to, defaults.to);
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }

  const [{ rows, error }, servicesInRange] = await Promise.all([
    getMarginAnalysisRows(restaurant.id),
    fetchServicesInDateRange(restaurant.id, from, to, 80),
  ]);
  const [realizedRows, dishMarginRows] = await Promise.all([
    getRealizedMarginRowsForServices(restaurant.id, servicesInRange),
    getRealizedMarginRowsByDish(
      restaurant.id,
      servicesInRange.map((s) => s.id)
    ),
  ]);

  const sorted = [...rows].sort((a, b) => {
    const pa = a.marginPct;
    const pb = b.marginPct;
    if (pa != null && pb != null && pb !== pa) return pb - pa;
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    return a.dishName.localeCompare(b.dishName, "fr");
  });

  // Agrégats réalisés (services)
  let sumRev = 0;
  let sumCost = 0;
  let sumMargin = 0;
  let sumRevForMargin = 0;
  let partialServices = 0;
  for (const r of realizedRows) {
    if (r.revenueHt != null) sumRev += r.revenueHt;
    sumCost += r.fifoCostHt;
    if (r.marginHt != null && r.revenueHt != null) {
      sumMargin += r.marginHt;
      sumRevForMargin += r.revenueHt;
    } else {
      partialServices++;
    }
  }
  const aggMarginPct = sumRevForMargin > 0 ? (sumMargin / sumRevForMargin) * 100 : null;

  // Agrégats réalisés (par plat)
  let dSumRev = 0;
  let dSumFifo = 0;
  let dSumMargin = 0;
  let dRevForMargin = 0;
  for (const r of dishMarginRows) {
    if (r.revenueHt != null) dSumRev += r.revenueHt;
    dSumFifo += r.allocatedFifoCostHt;
    if (r.marginHt != null && r.revenueHt != null) {
      dSumMargin += r.marginHt;
      dRevForMargin += r.revenueHt;
    }
  }
  const dAggMarginPct = dRevForMargin > 0 ? (dSumMargin / dRevForMargin) * 100 : null;

  // Podiums
  const realizedLeaders = topFlop(
    dishMarginRows.map((r) => ({
      id: r.dishId,
      name: r.dishName,
      pct: r.marginPct,
      href: `/dishes/${r.dishId}`,
    }))
  );
  const cardLeaders = topFlop(
    sorted.map((r) => ({ id: r.dishId, name: r.dishName, pct: r.marginPct, href: `/dishes/${r.dishId}` }))
  );

  const cardWithPct = sorted.filter((r) => r.marginPct != null);
  const cardAvgPct =
    cardWithPct.length > 0
      ? cardWithPct.reduce((s, r) => s + (r.marginPct as number), 0) / cardWithPct.length
      : null;

  const heroTier = marginTier(aggMarginPct);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.margins.icon}
        accentTone={SECTION_ACCENT.margins.tone}
        breadcrumbs={[{ label: "Pilotage", href: "/pilotage" }, { label: "Marges" }]}
        title="Marges"
        subtitle="Sur 100 € encaissés, combien vous restent une fois la matière payée ? Suivez vos plats les plus rentables et repérez ceux à revoir."
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error.message}</p>
      ) : null}

      {/* Sélecteur de période */}
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <MarginsDateRangeLinks currentFrom={from} currentTo={to} />
        <MarginsCustomRangeForm from={from} to={to} />
      </div>

      {/* ═══ Réalisé sur la période ═══ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Ce que vous avez réellement gagné</h2>
          <p className="text-sm text-stone-500">
            CA encaissé et coût matière FIFO des sorties de stock, sur la période choisie.
          </p>
        </div>

        {realizedRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
            <p className="text-base font-semibold text-stone-800">Aucun service sur cette période</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
              Élargissez la période ci-dessus, ou consultez la marge théorique de votre carte plus bas.
            </p>
          </div>
        ) : (
          <>
            {/* Bloc héros : jauge + répartition + chiffres clés */}
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
                <MarginDonut pct={aggMarginPct} />
                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${heroTier.chip}`}>
                  {aggMarginPct != null ? `Marge ${heroTier.label.toLowerCase()}` : "Marge non calculable"}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatCard label="CA HT (période)" value={fmtEur(sumRev)} icon={Receipt} tone="bg-sky-50 text-sky-700" />
                  <StatCard
                    label="Coût matière FIFO"
                    value={fmtEur(sumCost)}
                    sub={partialServices > 0 ? `${partialServices} service(s) au coût partiel` : undefined}
                    icon={Coins}
                    tone="bg-amber-50 text-amber-700"
                  />
                  <StatCard
                    label="Marge HT"
                    value={sumRevForMargin > 0 ? fmtEur(sumMargin) : "—"}
                    icon={Wallet}
                    tone="bg-emerald-50 text-emerald-700"
                  />
                </div>

                {aggMarginPct != null ? (
                  <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Où part le chiffre d’affaires
                    </p>
                    <SplitBar revenue={sumRevForMargin} cost={sumRevForMargin - sumMargin} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Marge non chiffrable : complétez les prix TTC/TVA des plats et assurez-vous que les sorties de stock
                    ont un coût lot connu.
                  </div>
                )}
              </div>
            </div>

            {/* Podiums plats réalisés */}
            {realizedLeaders.top.length > 0 ? (
              <div className={`grid gap-3 ${realizedLeaders.flop.length > 0 ? "md:grid-cols-2" : ""}`}>
                <DishLeaderboard variant="top" items={realizedLeaders.top} />
                {realizedLeaders.flop.length > 0 ? (
                  <DishLeaderboard variant="flop" items={realizedLeaders.flop} />
                ) : null}
              </div>
            ) : null}

            {/* Détail par service */}
            <details className="group overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50">
                Détail par service ({realizedRows.length})
                <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="overflow-x-auto border-t border-stone-100">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                      <th className="px-3 py-2.5">Service</th>
                      <th className="px-3 py-2.5 text-right">CA HT</th>
                      <th className="px-3 py-2.5 text-right">Coût FIFO HT</th>
                      <th className="px-3 py-2.5 text-right">Marge HT</th>
                      <th className="px-3 py-2.5 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realizedRows.map((r) => (
                      <tr key={r.serviceId} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                        <td className="px-3 py-2.5 align-top">
                          <Link href={`/service/${r.serviceId}`} className={uiTableLink}>
                            {formatServiceDate(r.serviceDate)} — {formatServiceType(r.serviceType)}
                          </Link>
                          <p className="mt-1 text-xs text-stone-500">{r.revenueNote}</p>
                          {r.fifoHasUnknownCost && (
                            <p className="mt-1 text-xs text-amber-700">Coût FIFO partiel (sorties sans coût lot).</p>
                          )}
                          {!r.revenueComplete && (
                            <p className="mt-1 text-xs text-amber-700">Complétez les prix TTC (et TVA).</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                          {fmtEur(r.revenueHt)}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                          {fmtEur(r.fifoCostHt)}
                          {r.fifoHasUnknownCost ? " *" : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                          {fmtEur(r.marginHt)}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <RateCell pct={r.marginPct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-stone-200 bg-stone-50/80 font-semibold">
                      <td className="px-3 py-2.5 text-stone-800">Total (période)</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-stone-800">{fmtEur(sumRev)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-stone-800">{fmtEur(sumCost)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-stone-800">
                        {sumRevForMargin > 0 ? fmtEur(sumMargin) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <RateChip pct={aggMarginPct} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-400">
                * Coût FIFO minimal connu ; la marge n’est pas calculée tant qu’une fraction du coût est inconnue. Le
                taux global ne porte que sur les services entièrement valorisés.
              </p>
            </details>

            {/* Détail par plat */}
            {dishMarginRows.length > 0 ? (
              <details className="group overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50">
                  Détail par plat ({dishMarginRows.length})
                  <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="overflow-x-auto border-t border-stone-100">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        <th className="px-3 py-2.5">Plat</th>
                        <th className="px-3 py-2.5 text-right">CA HT</th>
                        <th className="px-3 py-2.5 text-right">Coût FIFO alloué</th>
                        <th className="px-3 py-2.5 text-right">Marge HT</th>
                        <th className="px-3 py-2.5 text-right">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dishMarginRows.map((r) => (
                        <tr key={r.dishId} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                          <td className="px-3 py-2.5 align-top">
                            <Link href={`/dishes/${r.dishId}`} className={uiTableLink}>
                              {r.dishName}
                            </Link>
                            {r.note && <p className="mt-1 text-xs text-amber-700">{r.note}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                            {fmtEur(r.revenueHt)}
                          </td>
                          <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                            {fmtEur(r.allocatedFifoCostHt)}
                          </td>
                          <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                            {fmtEur(r.marginHt)}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <RateCell pct={r.marginPct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-stone-200 bg-stone-50/80 font-semibold">
                        <td className="px-3 py-2.5 text-stone-800">Total (plats)</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-stone-800">{fmtEur(dSumRev)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-stone-800">{fmtEur(dSumFifo)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-stone-800">
                          {dRevForMargin > 0 ? fmtEur(dSumMargin) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <RateChip pct={dAggMarginPct} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>

      {/* ═══ Théorique à la carte ═══ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Votre carte en théorie</h2>
          <p className="text-sm text-stone-500">
            Marge de chaque plat d’après sa recette et son prix carte — indépendant des services, idéal pour ajuster la
            carte.
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
            <p className="text-base font-semibold text-stone-800">Aucun plat pour ce restaurant</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
              Créez vos fiches plats avec recette et prix de vente pour voir apparaître leurs marges ici.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Plats chiffrés"
                value={`${cardWithPct.length}/${sorted.length}`}
                icon={UtensilsCrossed}
                tone="bg-violet-50 text-violet-700"
              />
              <div className="flex items-start gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${marginTier(cardAvgPct).chip}`}
                >
                  %
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-500">Marge carte moyenne</p>
                  <p className={`mt-0.5 text-2xl font-semibold tabular-nums tracking-tight ${marginTier(cardAvgPct).text}`}>
                    {fmtPct(cardAvgPct)}
                  </p>
                </div>
              </div>
              <StatCard
                label="Meilleure marge"
                value={fmtPct(cardLeaders.top[0]?.pct ?? null)}
                sub={cardLeaders.top[0]?.name}
                icon={Wallet}
                tone="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                label="Plus faible"
                value={fmtPct(cardLeaders.flop[0]?.pct ?? null)}
                sub={cardLeaders.flop[0]?.name}
                icon={Coins}
                tone="bg-rose-50 text-rose-700"
              />
            </div>

            {cardLeaders.top.length > 0 ? (
              <div className={`grid gap-3 ${cardLeaders.flop.length > 0 ? "md:grid-cols-2" : ""}`}>
                <DishLeaderboard variant="top" items={cardLeaders.top} />
                {cardLeaders.flop.length > 0 ? (
                  <DishLeaderboard variant="flop" items={cardLeaders.flop} />
                ) : null}
              </div>
            ) : null}

            <details className="group overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50">
                Toute la carte ({sorted.length})
                <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <MarginsCardTable rows={sorted} />
            </details>
          </>
        )}
      </section>

      {/* Méthodo repliée */}
      <details className="group rounded-2xl border border-stone-200/60 bg-stone-50/70">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-stone-600 hover:text-stone-800">
          <Info className="h-4 w-4 text-stone-400" aria-hidden />
          Comment ces marges sont-elles calculées ?
          <ChevronDown className="ml-auto h-4 w-4 text-stone-400 transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-2 px-4 pb-4 text-xs leading-relaxed text-stone-600">
          <p>
            <strong className="font-semibold text-stone-700">Carte (théorique)</strong> : coût matière (recette × coûts
            composants), prix TTC carte et TVA par plat ; le HT est déduit pour la marge.
          </p>
          <p>
            <strong className="font-semibold text-stone-700">Réalisé par service</strong> : CA selon les montants ticket
            (sinon quantité vendue × prix carte) ; coût matière = valorisation <strong>FIFO</strong> des sorties de stock
            liées au service.
          </p>
          <p>
            <strong className="font-semibold text-stone-700">Réalisé par plat</strong> : sur la même période, le FIFO de
            chaque service est ventilé sur les plats vendus (au prorata du coût théorique portion, sinon du CA ou de la
            quantité). La somme rejoint le total FIFO des services (à l’arrondi près).
          </p>
        </div>
      </details>
    </PageContainer>
  );
}
