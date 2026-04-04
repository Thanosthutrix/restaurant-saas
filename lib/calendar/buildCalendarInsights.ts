import { getFrenchPublicHolidayName } from "@/lib/calendar/frPublicHolidays";
import { fetchDailyWeatherSeries, wmoDailySummaryFr } from "@/lib/calendar/openMeteo";
import type { SchoolZone } from "@/lib/calendar/schoolVacationsFr";
import { getSchoolVacationLabel } from "@/lib/calendar/schoolVacationsFr";
import { getDailySalesAggregatesByServiceDate, type DailySalesAggregate } from "@/lib/calendar/dailySalesAggregates";

export type CalendarDayRow = {
  date: string;
  sales: DailySalesAggregate | null;
  publicHoliday: string | null;
  schoolVacation: string | null;
  weather: {
    wmo: number;
    tMax: number;
    precip: number;
    summaryFr: string;
  } | null;
  hint: string;
};

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  const cur = new Date(from + "T12:00:00.000Z");
  const end = new Date(to + "T12:00:00.000Z");
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function rollingAvgRevenue(
  dates: string[],
  i: number,
  salesByDate: Map<string, DailySalesAggregate>,
  window: number
): number | null {
  let sum = 0;
  let n = 0;
  for (let j = Math.max(0, i - window); j < i; j++) {
    const d = dates[j];
    const s = salesByDate.get(d);
    if (s?.revenueComplete && s.revenueHt != null && s.revenueHt > 0) {
      sum += s.revenueHt;
      n += 1;
    }
  }
  if (n === 0) return null;
  return sum / n;
}

function buildHint(params: {
  publicHoliday: string | null;
  schoolVacation: string | null;
  weather: CalendarDayRow["weather"];
  revenueHt: number | null;
  revenueComplete: boolean;
  rollingAvg: number | null;
}): string {
  const parts: string[] = [];

  if (params.publicHoliday) {
    parts.push(`Jour férié (${params.publicHoliday}) : affluence souvent différente d’un jour ouvré.`);
  }
  if (params.schoolVacation) {
    parts.push(`${params.schoolVacation} : familles en déplacement, rythme scolaire modifié.`);
  }
  if (params.weather) {
    if (params.weather.precip >= 8) {
      parts.push("Pluie marquée : peut réduire les passages spontanés ou au contraire favoriser la livraison selon l’offre.");
    } else if (params.weather.wmo >= 80) {
      parts.push("Risque d’averses.");
    }
    if (params.weather.tMax >= 30) {
      parts.push("Très forte chaleur : adapter offre / service.");
    } else if (params.weather.tMax <= 5) {
      parts.push("Temps froid : comportement client souvent plus « réconfort ».");
    }
  }

  if (params.revenueComplete && params.revenueHt != null && params.rollingAvg != null && params.rollingAvg > 0) {
    const d = ((params.revenueHt - params.rollingAvg) / params.rollingAvg) * 100;
    if (d > 18) {
      parts.push(`CA environ ${Math.round(d)} % au-dessus de la moyenne des 7 jours précédents (jours avec CA connu).`);
    } else if (d < -18) {
      parts.push(`CA environ ${Math.round(-d)} % sous cette moyenne : croiser avec le contexte (férié, météo, vacances).`);
    }
  } else if (!params.revenueComplete && params.revenueHt == null) {
    parts.push("CA du jour non estimable : renseignez les prix sur les plats ou les montants ticket (line_total_ht).");
  }

  if (parts.length === 0) {
    return "Aucun signal automatique fort ; le contexte du jour reste neutre dans ce modèle.";
  }
  return parts.join(" ");
}

export async function buildCalendarInsights(params: {
  restaurantId: string;
  from: string;
  to: string;
  latitude: number | null;
  longitude: number | null;
  schoolZone: SchoolZone | null;
}): Promise<CalendarDayRow[]> {
  const { restaurantId, from, to, latitude, longitude, schoolZone } = params;
  const dates = enumerateDates(from, to);
  if (dates.length === 0) return [];

  const [salesByDate, weatherMap] = await Promise.all([
    getDailySalesAggregatesByServiceDate(restaurantId, from, to),
    latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? fetchDailyWeatherSeries(latitude, longitude, from, to)
      : Promise.resolve(new Map<string, { wmo: number; tMax: number; precip: number }>()),
  ]);

  const rows: CalendarDayRow[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const sales = salesByDate.get(date) ?? null;
    const publicHoliday = getFrenchPublicHolidayName(date);
    const schoolVacation = getSchoolVacationLabel(date, schoolZone);

    const w = weatherMap.get(date);
    const weather = w
      ? {
          wmo: w.wmo,
          tMax: w.tMax,
          precip: w.precip,
          summaryFr: wmoDailySummaryFr(w.wmo),
        }
      : null;

    const rollingAvg = rollingAvgRevenue(dates, i, salesByDate, 7);
    const revenueHt = sales?.revenueHt ?? null;
    const revenueComplete = sales?.revenueComplete ?? false;

    const hint = buildHint({
      publicHoliday,
      schoolVacation,
      weather,
      revenueHt,
      revenueComplete,
      rollingAvg,
    });

    rows.push({
      date,
      sales,
      publicHoliday,
      schoolVacation,
      weather,
      hint,
    });
  }

  return rows;
}

export function defaultCalendarRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 28);
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 14);
  return {
    from: from.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function parseCalendarDateParam(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}
