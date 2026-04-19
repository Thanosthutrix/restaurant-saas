import getJoursFeries from "@socialgouv/jours-feries";

export type PublicHolidayEntry = { date: string; name: string };

function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Jours fériés en France métropolitaine (hors Alsace-Moselle), triés par date. */
export function listPublicHolidaysFrMetropole(year: number): PublicHolidayEntry[] {
  const raw = getJoursFeries(year, { alsace: false }) as Record<string, Date>;
  const merged = new Map<string, string>();
  for (const [name, d] of Object.entries(raw)) {
    const ymd = dateToYmd(d);
    const prev = merged.get(ymd);
    merged.set(ymd, prev ? `${prev} / ${name}` : name);
  }
  return [...merged.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
