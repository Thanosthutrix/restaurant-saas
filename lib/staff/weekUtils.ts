/** Lundi 00:00:00 (heure locale) de la semaine contenant `date`. */
export function mondayOfWeekContaining(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse AAAA-MM-JJ ; retourne null si invalide. */
export function parseISODateLocal(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** `week` = n’importe quel jour ; on prend le lundi de cette semaine-là. */
export function mondayFromWeekParam(weekYmd: string | null | undefined): Date {
  if (!weekYmd) return mondayOfWeekContaining(new Date());
  const parsed = parseISODateLocal(weekYmd);
  if (!parsed) return mondayOfWeekContaining(new Date());
  return mondayOfWeekContaining(parsed);
}
