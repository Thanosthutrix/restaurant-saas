import {
  PLANNING_DAY_KEYS,
  type PlanningDayKey,
  minutesFromMidnight,
} from "@/lib/staff/planningHoursTypes";

export type PeakBandWeeklyEntry = {
  start: string;
  end: string;
  staffCount: number;
};

export type PeakBandsWeeklyMap = Partial<Record<PlanningDayKey, PeakBandWeeklyEntry[]>>;

export function parsePeakBandsWeeklyJson(raw: unknown): PeakBandsWeeklyMap {
  if (raw == null || typeof raw !== "object") return {};
  const out: PeakBandsWeeklyMap = {};

  for (const key of PLANNING_DAY_KEYS) {
    const dayRaw = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(dayRaw)) continue;
    const bands: PeakBandWeeklyEntry[] = [];
    for (const item of dayRaw) {
      if (!item || typeof item !== "object") continue;
      const start = String((item as { start?: unknown }).start ?? "").trim();
      const end = String((item as { end?: unknown }).end ?? "").trim();
      const n = Number((item as { staffCount?: unknown }).staffCount);
      if (!start || !end || !Number.isFinite(n) || n <= 0) continue;
      const a = minutesFromMidnight(start);
      const b = minutesFromMidnight(end);
      if (a == null || b == null || b <= a) continue;
      bands.push({ start, end, staffCount: Math.min(500, Math.ceil(n)) });
    }
    if (bands.length > 0) out[key] = bands;
  }

  return out;
}

/** Sérialise pour Supabase (sans jours vides). */
export function serializePeakBandsWeeklyJson(map: PeakBandsWeeklyMap): Record<string, PeakBandWeeklyEntry[]> {
  const out: Record<string, PeakBandWeeklyEntry[]> = {};
  for (const key of PLANNING_DAY_KEYS) {
    const bands = map[key];
    if (!bands?.length) continue;
    out[key] = bands.map((b) => ({
      start: b.start,
      end: b.end,
      staffCount: b.staffCount,
    }));
  }
  return out;
}
