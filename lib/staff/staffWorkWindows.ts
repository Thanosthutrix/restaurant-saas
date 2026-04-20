import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { minutesFromMidnight, parseOpeningHoursJson, type TimeBand } from "@/lib/staff/planningHoursTypes";
import type { StaffMember } from "@/lib/staff/types";

/** Intersection de deux listes de plages (même jour calendaire). */
export function intersectTimeBands(a: TimeBand[], b: TimeBand[]): TimeBand[] {
  const out: TimeBand[] = [];
  for (const ba of a) {
    for (const bb of b) {
      const ma = minutesFromMidnight(ba.start);
      const mb = minutesFromMidnight(ba.end);
      const ra = minutesFromMidnight(bb.start);
      const rb = minutesFromMidnight(bb.end);
      if (ma == null || mb == null || ra == null || rb == null) continue;
      const s = Math.max(ma, ra);
      const e = Math.min(mb, rb);
      if (e > s) out.push({ start: hhmmFromMinutes(s), end: hhmmFromMinutes(e) });
    }
  }
  return out;
}

function hhmmFromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function mergeTimeBands(bands: TimeBand[]): TimeBand[] {
  const withMin = bands
    .map((b) => {
      const a = minutesFromMidnight(b.start);
      const e = minutesFromMidnight(b.end);
      return a != null && e != null && e > a ? { a, e } : null;
    })
    .filter((x): x is { a: number; e: number } => x != null)
    .sort((x, y) => x.a - y.a);
  const out: TimeBand[] = [];
  for (const x of withMin) {
    if (out.length === 0) {
      out.push({ start: hhmmFromMinutes(x.a), end: hhmmFromMinutes(x.e) });
      continue;
    }
    const last = out[out.length - 1];
    const la = minutesFromMidnight(last.start)!;
    const le = minutesFromMidnight(last.end)!;
    if (x.a <= le) {
      last.end = hhmmFromMinutes(Math.max(le, x.e));
    } else {
      out.push({ start: hhmmFromMinutes(x.a), end: hhmmFromMinutes(x.e) });
    }
  }
  return out;
}

/**
 * Disponibilité « service client » : intersection avec l’ouverture du jour.
 * Jour sans plages dans le profil = même défaut que sans disponibilité explicite : toute l’ouverture établissement.
 * (Sinon un profil « partiel » laissant des jours vides excluait tout le monde et la simulation auto ne plaçait personne.)
 */
export function effectiveClientServiceBands(member: StaffMember, wd: WeekResolvedDay): TimeBand[] {
  const map = parseOpeningHoursJson(member.availability_json ?? {});
  const raw = map[wd.dayKey];

  if (!raw || raw.length === 0) {
    return wd.openingBands.map((b) => ({ ...b }));
  }
  return intersectTimeBands(raw, wd.openingBands);
}

/**
 * Plages prépa / hors client : horaires absolus ce jour (pas coupés par l’ouverture).
 */
export function effectivePrepBands(member: StaffMember, wd: WeekResolvedDay): TimeBand[] {
  const map = parseOpeningHoursJson(member.planning_prep_bands_json ?? {});
  const raw = map[wd.dayKey];
  if (!raw || raw.length === 0) return [];
  return raw.map((b) => ({ start: b.start, end: b.end }));
}

/** Fenêtres où le collaborateur peut être planifié (service + prépa perso + prépa établissement). */
export function mergedStaffWorkBands(member: StaffMember, wd: WeekResolvedDay): TimeBand[] {
  const a = effectiveClientServiceBands(member, wd);
  const b = effectivePrepBands(member, wd);
  const c = wd.staffExtraBands?.length ? wd.staffExtraBands.map((x) => ({ start: x.start, end: x.end })) : [];
  return mergeTimeBands([...a, ...b, ...c]);
}

/**
 * Le créneau [start,end) (même jour civil local) est entièrement contenu dans la réunion des plages ?
 */
export function shiftContainedInTimeBands(start: Date, end: Date, bands: TimeBand[]): boolean {
  if (start >= end) return true;
  if (bands.length === 0) return false;
  const merged = mergeTimeBands(bands);
  const day0 = new Date(start);
  day0.setHours(0, 0, 0, 0);
  const ss = (start.getTime() - day0.getTime()) / 60000;
  const se = (end.getTime() - day0.getTime()) / 60000;
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
