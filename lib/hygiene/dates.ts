/** Fin de journée calendaire en UTC (V1 : cohérent et stable côté serveur). */
export function endOfUtcDayIso(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Date invalide");
  return `${ymd}T23:59:59.999Z`;
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Jours calendaires inclus entre deux bornes (heure ignorée). */
export function eachCalendarDayInclusive(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (cur <= last) {
    out.push(ymd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Mois au format YYYY-MM couvrant une date UTC. */
export function yearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Dernier jour du mois (1–31) pour une date UTC. */
export function daysInMonthUtc(y: number, monthIndex0: number): number {
  return new Date(Date.UTC(y, monthIndex0 + 1, 0)).getUTCDate();
}
