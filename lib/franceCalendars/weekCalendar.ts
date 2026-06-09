import { listPublicHolidaysFrMetropole } from "@/lib/franceCalendars/publicHolidays";
import { listSchoolVacationPeriods } from "@/lib/franceCalendars/schoolVacations";
import { PLANNING_DAY_KEYS, type PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import { addDays, toISODateString } from "@/lib/staff/weekUtils";

export type WeekCalendarDay = {
  ymd: string;
  dayKey: PlanningDayKey;
  kind: "public_holiday" | "school_vacation";
  label: string;
};

/**
 * Détecte les jours fériés et de vacances scolaires d'une semaine (lundi → dimanche),
 * en combinant les sources annuelles existantes (package jours-fériés + CSV vacances).
 * Ne lit pas la base : pur calcul calendaire pour pré-remplir l'Étape 1 du wizard.
 */
export function detectCalendarForWeek(
  weekMondayYmd: string,
  schoolZone: "A" | "B" | "C" | null
): WeekCalendarDay[] {
  const monday = parseYmd(weekMondayYmd);
  if (!monday) return [];

  // Jours de la semaine (peut chevaucher 2 années → on agrège les années rencontrées).
  const days = PLANNING_DAY_KEYS.map((dayKey, i) => {
    const date = addDays(monday, i);
    return { dayKey, ymd: toISODateString(date), year: date.getFullYear() };
  });
  const years = [...new Set(days.map((d) => d.year))];

  // Fériés indexés par ymd.
  const holidayByYmd = new Map<string, string>();
  for (const y of years) {
    for (const h of listPublicHolidaysFrMetropole(y)) holidayByYmd.set(h.date, h.name);
  }

  // Vacances : ensemble des jours couverts, avec libellé de la période.
  const vacationByYmd = new Map<string, string>();
  const zone = schoolZone ?? "C"; // fallback aligné sur la page édition établissement
  for (const y of years) {
    for (const period of listSchoolVacationPeriods(y, zone)) {
      for (const ymd of period.days) vacationByYmd.set(ymd, `${period.name} — Zone ${zone}`);
    }
  }

  const out: WeekCalendarDay[] = [];
  for (const d of days) {
    const holiday = holidayByYmd.get(d.ymd);
    if (holiday) out.push({ ymd: d.ymd, dayKey: d.dayKey, kind: "public_holiday", label: holiday });
    const vacation = vacationByYmd.get(d.ymd);
    if (vacation) out.push({ ymd: d.ymd, dayKey: d.dayKey, kind: "school_vacation", label: vacation });
  }
  return out;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
