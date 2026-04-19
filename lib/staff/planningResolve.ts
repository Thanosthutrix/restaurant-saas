import {
  type OpeningHoursMap,
  type PlanningDayKey,
  type TimeBand,
  PLANNING_DAY_KEYS,
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
  staffTarget: number | null;
  exceptionLabel: string | null;
};

/** Parse un tableau de plages horaires (JSON). */
export function parseTimeBandsArray(raw: unknown): TimeBand[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: TimeBand[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = String((item as { start?: unknown }).start ?? "").trim();
    const end = String((item as { end?: unknown }).end ?? "").trim();
    if (/^([01]?\d|2[0-3]):([0-5]\d)$/.test(start) && /^([01]?\d|2[0-3]):([0-5]\d)$/.test(end)) {
      out.push({ start, end });
    }
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

/**
 * Résout pour chaque jour de la semaine affichée : plages d’ouverture et effectif cible
 * (modèle hebdo + exceptions ponctuelles).
 */
export function resolveWeekPlanningDays(
  monday: Date,
  weeklyOpen: OpeningHoursMap,
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
    let staffTarget: number | null;
    let exceptionLabel: string | null = ov?.label?.trim() || null;

    if (ov?.is_closed) {
      openingBands = [];
      staffTarget =
        ov.staff_target_override != null && Number.isFinite(ov.staff_target_override)
          ? ov.staff_target_override
          : null;
    } else if (ov) {
      const custom = parseTimeBandsArray(ov.opening_bands_override);
      openingBands = custom != null ? custom : [...(weeklyOpen[dayKey] ?? [])];
      const wT = weeklyStaff[dayKey];
      staffTarget =
        ov.staff_target_override != null && Number.isFinite(ov.staff_target_override)
          ? ov.staff_target_override
          : wT != null && Number.isFinite(wT)
            ? wT
            : null;
    } else {
      openingBands = [...(weeklyOpen[dayKey] ?? [])];
      const wT = weeklyStaff[dayKey];
      staffTarget = wT != null && Number.isFinite(wT) ? wT : null;
    }

    out.push({ ymd, dayKey, date, openingBands, staffTarget, exceptionLabel });
  }
  return out;
}

/** Bands pour une date précise (hors contexte semaine lundi). */
export function resolveDayPlanning(
  date: Date,
  weeklyOpen: OpeningHoursMap,
  weeklyStaff: Partial<Record<PlanningDayKey, number>>,
  overrides: PlanningDayOverrideRow[]
): WeekResolvedDay {
  const ymd = toISODateString(date);
  const day = date.getDay();
  const mondayIdx = day === 0 ? 6 : day - 1;
  const monday = addDays(date, -mondayIdx);
  const week = resolveWeekPlanningDays(monday, weeklyOpen, weeklyStaff, overrides);
  return week.find((w) => w.ymd === ymd) ?? {
    ymd,
    dayKey: PLANNING_DAY_KEYS[mondayIdx],
    date,
    openingBands: weeklyOpen[PLANNING_DAY_KEYS[mondayIdx]] ?? [],
    staffTarget: weeklyStaff[PLANNING_DAY_KEYS[mondayIdx]] ?? null,
    exceptionLabel: null,
  };
}
