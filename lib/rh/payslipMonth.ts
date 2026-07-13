const PARIS_TZ = "Europe/Paris";

/** YYYY-MM depuis une date ISO (fuseau Paris). */
export function parisYmFromIso(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

/** Jour YYYY-MM-DD depuis une date ISO (fuseau Paris). */
export function parisDayFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Premier jour du mois (YYYY-MM-DD). */
export function monthStartYmd(ym: string): string {
  return `${ym}-01`;
}

/** Bornes ISO pour listWorkShiftsInRange sur un mois calendaire (Paris). */
export function monthRangeIso(ym: string): { rangeStartIso: string; rangeEndExclusiveIso: string } {
  const [y, m] = ym.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const start = new Date(`${ym}-01T00:00:00+02:00`);
  const end = new Date(`${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+02:00`);
  return { rangeStartIso: start.toISOString(), rangeEndExclusiveIso: end.toISOString() };
}

/** Heures contractuelles mensuelles (52/12 × hebdo). */
export function monthlyContractHours(weeklyHours: number | null | undefined): number | null {
  if (weeklyHours == null || !Number.isFinite(weeklyHours) || weeklyHours <= 0) return null;
  return round2((weeklyHours * 52) / 12);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const MONTH_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatPeriodMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const label = MONTH_LABELS[m - 1] ?? ym;
  return `${label} ${y}`;
}

export function currentYmParis(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function previousYm(ym: string, count = 1): string {
  const [y, m] = ym.split("-").map(Number);
  let month = m - count;
  let year = y;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function recentMonths(count: number, fromYm?: string): string[] {
  const start = fromYm ?? currentYmParis();
  return Array.from({ length: count }, (_, i) => previousYm(start, i));
}
