import type { TimeBand } from "@/lib/staff/planningHoursTypes";
import type { PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import { minutesFromMidnight } from "@/lib/staff/planningHoursTypes";
import type { GeneratedSimulationShift } from "@/lib/staff/autoSimulation";

export type PlanningPeakBandInput = {
  start: string;
  end: string;
  /** Effectif souhaité pendant cette plage (absolu, pas en plus du reste). */
  staffCount: number;
};

export type PlanningSimulationOptions = {
  /** Minimum de personnes simultanées pendant les plages d'ouverture. */
  securityFloor?: number;
  peakBandsByDay?: Record<string, PlanningPeakBandInput[]>;
  allowWeeklyOvertime?: {
    enabled: boolean;
    /** Ex. 25 = jusqu’à +25 % du contrat hebdo. */
    maxOvertimePercent: number;
    /** Vide = tous les collaborateurs avec contrat. */
    staffIds: string[];
  };
  prioritizeRoleBalance?: boolean;
  /** Plafond heures nettes / jour / personne (id → h, null = illimité). */
  maxDailyHoursByStaffId?: Record<string, number | null>;
  /** Heures supplémentaires autorisées cette semaine (id → h). */
  weeklyHoursBonusByStaffId?: Record<string, number>;
  /** Congés / indispos : collaborateurs exclus par jour (ymd → ids). */
  absentStaffIdsByYmd?: Record<string, string[]>;
  /** Jours de repos fixes à respecter pendant la génération (id → jours semaine). */
  fixedRestDaysByStaffId?: Partial<Record<string, PlanningDayKey[]>>;
  /** Nombre de jours de repos souhaités par semaine (id → 0..7). */
  weeklyRestDaysByStaffId?: Record<string, number>;
};

export function parsePeakBandsInput(raw: unknown): PlanningPeakBandInput[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanningPeakBandInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = String((item as { start?: unknown }).start ?? "").trim();
    const end = String((item as { end?: unknown }).end ?? "").trim();
    const n = Number((item as { staffCount?: unknown }).staffCount);
    if (!start || !end || !Number.isFinite(n) || n <= 0) continue;
    out.push({ start, end, staffCount: Math.min(500, Math.ceil(n)) });
  }
  return out;
}

function shiftOnYmd(iso: string, ymd: string): boolean {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === ymd;
}

/** Nombre de collaborateurs distincts avec un créneau chevauchant la plage de pointe. */
export function countStaffCoveringPeak(
  shifts: GeneratedSimulationShift[],
  ymd: string,
  peak: TimeBand
): number {
  const pa = minutesFromMidnight(peak.start);
  const pb = minutesFromMidnight(peak.end);
  if (pa == null || pb == null || pb <= pa) return 0;

  const ids = new Set<string>();
  for (const s of shifts) {
    if (!shiftOnYmd(s.starts_at, ymd)) continue;
    const st = new Date(s.starts_at);
    const en = new Date(s.ends_at);
    const ss = st.getHours() * 60 + st.getMinutes();
    const se = en.getHours() * 60 + en.getMinutes();
    if (se <= ss) continue;
    if (ss < pb && se > pa) ids.add(s.staff_member_id);
  }
  return ids.size;
}
