/**
 * Interprétation des horaires « muraux » planning (France) en **Europe/Paris**,
 * indépendamment du fuseau du serveur (ex. UTC sur Vercel).
 * Sans cela, les HH:mm du JSON type ChatGPT se décalent et la validation rejette la plupart des créneaux.
 */

import { minutesFromMidnight, type TimeBand } from "@/lib/staff/planningHoursTypes";
import { mergeTimeBands } from "@/lib/staff/staffWorkWindows";

const PARIS = "Europe/Paris";

function intlParts(utcMs: number): { y: number; mo: number; d: number; h: number; mi: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") o[p.type] = p.value;
  }
  return {
    y: Number(o.year),
    mo: Number(o.month),
    d: Number(o.day),
    h: Number(o.hour),
    mi: Number(o.minute),
  };
}

/** Date civile AAAA-MM-JJ à Paris pour un instant UTC. */
export function parisYmdFromInstant(d: Date): string {
  const z = intlParts(d.getTime());
  return `${z.y}-${String(z.mo).padStart(2, "0")}-${String(z.d).padStart(2, "0")}`;
}

/**
 * Trouve l’instant UTC correspondant à une date civile `ymd` et une heure « murale » HH:mm à Paris.
 * Balayage minute par minute sur une fenêtre large (DST, changements d’heure).
 */
export function parisWallClockToUtc(ymd: string, hhmm: string): Date | null {
  const head = ymd.trim().slice(0, 10);
  const [ys, mms, dds] = head.split("-");
  const y = Number(ys), mo = Number(mms), d = Number(dds);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m || !Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const H = Number(m[1]);
  const Mi = Number(m[2]);
  if (H > 23 || Mi > 59 || !Number.isFinite(H) || !Number.isFinite(Mi)) return null;

  const scan0 = Date.UTC(y, mo - 1, d, 0, 0, 0) - 10 * 3600000;
  const scan1 = Date.UTC(y, mo - 1, d, 0, 0, 0) + 30 * 3600000;
  for (let t = scan0; t <= scan1; t += 60000) {
    const z = intlParts(t);
    if (z.y === y && z.mo === mo && z.d === d && z.h === H && z.mi === Mi) return new Date(t);
  }
  return null;
}

/**
 * Même logique que `shiftContainedInTimeBands`, mais minutes « depuis minuit » = **calendrier Paris**
 * (aligné sur les plages HH:mm du restaurant).
 */
export function shiftContainedInParisWallBands(start: Date, end: Date, bands: TimeBand[]): boolean {
  if (start >= end) return true;
  if (bands.length === 0) return false;
  const merged = mergeTimeBands(bands);
  const sp = intlParts(start.getTime());
  const ep = intlParts(end.getTime());
  if (sp.y !== ep.y || sp.mo !== ep.mo || sp.d !== ep.d) return false;
  const ss = sp.h * 60 + sp.mi;
  const se = ep.h * 60 + ep.mi;
  const intervals: [number, number][] = [];
  for (const b of merged) {
    const a = minutesFromMidnight(b.start);
    const e = minutesFromMidnight(b.end);
    if (a == null || e == null || e <= a) continue;
    intervals.push([a, e]);
  }
  if (intervals.length === 0) return false;
  intervals.sort((x, y) => x[0] - y[0]);
  const mergedIv: [number, number][] = [];
  for (const iv of intervals) {
    const last = mergedIv[mergedIv.length - 1];
    if (!last || iv[0] > last[1]) mergedIv.push([iv[0], iv[1]]);
    else last[1] = Math.max(last[1], iv[1]);
  }
  return mergedIv.some(([a, b]) => ss >= a && se <= b);
}
