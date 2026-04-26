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

/**
 * Normalise une valeur `date` (Postgres / Supabase) en AAAA-MM-JJ **calendaire local**,
 * comme `toISODateString`, pour indexer les exceptions avec les mêmes clés que `resolveWeekPlanningDays`.
 * Évite les clés invalides si le client renvoie un `Date` ou une chaîne non ISO (ex. slice(0,10) sur une Date JS).
 */
export function toPlanningYmdFromUnknown(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    const head = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    if (head) return head[1]!;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return toISODateString(d);
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return toISODateString(raw);
  }
  return null;
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
