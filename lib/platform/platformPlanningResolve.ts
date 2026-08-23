import type { OpeningHoursMap } from "@/lib/staff/planningHoursTypes";
import { PLANNING_DAY_KEYS } from "@/lib/staff/planningHoursTypes";
import { resolveWeekPlanningDays, type WeekResolvedDay } from "@/lib/staff/planningResolve";
import { addDays, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";

/** Horaires bureau par défaut : lun–ven 9h–18h. */
export const DEFAULT_PLATFORM_OFFICE_HOURS: OpeningHoursMap = {
  mon: [{ start: "09:00", end: "18:00" }],
  tue: [{ start: "09:00", end: "18:00" }],
  wed: [{ start: "09:00", end: "18:00" }],
  thu: [{ start: "09:00", end: "18:00" }],
  fri: [{ start: "09:00", end: "18:00" }],
  sat: [],
  sun: [],
};

export function parsePlatformOfficeHours(raw: unknown): OpeningHoursMap {
  if (!raw || typeof raw !== "object") return DEFAULT_PLATFORM_OFFICE_HOURS;
  const out = { ...DEFAULT_PLATFORM_OFFICE_HOURS };
  for (const key of PLANNING_DAY_KEYS) {
    const bands = (raw as Record<string, unknown>)[key];
    if (Array.isArray(bands)) {
      out[key] = bands
        .filter((b) => b && typeof b === "object")
        .map((b) => ({
          start: String((b as { start?: unknown }).start ?? ""),
          end: String((b as { end?: unknown }).end ?? ""),
        }))
        .filter((b) => b.start && b.end);
    }
  }
  return out;
}

export function resolvePlatformWeekDays(
  weekMondayIso: string,
  officeHours: OpeningHoursMap
): WeekResolvedDay[] {
  const monday = parseISODateLocal(weekMondayIso);
  if (!monday) return [];
  return resolveWeekPlanningDays(monday, officeHours, {}, {}, []);
}

export function weekNavigationHref(weekYmd: string): string {
  return `/admin/company/team?week=${encodeURIComponent(weekYmd)}`;
}

export function prevWeekYmd(weekMondayIso: string): string {
  const m = parseISODateLocal(weekMondayIso);
  if (!m) return weekMondayIso;
  return toISODateString(addDays(m, -7));
}

export function nextWeekYmd(weekMondayIso: string): string {
  const m = parseISODateLocal(weekMondayIso);
  if (!m) return weekMondayIso;
  return toISODateString(addDays(m, 7));
}
