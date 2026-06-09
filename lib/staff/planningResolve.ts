import {
  type OpeningHoursMap,
  type PlanningDayKey,
  type TimeBand,
  PLANNING_DAY_KEYS,
  minutesFromMidnight,
  normalizeClockToHhMm,
} from "@/lib/staff/planningHoursTypes";
import { addDays, toISODateString } from "@/lib/staff/weekUtils";

export type PlanningDayOverrideRow = {
  day: string;
  is_closed: boolean;
  opening_bands_override: unknown;
  staff_target_override: number | null;
  label: string | null;
  /** Lignes issues du calendrier guidé (fériés / vacances). */
  calendar_source: "public_holiday" | "school_vacation" | null;
};

export type WeekResolvedDay = {
  ymd: string;
  dayKey: PlanningDayKey;
  date: Date;
  openingBands: TimeBand[];
  /** Plages établissement : travail possible sans service au public (prépa, livraisons…). */
  staffExtraBands: TimeBand[];
  staffTarget: number | null;
  exceptionLabel: string | null;
};

function pushBandFromObject(item: object, out: TimeBand[]): void {
  const start = String((item as { start?: unknown }).start ?? "").trim();
  const end = String((item as { end?: unknown }).end ?? "").trim();
  const startN = normalizeClockToHhMm(start);
  const endN = normalizeClockToHhMm(end);
  if (startN && endN) {
    out.push({ start: startN, end: endN });
  }
}

/**
 * Parse des plages d’ouverture JSON : tableau, ou un seul objet `{ start, end }` (jsonb objet).
 * `null` = non renseigné → l’appelant peut reprendre le modèle magasin.
 */
export function parseTimeBandsArray(raw: unknown): TimeBand[] | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const single: TimeBand[] = [];
    pushBandFromObject(raw as object, single);
    return single.length > 0 ? single : [];
  }
  if (!Array.isArray(raw)) return null;
  const out: TimeBand[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    pushBandFromObject(item, out);
  }
  return out;
}

export function parseStaffTargetsWeeklyJson(raw: unknown): Partial<Record<PlanningDayKey, number>> {
  const o: Partial<Record<PlanningDayKey, number>> = {};
  if (!raw || typeof raw !== "object") return o;
  const rec = raw as Record<string, unknown>;
  for (const k of PLANNING_DAY_KEYS) {
    const v = rec[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 500) {
      o[k] = Math.round(n * 10) / 10;
    }
  }
  return o;
}

const ovMap = (overrides: PlanningDayOverrideRow[]) => new Map(overrides.map((r) => [r.day, r]));

/** Une exception remplace le modèle hebdo (horaires + effectif du jour type). */
export function planningDayOverrideReplacesWeeklyModel(ov: PlanningDayOverrideRow): boolean {
  if (ov.is_closed) return true;
  const custom = parseTimeBandsArray(ov.opening_bands_override);
  const hasExplicitOpening = custom != null && custom.length > 0;
  const isCalendarOverride =
    ov.calendar_source === "public_holiday" || ov.calendar_source === "school_vacation";
  return hasExplicitOpening || isCalendarOverride;
}

function overrideReplacesWeeklyModel(ov: PlanningDayOverrideRow): boolean {
  return planningDayOverrideReplacesWeeklyModel(ov);
}

/** ~1 personne / 4 h de plage ouverte, minimum 1. */
function suggestStaffTargetFromBands(openingBands: TimeBand[], staffExtraBands: TimeBand[]): number | null {
  const bands = [...openingBands, ...staffExtraBands];
  if (bands.length === 0) return null;
  let totalMin = 0;
  for (const b of bands) {
    const a = minutesFromMidnight(b.start);
    const e = minutesFromMidnight(b.end);
    if (a != null && e != null && e > a) totalMin += e - a;
  }
  const hours = totalMin / 60;
  if (hours <= 0) return null;
  return Math.max(1, Math.ceil(hours / 4));
}

function resolveStaffTargetForDay(
  ov: PlanningDayOverrideRow | undefined,
  dayKey: PlanningDayKey,
  weeklyStaff: Partial<Record<PlanningDayKey, number>>,
  openingBands: TimeBand[],
  staffExtraBands: TimeBand[]
): number | null {
  if (ov?.is_closed) {
    return ov.staff_target_override != null && Number.isFinite(ov.staff_target_override)
      ? ov.staff_target_override
      : null;
  }

  if (ov?.staff_target_override != null && Number.isFinite(ov.staff_target_override)) {
    return ov.staff_target_override;
  }

  if (ov && overrideReplacesWeeklyModel(ov)) {
    return suggestStaffTargetFromBands(openingBands, staffExtraBands);
  }

  const wT = weeklyStaff[dayKey];
  return wT != null && Number.isFinite(wT) ? wT : null;
}

function resolveStaffExtraBandsForDay(
  dayKey: PlanningDayKey,
  ov: PlanningDayOverrideRow | undefined,
  weeklyStaffExtra: OpeningHoursMap
): TimeBand[] {
  if (ov && overrideReplacesWeeklyModel(ov)) {
    return [];
  }
  return [...(weeklyStaffExtra[dayKey] ?? [])].map((b) => ({ ...b }));
}

/**
 * Résout pour chaque jour de la semaine affichée : plages d’ouverture et effectif cible
 * (modèle hebdo + exceptions ponctuelles).
 */
export function resolveWeekPlanningDays(
  monday: Date,
  weeklyOpen: OpeningHoursMap,
  weeklyStaffExtra: OpeningHoursMap,
  weeklyStaff: Partial<Record<PlanningDayKey, number>>,
  overrides: PlanningDayOverrideRow[]
): WeekResolvedDay[] {
  const map = ovMap(overrides);
  const out: WeekResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const ymd = toISODateString(date);
    const dayKey = PLANNING_DAY_KEYS[i];
    const ov = map.get(ymd);

    let openingBands: TimeBand[];
    const exceptionLabel: string | null = ov?.label?.trim() || null;

    if (ov?.is_closed) {
      openingBands = [];
    } else if (ov) {
      const custom = parseTimeBandsArray(ov.opening_bands_override);
      /** Plages explicites uniquement si au moins une plage valide ; sinon modèle magasin. */
      openingBands =
        custom != null && custom.length > 0 ? custom : [...(weeklyOpen[dayKey] ?? [])];
    } else {
      openingBands = [...(weeklyOpen[dayKey] ?? [])];
    }

    const staffExtraBands = ov?.is_closed
      ? []
      : resolveStaffExtraBandsForDay(dayKey, ov, weeklyStaffExtra);
    const staffTarget = resolveStaffTargetForDay(ov, dayKey, weeklyStaff, openingBands, staffExtraBands);

    out.push({ ymd, dayKey, date, openingBands, staffExtraBands, staffTarget, exceptionLabel });
  }
  return out;
}

/** Bands pour une date précise (hors contexte semaine lundi). */
export function resolveDayPlanning(
  date: Date,
  weeklyOpen: OpeningHoursMap,
  weeklyStaffExtra: OpeningHoursMap,
  weeklyStaff: Partial<Record<PlanningDayKey, number>>,
  overrides: PlanningDayOverrideRow[]
): WeekResolvedDay {
  const ymd = toISODateString(date);
  const day = date.getDay();
  const mondayIdx = day === 0 ? 6 : day - 1;
  const monday = addDays(date, -mondayIdx);
  const week = resolveWeekPlanningDays(monday, weeklyOpen, weeklyStaffExtra, weeklyStaff, overrides);
  return week.find((w) => w.ymd === ymd) ?? {
    ymd,
    dayKey: PLANNING_DAY_KEYS[mondayIdx],
    date,
    openingBands: weeklyOpen[PLANNING_DAY_KEYS[mondayIdx]] ?? [],
    staffExtraBands: weeklyStaffExtra[PLANNING_DAY_KEYS[mondayIdx]] ?? [],
    staffTarget: weeklyStaff[PLANNING_DAY_KEYS[mondayIdx]] ?? null,
    exceptionLabel: null,
  };
}
