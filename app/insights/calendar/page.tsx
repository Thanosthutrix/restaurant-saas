import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import {
  buildCalendarInsights,
  defaultCalendarRange,
  parseCalendarDateParam,
} from "@/lib/calendar/buildCalendarInsights";
import { resolveRestaurantCoordsForWeather } from "@/lib/geo/resolveRestaurantCoordsForWeather";
import { CalendarRangeForm } from "./CalendarRangeForm";
import { uiBackLink, uiBtnSecondary, uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

function formatEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDayFr(iso: string) {
  return new Date(iso + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type SearchParams = { from?: string; to?: string };

export default async function CalendarInsightsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const defaults = defaultCalendarRange();
  let from = parseCalendarDateParam(sp.from, defaults.from);
  let to = parseCalendarDateParam(sp.to, defaults.to);
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }

  const coords = await resolveRestaurantCoordsForWeather(restaurant);
  const rows = await buildCalendarInsights({
    restaurantId: restaurant.id,
    from,
    to,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    schoolZone: restaurant.school_zone,
  });

  const displayRows = [...rows].reverse();
  const hasGeo = coords != null;
  const hasZone = restaurant.school_zone != null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className={uiBackLink}>
            ← Tableau de bord
          </Link>
          <h1 className={`mt-3 ${uiPageTitle}`}>Calendrier contextuel</h1>
          <p className={`mt-1 ${uiLead}`}>{restaurant.name}</p>
        </div>
        <Link
          href={`/restaurants/${restaurant.id}/edit`}
          className={`${uiBtnSecondary} inline-flex items-center justify-center`}
        >
          Adresse et zone scolaire
        </Link>
      </div>

      <div className={uiCard}>
          <p className="text-sm leading-relaxed text-slate-600">
            Croise vos journées de service (CA estimé, quantités vendues) avec les{" "}
            <strong className="font-medium text-slate-800">jours fériés</strong>, les{" "}
            <strong className="font-medium text-slate-800">vacances scolaires</strong>{" "}
            (zone A/B/C) et la{" "}
            <strong className="font-medium text-slate-800">météo</strong> (Open-Meteo). Les
            pistes d’analyse sont indicatives.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasGeo
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              Météo : {hasGeo ? "activée" : "à configurer"}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasZone
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              Vacances : {hasZone ? "zone renseignée" : "à configurer"}
            </span>
          </div>
          {!hasGeo && (
            <p className="mt-3 text-sm text-amber-800">
              Renseignez l&apos;adresse du restaurant (géocodage France) pour activer la météo sur ce calendrier.
            </p>
          )}
          {!hasZone && (
            <p className="mt-2 text-sm text-amber-800">
              Renseignez une adresse avec zone automatique, ou choisissez la zone A, B ou C dans les paramètres
              du restaurant pour afficher les vacances.
            </p>
          )}
        <CalendarRangeForm from={from} to={to} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:hidden">
            Faites défiler horizontalement pour voir toutes les colonnes.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Jour</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">CA HT (est.)</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Qté vendue</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Services</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Férié</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Vacances</th>
                  <th className="min-w-[7rem] whitespace-nowrap px-4 py-3 font-medium">Météo</th>
                  <th className="min-w-[14rem] px-4 py-3 font-medium">Pistes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((r) => (
                  <tr
                    key={r.date}
                    className="align-top transition-colors hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {formatDayFr(r.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-800">
                      {r.sales?.revenueHt != null
                        ? formatEur(r.sales.revenueHt)
                        : r.sales?.serviceCount
                          ? "—"
                          : "—"}
                      {r.sales && !r.sales.revenueComplete && r.sales.serviceCount > 0 && (
                        <span className="ml-1 text-xs text-amber-700" title="CA incomplet">
                          *
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                      {r.sales && r.sales.qtySold > 0 ? r.sales.qtySold : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                      {r.sales && r.sales.serviceCount > 0 ? r.sales.serviceCount : "—"}
                    </td>
                    <td className="max-w-[10rem] px-4 py-3 text-slate-700">
                      {r.publicHoliday ? (
                        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
                          {r.publicHoliday}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-[12rem] px-4 py-3 text-slate-700">
                      {r.schoolVacation ? (
                        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                          {r.schoolVacation}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.weather ? (
                        <div>
                          <span className="font-medium text-slate-800">
                            {r.weather.summaryFr}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {r.weather.tMax.toFixed(1)} °C max · pluie {r.weather.precip.toFixed(1)} mm
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">
                      {r.hint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        * CA incomplet : prix de vente ou montants ticket manquants sur certaines lignes. Vacances scolaires :
        données embarquées (à mettre à jour chaque année). Météo : Open-Meteo, fuseau Europe/Paris ; prévisions
        jusqu’à ~16 jours.
      </p>
    </div>
  );
}
