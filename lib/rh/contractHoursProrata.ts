import { addDays, mondayOfWeekContaining, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";
import { round2 } from "@/lib/rh/payslipMonth";

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Nombre de jours calendaires inclus entre deux dates AAAA-MM-JJ. */
export function inclusiveDaysBetween(fromYmd: string, toYmd: string): number {
  const from = parseISODateLocal(fromYmd);
  const to = parseISODateLocal(toYmd);
  if (!from || !to || to < from) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/**
 * Heures contractuelles attendues sur une période, prorata par semaine (lundi→dimanche).
 * Chaque semaine partiellement couverte compte `weeklyHours × (jours dans la période / 7)`.
 */
export function expectedHoursForDateRange(
  weeklyHours: number,
  fromYmd: string,
  toYmd: string
): number {
  if (weeklyHours <= 0) return 0;
  const from = parseISODateLocal(fromYmd);
  const to = parseISODateLocal(toYmd);
  if (!from || !to || to < from) return 0;

  let total = 0;
  let monday = mondayOfWeekContaining(from);
  const end = to;

  while (monday <= end) {
    const weekStart = monday;
    const weekEnd = addDays(monday, 6);
    const overlapStart = weekStart < from ? from : weekStart;
    const overlapEnd = weekEnd > end ? end : weekEnd;
    if (overlapStart <= overlapEnd) {
      const days =
        Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000) + 1;
      total += weeklyHours * (days / 7);
    }
    monday = addDays(monday, 7);
  }

  return round2(total);
}

export function intersectPeriod(
  periodFrom: string,
  periodTo: string,
  windowFrom: string | null,
  windowTo: string | null
): { from: string; to: string } | null {
  const from = windowFrom ? maxYmd(periodFrom, windowFrom) : periodFrom;
  const to = windowTo ? minYmd(periodTo, windowTo) : periodTo;
  if (from > to) return null;
  return { from, to };
}

export function monthEndYmd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}

export function todayYmdParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type ContractHoursWeekSlice = {
  weekStart: string;
  weekEnd: string;
  expectedHours: number;
};

/** Découpe hebdomadaire (lundi→dimanche) pour une période effective. */
export function weekSlicesForRange(
  weeklyHours: number,
  fromYmd: string,
  toYmd: string
): ContractHoursWeekSlice[] {
  const from = parseISODateLocal(fromYmd);
  const to = parseISODateLocal(toYmd);
  if (!from || !to || to < from) return [];

  const slices: ContractHoursWeekSlice[] = [];
  let monday = mondayOfWeekContaining(from);

  while (monday <= to) {
    const weekStart = toISODateString(monday);
    const weekEndDate = addDays(monday, 6);
    const weekEnd = toISODateString(weekEndDate > to ? to : weekEndDate);
    const sliceFrom = maxYmd(weekStart, fromYmd);
    const sliceTo = minYmd(toISODateString(addDays(monday, 6)), toYmd);
    if (sliceFrom <= sliceTo) {
      slices.push({
        weekStart: sliceFrom,
        weekEnd: sliceTo,
        expectedHours: expectedHoursForDateRange(weeklyHours, sliceFrom, sliceTo),
      });
    }
    monday = addDays(monday, 7);
  }

  return slices;
}
