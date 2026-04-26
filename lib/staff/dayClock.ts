import type { WorkShiftWithDetails } from "@/lib/staff/types";

export function findPendingClockOut(shifts: WorkShiftWithDetails[]): WorkShiftWithDetails | null {
  const open = shifts.filter((s) => s.attendance?.clock_in_at && !s.attendance?.clock_out_at);
  if (open.length === 0) return null;
  open.sort((a, b) => {
    const bi = b.attendance?.clock_in_at;
    const ai = a.attendance?.clock_in_at;
    if (!bi || !ai) return 0;
    return new Date(bi).getTime() - new Date(ai).getTime();
  });
  return open[0] ?? null;
}

/** Prochain créneau sans entrée enregistrée, créneau non terminé ; ignoré si une sortie est attendue. */
export function findPendingArrival(
  shifts: WorkShiftWithDetails[],
  now: Date = new Date()
): WorkShiftWithDetails | null {
  const missingIn = shifts
    .filter((s) => !s.attendance?.clock_in_at)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  for (const s of missingIn) {
    if (new Date(s.ends_at) > now) return s;
  }
  return null;
}

/** Ligne du type « mer 22 avr : 11:00 - 19:00 » (sans point final sur les abréviations). */
export function formatMyShiftLineFr(startsAtIso: string, endsAtIso: string): string {
  const a = new Date(startsAtIso);
  const b = new Date(endsAtIso);
  const wd = a
    .toLocaleDateString("fr-FR", { weekday: "short" })
    .replace(/\.$/, "")
    .trim();
  const dayNum = a.getDate();
  const mo = a
    .toLocaleDateString("fr-FR", { month: "short" })
    .replace(/\.$/, "")
    .trim();
  const t1 = a.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const t2 = b.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${wd} ${dayNum} ${mo} : ${t1} - ${t2}`;
}
