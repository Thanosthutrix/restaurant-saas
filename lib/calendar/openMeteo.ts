/**
 * Météo journalière via Open-Meteo (sans clé API).
 * Passé : archive-api ; futur / proche : forecast.
 */

type DailyPayload = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  precipitation_sum: number[];
};

function parseDaily(data: { daily?: DailyPayload }): Map<string, { wmo: number; tMax: number; precip: number }> {
  const map = new Map<string, { wmo: number; tMax: number; precip: number }>();
  const d = data.daily;
  if (!d?.time?.length) return map;
  for (let i = 0; i < d.time.length; i++) {
    const day = d.time[i];
    map.set(day, {
      wmo: Number(d.weather_code[i]) || 0,
      tMax: Number(d.temperature_2m_max[i]) || 0,
      precip: Number(d.precipitation_sum[i]) || 0,
    });
  }
  return map;
}

function todayIsoInParis(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "RestaurantSaaS/1.0 (calendar insights)" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/** Libellé court WMO (daily weathercode Open-Meteo). */
export function wmoDailySummaryFr(code: number): string {
  if (code === 0) return "Ciel clair";
  if (code <= 3) return "Nuageux";
  if (code <= 48) return "Brouillard";
  if (code <= 57) return "Bruine / verglas";
  if (code <= 67) return "Pluie";
  if (code <= 77) return "Neige";
  if (code <= 82) return "Averses";
  if (code <= 86) return "Averses de neige";
  if (code <= 99) return "Orages";
  return "Variable";
}

export async function fetchDailyWeatherSeries(
  lat: number,
  lng: number,
  from: string,
  to: string
): Promise<Map<string, { wmo: number; tMax: number; precip: number }>> {
  const out = new Map<string, { wmo: number; tMax: number; precip: number }>();
  if (from > to) return out;

  /** Aligné sur le fuseau du paramètre API (évite des trous autour de minuit UTC). */
  const today = todayIsoInParis();
  const pastEnd = to < today ? to : today;
  const futureStart = from > today ? from : today;

  if (from <= pastEnd) {
    const endArchive = pastEnd < to ? pastEnd : to;
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
      `&start_date=${from}&end_date=${endArchive}` +
      `&daily=weather_code,temperature_2m_max,precipitation_sum&timezone=Europe%2FParis`;
    const json = await fetchJson(url);
    if (json) {
      for (const [k, v] of parseDaily(json as { daily?: DailyPayload })) {
        out.set(k, v);
      }
    }
  }

  if (to >= futureStart) {
    const startFc = from > futureStart ? from : futureStart;
    /**
     * Open-Meteo refuse souvent une paire start_date/end_date hors fenêtre glissante (réponse error:true,
     * sans daily) : on obtient alors uniquement l’archive. Les prévisions passent par forecast_days (max 16).
     */
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&forecast_days=16` +
      `&daily=weather_code,temperature_2m_max,precipitation_sum&timezone=Europe%2FParis`;
    const json = await fetchJson(url);
    const body = json as { error?: boolean; daily?: DailyPayload };
    if (json && !body.error) {
      for (const [k, v] of parseDaily(body)) {
        if (k >= startFc && k <= to) {
          out.set(k, v);
        }
      }
    }
  }

  return out;
}

export type DailyWeatherPoint = {
  date: string;
  wmo: number;
  tMax: number;
  precip: number;
  summaryFr: string;
};

/** Prévisions journalières sur les N prochains jours (fuseau Europe/Paris). */
export async function fetchSevenDayForecast(lat: number, lng: number): Promise<DailyWeatherPoint[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&forecast_days=7` +
    `&daily=weather_code,temperature_2m_max,precipitation_sum&timezone=Europe%2FParis`;
  const json = await fetchJson(url);
  const body = json as { error?: boolean; daily?: DailyPayload };
  if (!json || body.error || !body.daily?.time?.length) return null;
  const d = body.daily;
  const out: DailyWeatherPoint[] = [];
  for (let i = 0; i < d.time.length; i++) {
    const wmo = Number(d.weather_code[i]) || 0;
    out.push({
      date: d.time[i],
      wmo,
      tMax: Number(d.temperature_2m_max[i]) || 0,
      precip: Number(d.precipitation_sum[i]) || 0,
      summaryFr: wmoDailySummaryFr(wmo),
    });
  }
  return out;
}
