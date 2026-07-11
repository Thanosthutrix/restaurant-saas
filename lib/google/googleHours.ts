import { bandsSignature } from "@/lib/staff/planningBandPresets";
import type { OpeningHoursMap, PlanningDayKey, TimeBand } from "@/lib/staff/planningHoursTypes";
import { PLANNING_DAY_KEYS } from "@/lib/staff/planningHoursTypes";
import { parseTimeBandsArray, type PlanningDayOverrideRow } from "@/lib/staff/planningResolve";
import { planningDayKeyFromYmd } from "@/lib/staff/weekUtils";

const DAY_MAP: Record<PlanningDayKey, string> = {
  mon: "MONDAY",
  tue: "TUESDAY",
  wed: "WEDNESDAY",
  thu: "THURSDAY",
  fri: "FRIDAY",
  sat: "SATURDAY",
  sun: "SUNDAY",
};

export type GoogleTimeOfDay = {
  hours: number;
  minutes: number;
  seconds?: number;
  nanos?: number;
};

export type GoogleDate = {
  year: number;
  month: number;
  day: number;
};

export type GoogleRegularHours = {
  periods: Array<{
    openDay: string;
    closeDay: string;
    openTime: GoogleTimeOfDay;
    closeTime: GoogleTimeOfDay;
  }>;
};

export type GoogleSpecialHours = {
  specialHourPeriods: Array<{
    startDate: GoogleDate;
    endDate: GoogleDate;
    openTime?: GoogleTimeOfDay;
    closeTime?: GoogleTimeOfDay;
    closed?: boolean;
  }>;
};

export function hhmmToGoogleTimeOfDay(hhmm: string): GoogleTimeOfDay {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m, seconds: 0, nanos: 0 };
}

export function ymdToGoogleDate(ymd: string): GoogleDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

export function buildGoogleRegularHours(opening: OpeningHoursMap): GoogleRegularHours | null {
  const periods: GoogleRegularHours["periods"] = [];

  for (const key of PLANNING_DAY_KEYS) {
    const openDay = DAY_MAP[key];
    const bands = opening[key];
    if (!openDay || !bands?.length) continue;
    for (const band of bands) {
      periods.push({
        openDay,
        closeDay: openDay,
        openTime: hhmmToGoogleTimeOfDay(band.start),
        closeTime: hhmmToGoogleTimeOfDay(band.end),
      });
    }
  }

  return periods.length > 0 ? { periods } : null;
}

function weeklyBandsForDay(opening: OpeningHoursMap, dayKey: PlanningDayKey): TimeBand[] {
  return [...(opening[dayKey] ?? [])];
}

function overrideDiffersFromWeekly(
  ov: PlanningDayOverrideRow,
  weeklyOpen: OpeningHoursMap,
  dayKey: PlanningDayKey
): boolean {
  const weeklyBands = weeklyBandsForDay(weeklyOpen, dayKey);

  if (ov.is_closed) {
    return weeklyBands.length > 0;
  }

  const custom = parseTimeBandsArray(ov.opening_bands_override);
  if (custom == null || custom.length === 0) {
    return false;
  }

  return bandsSignature(custom) !== bandsSignature(weeklyBands);
}

function effectiveBandsForOverride(
  ov: PlanningDayOverrideRow,
  weeklyOpen: OpeningHoursMap,
  dayKey: PlanningDayKey
): TimeBand[] {
  if (ov.is_closed) return [];
  const custom = parseTimeBandsArray(ov.opening_bands_override);
  if (custom != null && custom.length > 0) return custom;
  return weeklyBandsForDay(weeklyOpen, dayKey);
}

/**
 * Exceptions ERP → specialHours Google (jours qui diffèrent du modèle hebdo).
 */
export function buildGoogleSpecialHours(
  weeklyOpen: OpeningHoursMap,
  overrides: PlanningDayOverrideRow[],
  fromYmd: string
): GoogleSpecialHours {
  const periods: GoogleSpecialHours["specialHourPeriods"] = [];

  for (const ov of overrides) {
    if (ov.day < fromYmd) continue;

    const dayKey = planningDayKeyFromYmd(ov.day);
    const startDate = ymdToGoogleDate(ov.day);
    if (!dayKey || !startDate) continue;

    if (!overrideDiffersFromWeekly(ov, weeklyOpen, dayKey)) continue;

    if (ov.is_closed) {
      periods.push({
        startDate,
        endDate: startDate,
        closed: true,
      });
      continue;
    }

    const bands = effectiveBandsForOverride(ov, weeklyOpen, dayKey);
    for (const band of bands) {
      periods.push({
        startDate,
        endDate: startDate,
        openTime: hhmmToGoogleTimeOfDay(band.start),
        closeTime: hhmmToGoogleTimeOfDay(band.end),
        closed: false,
      });
    }
  }

  return { specialHourPeriods: periods };
}
