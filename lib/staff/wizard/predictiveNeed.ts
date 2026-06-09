import { minutesFromMidnight, type PlanningDayKey, type TimeBand } from "@/lib/staff/planningHoursTypes";
import type { PeakBandWeeklyEntry } from "@/lib/staff/planningPeakBands";
import type { BaseNeedSlot, StaffingAdjustments } from "./wizardDataTypes";

const SLOT_STEP = 30;

/**
 * Besoin de personnel heure par heure (pas de 30 min) pour un jour :
 * - base = talon de sécurité sur toute l'ouverture,
 * - relevé au niveau de l'effectif de pointe sur les plages concernées,
 * - +1 par ajustement actif (canicule, forte affluence) pendant l'ouverture.
 */
export function computeDayBaseNeed(
  openingBands: TimeBand[],
  securityFloor: number,
  peaks: PeakBandWeeklyEntry[],
  adjustments: StaffingAdjustments
): BaseNeedSlot[] {
  if (openingBands.length === 0) return [];

  const floor = Math.max(1, Math.round(securityFloor));
  const bump = (adjustments.heatwave ? 1 : 0) + (adjustments.highTraffic ? 1 : 0);

  const slots: BaseNeedSlot[] = [];
  for (const band of openingBands) {
    const startM = minutesFromMidnight(band.start);
    const endM = minutesFromMidnight(band.end);
    if (startM == null || endM == null || endM <= startM) continue;

    for (let m = startM; m + SLOT_STEP <= endM; m += SLOT_STEP) {
      let need = floor;
      for (const p of peaks) {
        const pa = minutesFromMidnight(p.start);
        const pb = minutesFromMidnight(p.end);
        if (pa == null || pb == null) continue;
        if (m >= pa && m < pb) need = Math.max(need, Math.ceil(p.staffCount));
      }
      slots.push({ minute: m, need: need + bump });
    }
  }
  return slots;
}

export function computeBaseNeedByDay(
  openingByDay: Partial<Record<PlanningDayKey, TimeBand[]>>,
  securityFloor: number,
  peaksByDay: Partial<Record<PlanningDayKey, PeakBandWeeklyEntry[]>>,
  adjustments: StaffingAdjustments
): Partial<Record<PlanningDayKey, BaseNeedSlot[]>> {
  const out: Partial<Record<PlanningDayKey, BaseNeedSlot[]>> = {};
  for (const key of Object.keys(openingByDay) as PlanningDayKey[]) {
    const bands = openingByDay[key] ?? [];
    if (bands.length === 0) continue;
    out[key] = computeDayBaseNeed(bands, securityFloor, peaksByDay[key] ?? [], adjustments);
  }
  return out;
}
