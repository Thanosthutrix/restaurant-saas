"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, CloudRain, CloudSun, Loader2, Sun } from "lucide-react";
import type { DailyWeatherPoint } from "@/lib/calendar/openMeteo";

type ApiOk = { days: DailyWeatherPoint[]; restaurantId: string };
type ApiErr = { error: string; restaurantId?: string };

type WeatherHint =
  | { kind: "no_location"; restaurantId: string }
  | { kind: "forecast_unavailable"; restaurantId: string };

function iconForWmo(wmo: number) {
  if (wmo === 0) return Sun;
  if (wmo <= 3) return CloudSun;
  if (wmo <= 48) return Cloud;
  if (wmo <= 67) return CloudRain;
  if (wmo <= 77) return CloudRain;
  if (wmo <= 86) return CloudRain;
  return CloudSun;
}

/** Libellés stables SSR/client — évite toLocaleDateString (ICU Node ≠ navigateur → hydration mismatch). */
const WEEKDAYS_FR_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."] as const;
const MONTHS_FR_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

function formatDayLabel(iso: string, index: number) {
  if (index === 0) return "Aujourd’hui";
  if (index === 1) return "Demain";
  const parts = iso.split("-").map((x) => Number(x));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const w = dt.getUTCDay();
  return `${WEEKDAYS_FR_SHORT[w]} ${d} ${MONTHS_FR_SHORT[m - 1]}`;
}

function hintToErr(h: WeatherHint): ApiErr {
  if (h.kind === "no_location") return { error: "no_location", restaurantId: h.restaurantId };
  return { error: "forecast_unavailable", restaurantId: h.restaurantId };
}

export function HeaderWeatherWidget({
  shellHeaderReady,
  initialWeather,
  initialHint,
}: {
  /** true = données météo (ou absence) calculées dans le layout — ne pas refetch côté client. */
  shellHeaderReady?: boolean;
  initialWeather?: { days: DailyWeatherPoint[]; restaurantId: string } | null;
  initialHint?: WeatherHint | null;
}) {
  const fromLayout = shellHeaderReady === true;
  const pathname = usePathname();
  const [data, setData] = useState<ApiOk | null>(() =>
    initialWeather && initialWeather.days?.length ? initialWeather : null
  );
  const [err, setErr] = useState<ApiErr | null>(() => (initialHint ? hintToErr(initialHint) : null));
  const [loading, setLoading] = useState(() => !fromLayout);

  useEffect(() => {
    if (fromLayout) {
      if (initialWeather && initialWeather.days?.length) {
        setData(initialWeather);
        setErr(null);
      } else if (initialHint) {
        setData(null);
        setErr(hintToErr(initialHint));
      } else {
        setData(null);
        setErr(null);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/weather/header", { signal: ac.signal });
        const json = (await res.json()) as ApiOk & ApiErr;
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 401 || res.status === 404) {
            setData(null);
            setErr(null);
            setLoading(false);
            return;
          }
          setErr({
            error: (json as ApiErr).error ?? "error",
            restaurantId: (json as ApiErr).restaurantId,
          });
          setData(null);
        } else if ("days" in json && json.days?.length) {
          setData({ days: json.days, restaurantId: json.restaurantId });
          setErr(null);
        } else {
          setErr({ error: json.error ?? "unknown", restaurantId: json.restaurantId });
          setData(null);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (!cancelled) setErr({ error: "network" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [fromLayout, initialWeather, initialHint, pathname]);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/90 px-2 py-1.5 text-slate-400 sm:px-3"
        aria-hidden
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="hidden text-xs font-medium sm:inline">Météo…</span>
      </div>
    );
  }

  if (err?.error === "no_location" && err.restaurantId) {
    return (
      <Link
        href={`/restaurants/${err.restaurantId}/edit`}
        className="inline-flex max-w-[200px] items-center truncate rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 sm:max-w-none"
        title="Renseignez une adresse pour afficher la météo"
      >
        Météo · configurer l’adresse
      </Link>
    );
  }

  if (
    err?.error === "forecast_unavailable" ||
    err?.error === "network" ||
    err?.error === "unknown" ||
    err?.error === "error"
  ) {
    return (
      <span
        className="inline-flex max-w-[200px] items-center truncate rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-[11px] font-medium text-slate-500 sm:max-w-none"
        title={
          err?.error === "network"
            ? "Vérifiez votre connexion"
            : "Réessayez plus tard ou vérifiez l’adresse du restaurant"
        }
      >
        Météo indisponible
      </span>
    );
  }

  if (err || !data?.days.length) {
    return null;
  }

  const today = data.days[0]!;
  const Icon = iconForWmo(today.wmo);

  return (
    <div className="group relative">
      <div
        tabIndex={0}
        className="flex cursor-default items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-2 py-1.5 text-sm shadow-sm outline-none ring-indigo-500/0 transition hover:border-indigo-200 hover:bg-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-3"
        aria-haspopup="true"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 text-left max-sm:sr-only">
          <span className="block text-xs font-semibold leading-tight text-slate-900">
            {today.tMax.toFixed(0)} °C max
          </span>
          <span className="block max-w-[9rem] truncate text-[11px] leading-tight text-slate-500">
            {today.summaryFr}
          </span>
        </span>
      </div>

      <div
        className="pointer-events-none invisible absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-2rem,20rem)] origin-top scale-95 rounded-2xl border border-slate-100 bg-white p-2 opacity-0 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100/80 transition-all duration-150 ease-out group-hover:pointer-events-auto group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100"
        role="menu"
        aria-label="Prévisions sur 7 jours"
      >
        <p className="border-b border-slate-100 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          7 prochains jours
        </p>
        <ul className="max-h-[min(70vh,22rem)] overflow-y-auto py-1">
          {data.days.map((day, i) => {
            const RowIcon = iconForWmo(day.wmo);
            return (
              <li
                key={day.date}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm transition hover:bg-slate-50"
                role="menuitem"
              >
                <RowIcon className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-900">{formatDayLabel(day.date, i)}</span>
                  <span className="block truncate text-xs text-slate-500">{day.summaryFr}</span>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-slate-700">
                  {day.tMax.toFixed(0)}°
                </span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-slate-100 px-2 pt-2">
          <Link
            href="/insights/calendar"
            className="block rounded-lg px-2 py-1.5 text-center text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            Calendrier complet →
          </Link>
        </div>
      </div>
    </div>
  );
}
