import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { minutesFromMidnight, type TimeBand } from "@/lib/staff/planningHoursTypes";
import { intersectTimeBands, mergedStaffWorkBands } from "@/lib/staff/staffWorkWindows";
import type { StaffMember } from "@/lib/staff/types";

export type GeneratedSimulationShift = {
  staff_member_id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  notes: string | null;
};

/** Meilleur chevauchement plage d’ouverture / fenêtres de travail (service + prépa). */
function bestOverlapBand(band: TimeBand, eff: TimeBand[]): TimeBand | null {
  const ovs = intersectTimeBands([band], eff);
  if (ovs.length === 0) return null;
  return ovs.reduce((best, o) =>
    bandDurationMinutes(o) > bandDurationMinutes(best) ? o : best
  );
}

function localDateTimeOnDay(day: Date, hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return new Date(day);
  const d = new Date(day);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function bandDurationMinutes(band: TimeBand): number {
  const a = minutesFromMidnight(band.start);
  const b = minutesFromMidnight(band.end);
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

function breakForDurationMinutes(d: number): number | null {
  return d > 360 ? 30 : null;
}

/**
 * Proposition de créneaux pour la semaine (plages d’ouverture × fenêtres service + prépa par collaborateur).
 */
export function generateAutoSimulationShifts(params: {
  resolvedWeekDays: WeekResolvedDay[];
  staff: StaffMember[];
}): GeneratedSimulationShift[] {
  const { resolvedWeekDays, staff } = params;
  const active = staff.filter((s) => s.active);
  if (active.length === 0) return [];

  const usedMinutes = new Map<string, number>();
  const out: GeneratedSimulationShift[] = [];

  resolvedWeekDays.forEach((wd, dayIndex) => {
    if (wd.openingBands.length === 0) return;

    const nBands = wd.openingBands.length;
    const targetRaw = wd.staffTarget;

    const dailyDistinctTarget =
      targetRaw != null && Number.isFinite(targetRaw) && targetRaw > 0
        ? Math.min(Math.max(1, Math.ceil(Number(targetRaw))), active.length)
        : null;

    const perBandHeadcount =
      dailyDistinctTarget != null
        ? Math.max(1, Math.ceil(dailyDistinctTarget / nBands))
        : 1;

    const scheduledThisCalendarDay = new Set<string>();

    wd.openingBands.forEach((band, bandIdx) => {
      if (bandDurationMinutes(band) <= 0) return;

      type Cand = { member: StaffMember; ob: TimeBand; dur: number };
      const candidates: Cand[] = [];
      for (const m of active) {
        const eff = mergedStaffWorkBands(m, wd);
        const ob = bestOverlapBand(band, eff);
        if (!ob) continue;
        const dur = bandDurationMinutes(ob);
        if (dur <= 0) continue;
        const cap = m.target_weekly_hours;
        if (cap != null && Number.isFinite(cap) && cap > 0) {
          const used = usedMinutes.get(m.id) ?? 0;
          if (used + dur > cap * 60 + 0.01) continue;
        }
        candidates.push({ member: m, ob, dur });
      }

      const needMoreDistinct =
        dailyDistinctTarget != null && scheduledThisCalendarDay.size < dailyDistinctTarget;

      candidates.sort((a, b) => {
        if (needMoreDistinct) {
          const aSeen = scheduledThisCalendarDay.has(a.member.id);
          const bSeen = scheduledThisCalendarDay.has(b.member.id);
          if (aSeen !== bSeen) return aSeen ? 1 : -1;
        }
        const ua = usedMinutes.get(a.member.id) ?? 0;
        const ub = usedMinutes.get(b.member.id) ?? 0;
        if (ua !== ub) return ua - ub;
        return a.member.id.localeCompare(b.member.id);
      });

      const k = Math.min(perBandHeadcount, candidates.length);
      const offset = (dayIndex * 11 + bandIdx * 3) % Math.max(candidates.length, 1);
      const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];

      for (let i = 0; i < k; i++) {
        const { member: m, ob, dur } = rotated[i];
        const start = localDateTimeOnDay(wd.date, ob.start);
        const end = localDateTimeOnDay(wd.date, ob.end);
        if (!(end > start)) continue;

        usedMinutes.set(m.id, (usedMinutes.get(m.id) ?? 0) + dur);
        scheduledThisCalendarDay.add(m.id);

        out.push({
          staff_member_id: m.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          break_minutes: breakForDurationMinutes(dur),
          notes: `Auto · ${ob.start}–${ob.end}`,
        });
      }
    });
  });

  return out;
}
