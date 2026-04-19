/** Durée prévue du shift en minutes. */
export function plannedDurationMinutes(startsAtIso: string, endsAtIso: string): number {
  const a = new Date(startsAtIso).getTime();
  const b = new Date(endsAtIso).getTime();
  return Math.round((b - a) / 60000);
}

/** Durée pointée (entrée → sortie), ou null si incomplet. */
export function actualDurationMinutes(
  clockIn: string | null,
  clockOut: string | null
): number | null {
  if (!clockIn || !clockOut) return null;
  const a = new Date(clockIn).getTime();
  const b = new Date(clockOut).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

/** Écart réalisé − prévu (minutes). Positif = plus long que prévu. */
export function varianceMinutes(
  plannedMinutes: number,
  actualMinutes: number | null
): number | null {
  if (actualMinutes == null) return null;
  return actualMinutes - plannedMinutes;
}

export function formatMinutesHuman(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "−" : "";
  const n = Math.abs(totalMinutes);
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h} h`;
  return `${sign}${h} h ${m} min`;
}
