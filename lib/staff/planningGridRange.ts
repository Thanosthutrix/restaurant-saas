import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { minutesFromMidnight } from "@/lib/staff/planningHoursTypes";
import type { WorkShiftWithDetails } from "@/lib/staff/types";

/** Plage verticale commune (vue semaine / planning manuel). */
export function computePlanningWeekTimeRange(
  shifts: WorkShiftWithDetails[],
  resolvedWeekDays: WeekResolvedDay[]
): { minM: number; maxM: number } {
  let lo = 24 * 60;
  let hi = 0;
  let any = false;
  for (const wd of resolvedWeekDays) {
    for (const b of wd.openingBands) {
      const a = minutesFromMidnight(b.start);
      const e = minutesFromMidnight(b.end);
      if (a != null && e != null && e > a) {
        any = true;
        lo = Math.min(lo, a);
        hi = Math.max(hi, e);
      }
    }
    for (const b of wd.staffExtraBands ?? []) {
      const a = minutesFromMidnight(b.start);
      const e = minutesFromMidnight(b.end);
      if (a != null && e != null && e > a) {
        any = true;
        lo = Math.min(lo, a);
        hi = Math.max(hi, e);
      }
    }
  }
  for (const s of shifts) {
    const st = new Date(s.starts_at);
    const en = new Date(s.ends_at);
    if (st.toDateString() !== en.toDateString()) continue;
    const ds = st.getHours() * 60 + st.getMinutes();
    const de = en.getHours() * 60 + en.getMinutes();
    any = true;
    lo = Math.min(lo, ds);
    hi = Math.max(hi, de);
  }
  if (!any) return { minM: 6 * 60, maxM: 23 * 60 };
  lo = Math.max(0, lo - 60);
  hi = Math.min(24 * 60, hi + 60);
  if (hi <= lo) return { minM: 6 * 60, maxM: 23 * 60 };
  return { minM: lo, maxM: hi };
}
