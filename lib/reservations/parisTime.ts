/** Helpers fuseau Europe/Paris pour l’UI réservations. */

export function parisYmdTimeDurationFromIsos(
  startIso: string,
  endIso: string
): { ymd: string; timeHm: string; durationMinutes: number } {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return { ymd: "", timeHm: "12:00", durationMinutes: 90 };
  }
  const ymd = s.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const timeHm = formatParisHm(s);
  const durationMinutes = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60_000));
  return { ymd, timeHm, durationMinutes };
}

function formatParisHm(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "12";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

/**
 * Heure + minute en Paris pour positionnement planning (0–24h).
 */
export function parisHourMinute(iso: string): { h: number; m: number } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { h: 12, m: 0 };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { h, m: Number.isNaN(m) ? 0 : m };
}

export function minutesSinceMidnightParis(iso: string): number {
  const { h, m } = parisHourMinute(iso);
  return h * 60 + m;
}

export function validateDurationMinutes(m: number): string | null {
  if (!Number.isFinite(m) || m < 30 || m > 360) {
    return "La durée doit être entre 30 et 360 minutes.";
  }
  if (m % 15 !== 0) {
    return "Utilisez un pas de 15 minutes (ex. 90, 120).";
  }
  return null;
}
