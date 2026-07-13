import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildPocketReport, listFixedCharges, type PocketMode } from "@/lib/pocket/pocketReport";
import { getExpenseCategoryLabel } from "@/lib/pocket/expenseCategories";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiCard } from "@/components/ui/premium";
import { BilanSettingsClient } from "./BilanSettingsClient";
import { InvoiceCategorySelect } from "./InvoiceCategorySelect";

export const metadata = { title: "Ma poche — bilan en temps réel" };

const PARIS_TZ = "Europe/Paris";
const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const eurCents = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function parisToday(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: PARIS_TZ });
}
function shiftDays(ymd: string, delta: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function isYmd(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type SearchParams = { p?: string; from?: string; to?: string; m?: string };

function resolvePeriod(sp: SearchParams): { from: string; to: string; preset: string } {
  const today = parisToday();
  if (isYmd(sp.from) && isYmd(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { from, to, preset: "custom" };
  }
  switch (sp.p) {
    case "today":
      return { from: today, to: today, preset: "today" };
    case "7d":
      return { from: shiftDays(today, -6), to: today, preset: "7d" };
    case "lastmonth": {
      const first = today.slice(0, 8) + "01";
      const lastOfPrev = shiftDays(first, -1);
      return { from: lastOfPrev.slice(0, 8) + "01", to: lastOfPrev, preset: "lastmonth" };
    }
    case "year":
      return { from: today.slice(0, 4) + "-01-01", to: today, preset: "year" };
    default:
      return { from: today.slice(0, 8) + "01", to: today, preset: "month" };
  }
}

function periodQuery(sp: SearchParams, preset: string): string {
  if (preset === "custom" && isYmd(sp.from) && isYmd(sp.to)) {
    return `from=${sp.from}&to=${sp.to}`;
  }
  return `p=${preset === "custom" ? "month" : preset}`;
}

const PRESETS = [
  { key: "today", label: "Aujourd'hui" },
  { key: "7d", label: "7 derniers jours" },
  { key: "month", label: "Mois en cours" },
  { key: "lastmonth", label: "Mois dernier" },
  { key: "year", label: "Année en cours" },
] as const;

function Bar({ amount, base, cls }: { amount: number; base: number; cls: string }) {
  const pct = base > 0 ? Math.min(100, Math.max(2, Math.round((Math.abs(amount) / base) * 100))) : 2;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatShortDate(ymd: string, annual: boolean) {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("fr-FR", annual
    ? { month: "short" }
    : { day: "numeric", month: "short" });
}

export default async function BilanPochePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  // Finances de l'établissement : réservé au propriétaire.
  if (restaurant.owner_id !== user.id) {
    return (
      <PageContainer width="narrow">
        <div className={uiCard}>
          <p className="text-sm text-stone-700">
            Le bilan « Ma poche » est réservé au propriétaire de l&apos;établissement.
          </p>
        </div>
      </PageContainer>
    );
  }

  const sp = await searchParams;
  const { from, to, preset } = resolvePeriod(sp);
  const mode: PocketMode = sp.m === "perf" ? "perf" : "cash";
  const pq = periodQuery(sp, preset);

  const [report, charges, staffRes, restaurantRes] = await Promise.all([
    buildPocketReport(restaurant.id, from, to, mode),
    listFixedCharges(restaurant.id),
    supabaseServer
      .from("staff_members")
      .select("id, display_name, hourly_gross_rate, withholding_tax_rate_pct, active")
      .eq("restaurant_id", restaurant.id)
      .eq("active", true)
      .order("display_name"),
    supabaseServer
      .from("restaurants")
      .select("payroll_atmp_rate")
      .eq("id", restaurant.id)
      .maybeSingle(),
  ]);

  const staff = (((staffRes.data as Record<string, unknown>[]) ?? []) as Record<string, unknown>[]).map(
    (s) => ({
      id: String(s.id),
      displayName: String(s.display_name ?? "Employé"),
      hourlyGrossRate: s.hourly_gross_rate != null ? Number(s.hourly_gross_rate) : null,
      withholdingTaxRatePct:
        s.withholding_tax_rate_pct != null ? Number(s.withholding_tax_rate_pct) : null,
    })
  );

  const payrollAtmpRatePct =
    (restaurantRes.data as { payroll_atmp_rate?: unknown } | null)?.payroll_atmp_rate != null
      ? Number((restaurantRes.data as { payroll_atmp_rate: unknown }).payroll_atmp_rate)
      : 2.3;

  const pocketPositive = report.pocket >= 0;
  const base = Math.max(report.revenueHt, 1);
  const annualView = report.days > 62;
  const timeline = annualView
    ? Object.values(
        report.breakEvenTimeline.reduce<Record<string, (typeof report.breakEvenTimeline)[number]>>((out, point) => {
          out[point.date.slice(0, 7)] = point;
          return out;
        }, {})
      )
    : report.breakEvenTimeline;
  const minTimeline = Math.min(0, ...timeline.map((p) => p.cumulativePocket));
  const maxTimeline = Math.max(0, ...timeline.map((p) => p.cumulativePocket));
  const timelineSpan = Math.max(1, maxTimeline - minTimeline);
  // Sans CA ni charges, toutes les barres valent 0 : le graphique serait invisible.
  const timelineHasData = report.revenueHt > 0 || report.fixedCommitmentsAtStart > 0;

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Wallet}
        accentTone="bg-copper-50 text-copper-700"
        breadcrumbs={[{ label: "Pilotage", href: "/pilotage" }, { label: "Ma poche" }]}
        title="Ma poche"
        subtitle={`${restaurant.name} — ce qu'il vous reste, en temps réel`}
      />

      {/* Période + mode */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/pilotage/bilan?p=${p.key}&m=${mode}`}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
              preset === p.key
                ? "border-copper-300 bg-copper-50 text-copper-800"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <form method="GET" action="/pilotage/bilan" className="flex items-center gap-1.5">
          <input type="hidden" name="m" value={mode} />
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-700"
          />
          <span className="text-xs text-stone-400">→</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-700"
          />
          <button
            type="submit"
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-stone-300"
          >
            OK
          </button>
        </form>

        <span className="ml-auto inline-flex overflow-hidden rounded-xl border border-stone-200">
          <Link
            href={`/pilotage/bilan?${pq}&m=cash`}
            title="Ce qui est réellement sorti du compte : factures d'achats de la période."
            className={`px-3 py-1.5 text-sm font-medium transition ${
              mode === "cash" ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            Trésorerie
          </Link>
          <Link
            href={`/pilotage/bilan?${pq}&m=perf`}
            title="Coût matière économique : consommation FIFO réelle des ventes de la période."
            className={`px-3 py-1.5 text-sm font-medium transition ${
              mode === "perf" ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            Performance
          </Link>
        </span>
      </div>

      {/* Le chiffre */}
      <div
        className={`rounded-2xl border p-6 shadow-sm ${
          pocketPositive ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/70"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Dans votre poche · {report.days} jour{report.days > 1 ? "s" : ""} · {report.servicesCount} service
          {report.servicesCount > 1 ? "s" : ""} ·{" "}
          {mode === "cash" ? "vision trésorerie" : "vision performance"}
        </p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            pocketPositive ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {eur(report.pocket)}
        </p>
        <p className="mt-1 text-sm text-stone-600">
          {report.pocketTaxPct != null
            ? `Après estimation impôts & cotisations (${report.pocketTaxPct} %).`
            : "Avant impôts et cotisations du dirigeant."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.foodCostPct != null ? (
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-stone-700">
              Coût matière {report.foodCostPct} %
            </span>
          ) : null}
          {report.laborPct != null ? (
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-stone-700">
              Personnel {report.laborPct} %
            </span>
          ) : null}
          {report.invoicesWithoutAmount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
              {report.invoicesWithoutAmount} facture(s) sans montant ignorée(s)
            </span>
          ) : null}
          {report.importedRevenueHt > 0 ? (
            <span
              className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900"
              title={`Mois complétés par vos relevés importés : ${report.importedMonths.join(", ")}`}
            >
              dont {eur(report.importedRevenueHt)} de CA issus de vos relevés ({report.importedMonths.length} mois)
            </span>
          ) : null}
          <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-stone-700">
            {report.openDaysInPeriod} jour{report.openDaysInPeriod > 1 ? "s" : ""} d&apos;ouverture
          </span>
        </div>
      </div>

      {/* Point d'équilibre */}
      {report.breakEven ? (
        <div className={uiCard}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-stone-900">Point d&apos;équilibre</h2>
            <p className="text-sm text-stone-600">
              Seuil :{" "}
              <span className="font-semibold tabular-nums text-stone-900">
                {eur(report.breakEven.thresholdHt)}
              </span>{" "}
              de CA HT sur la période
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full ${
                report.breakEven.reached ? "bg-emerald-500" : "bg-amber-400"
              }`}
              style={{
                width: `${Math.min(100, Math.max(2, Math.round((report.revenueHt / Math.max(report.breakEven.thresholdHt, 1)) * 100)))}%`,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-stone-700">
            {report.breakEven.reached ? (
              <>
                <span className="font-semibold text-emerald-700">Équilibre atteint</span>
                {report.breakEven.reachedDate ? (
                  <>
                    {" "}
                    le{" "}
                    <span className="font-semibold">
                      {new Date(report.breakEven.reachedDate + "T12:00:00Z").toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </>
                ) : null}
                {" "}— au-delà de ce seuil, le CA couvre aussi les commissions et taxes liées aux ventes
                (~{report.breakEven.variableRatePct} % de coûts variables).
              </>
            ) : (
              <>
                <span className="font-semibold text-amber-700">
                  Il manque {eur(report.breakEven.missingHt)} de CA
                </span>{" "}
                pour couvrir les {eur(report.breakEven.fixedTotal)} de charges de la période (base
                matières ~{report.breakEven.variableRatePct} % du CA).
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Progression cumulée : engagements fixes posés dès le début de la période. */}
      {timeline.length > 0 && timelineHasData ? (
        <div className={uiCard}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                {annualView ? "Progression vers l’équilibre annuel" : "Progression vers l’équilibre ce mois-ci"}
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Charges fixes et salaires (heures planifiées) sont déduits intégralement au début de
                chaque mois ; matières et commissions sont retirées au fil du CA.
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-stone-800">
              {eur(report.pocket)} à la fin de la période
            </p>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="relative flex h-44 min-w-[540px] items-stretch gap-px border-b border-stone-300">
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-stone-300"
                style={{ top: `${(maxTimeline / timelineSpan) * 100}%` }}
              />
              {timeline.map((point) => {
                const positive = point.cumulativePocket >= 0;
                const zeroY = (maxTimeline / timelineSpan) * 100;
                const valueY = ((maxTimeline - point.cumulativePocket) / timelineSpan) * 100;
                const top = Math.min(zeroY, valueY);
                const height = Math.max(1.5, Math.abs(zeroY - valueY));
                const reached = report.breakEven?.reachedDate === point.date;
                return (
                  <div key={point.date} className="group relative flex min-w-[3px] flex-1 items-end" title={`${formatShortDate(point.date, annualView)} · ${eurCents(point.cumulativePocket)}`}>
                    <div
                      className={`absolute rounded-sm ${positive ? "bg-emerald-500" : "bg-rose-400"} ${reached ? "ring-2 ring-copper-500" : ""}`}
                      style={{ top: `${top}%`, height: `${height}%`, left: "12%", right: "12%" }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-stone-400">
              <span>{formatShortDate(timeline[0].date, annualView)}</span>
              <span>ligne pointillée : équilibre</span>
              <span>{formatShortDate(timeline.at(-1)!.date, annualView)}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-rose-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-rose-700">Départ prudent</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-rose-800">− {eur(report.fixedCommitmentsAtStart)}</p>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Coûts liés au CA</p>
              <p className="mt-0.5 text-sm font-semibold text-stone-800">~{report.revenueLinkedCostPct} %</p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${report.breakEven?.reached ? "bg-emerald-50" : "bg-amber-50"}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${report.breakEven?.reached ? "text-emerald-700" : "text-amber-700"}`}>Moment clé</p>
              <p className={`mt-0.5 text-sm font-semibold ${report.breakEven?.reached ? "text-emerald-800" : "text-amber-800"}`}>
                {report.breakEven?.reachedDate
                  ? `Équilibre le ${formatShortDate(report.breakEven.reachedDate, annualView)}`
                  : "Équilibre non atteint"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Le CA et les dépenses sont affichés hors taxes : la TVA n&apos;est pas assimilée à un revenu.
            Les commissions Uber Eats/Deliveroo, CB/TPE et titres-restaurant sont incluses dans les coûts variables ;
            l&apos;estimation d&apos;impôts du dirigeant est appliquée uniquement après résultat positif.
          </p>
        </div>
      ) : (
        <div className={uiCard}>
          <h2 className="text-sm font-semibold text-stone-900">Progression vers l&apos;équilibre</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Le graphique jour par jour apparaîtra dès que la période contiendra des données :
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
            <li>des encaissements en caisse (le CA se remplit automatiquement à chaque service) ;</li>
            <li>vos charges récurrentes (loyer, emprunt…) et les salaires horaires, à saisir dans les
              réglages ci-dessous ;</li>
            <li>vos factures fournisseurs déposées dans Achats → Factures (classées par poste automatiquement).</li>
          </ul>
        </div>
      )}

      {/* La cascade par postes */}
      <div className={uiCard}>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-stone-800">
                Chiffre d&apos;affaires HT
                {report.importedRevenueHt > 0 ? (
                  <span className="ml-2 text-xs font-normal text-sky-700">
                    dont {eurCents(report.importedRevenueHt)} de relevés importés
                  </span>
                ) : null}
                {report.revenueIncomplete ? (
                  <span className="ml-2 text-xs font-normal text-amber-700">
                    certains services non valorisés
                  </span>
                ) : null}
              </p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                {eurCents(report.revenueHt)}
              </p>
            </div>
            <Bar amount={report.revenueHt} base={base} cls="bg-emerald-500" />
          </div>

          {report.postes.map((poste) => {
            const invoiceRows = report.invoicesByCategory[poste.category] ?? [];
            const parts: string[] = [];
            if (poste.invoicesCount > 0) parts.push(`${poste.invoicesCount} facture${poste.invoicesCount > 1 ? "s" : ""}`);
            if (poste.fifo > 0) parts.push("consommation FIFO");
            if (poste.labor > 0) parts.push("salaires calculés");
            if (poste.manualPortion > 0) parts.push("charges saisies");
            const missingRates =
              poste.category === "rh" && report.staffMissingRate.length > 0
                ? `${report.staffMissingRate.length} employé(s) sans salaire`
                : poste.category === "matieres" && poste.fifo > 0 && report.foodCostHasUnknown
                  ? "certains lots sans coût connu"
                  : null;
            return (
              <div key={poste.category} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-stone-800">
                    {getExpenseCategoryLabel(poste.category)}
                    <span className="ml-2 text-xs font-normal text-stone-400">{parts.join(" + ")}</span>
                    {missingRates ? (
                      <span className="ml-2 text-xs font-normal text-amber-700">{missingRates}</span>
                    ) : null}
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-stone-600">
                    − {eurCents(poste.total)}
                  </p>
                </div>
                <Bar amount={poste.total} base={base} cls="bg-stone-300" />
                {poste.invoicesCount > 0 ? (
                  <details className="pt-0.5">
                    <summary className="cursor-pointer text-xs text-stone-500 hover:text-stone-700">
                      Voir les {poste.invoicesCount} facture{poste.invoicesCount > 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 space-y-1.5 rounded-xl bg-stone-50 p-3">
                      {invoiceRows.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between gap-2 text-xs">
                          <p className="min-w-0 truncate text-stone-700">
                            {inv.label}
                            <span className="ml-1.5 text-stone-400">{inv.invoiceDate ?? "sans date"}</span>
                            {inv.approxTtc ? <span className="ml-1.5 text-amber-700">(TTC)</span> : null}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums font-medium text-stone-800">
                              {eurCents(inv.amountHt)}
                            </span>
                            <InvoiceCategorySelect
                              restaurantId={restaurant.id}
                              invoiceId={inv.id}
                              current={inv.category}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}

          {report.pocketTaxPct != null && report.taxEstimate > 0 ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-stone-800">
                  Impôts & cotisations estimés ({report.pocketTaxPct} %)
                </p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-stone-600">
                  − {eurCents(report.taxEstimate)}
                </p>
              </div>
              <Bar amount={report.taxEstimate} base={base} cls="bg-stone-300" />
            </div>
          ) : null}

          <div className="space-y-1 border-t border-stone-200 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-stone-900">Reste dans la poche</p>
              <p
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  pocketPositive ? "text-copper-800" : "text-rose-700"
                }`}
              >
                {eurCents(report.pocket)}
              </p>
            </div>
            <Bar amount={report.pocket} base={base} cls={pocketPositive ? "copper-sheen" : "bg-rose-400"} />
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-stone-500">
          Dépenses = factures réelles de la période (classées par poste, corrigeables) + charges
          récurrentes saisies (loyer, emprunt…) + masse salariale calculée (heures planifiées × brut
          × charges patronales).{" "}
          Charges fixes et salaires : montants pleins de chaque mois entamé, déduits dès son début
          (pas de lissage journalier).{" "}
          {mode === "cash"
            ? "Vision trésorerie : les matières premières sont les factures d'achats de la période."
            : "Vision performance : les matières premières sont la consommation FIFO réelle des ventes."}{" "}
          Estimation indicative — à valider avec votre comptable.
        </p>
      </div>

      {/* Détail masse salariale */}
      {report.laborLines.length > 0 ? (
        <div className={uiCard}>
          <h2 className="text-sm font-semibold text-stone-900">Détail masse salariale</h2>
          <div className="mt-3 space-y-1.5">
            {report.laborLines.map((l) => (
              <div key={l.staffMemberId} className="flex items-baseline justify-between gap-3 text-sm">
                <p className="min-w-0 truncate text-stone-700">
                  {l.displayName}
                  <span className="ml-2 text-xs text-stone-400">{l.hours} h planifiées</span>
                </p>
                <p className="shrink-0 tabular-nums font-medium text-stone-800">
                  {l.loadedCost != null ? (
                    eurCents(l.loadedCost)
                  ) : (
                    <span className="text-amber-700">salaire à saisir ↓</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Réglages */}
      <BilanSettingsClient
        restaurantId={restaurant.id}
        staff={staff}
        charges={charges}
        payrollEmployerPct={report.payrollEmployerPct}
        pocketTaxPct={report.pocketTaxPct}
        payrollAtmpRatePct={payrollAtmpRatePct}
      />
    </PageContainer>
  );
}
