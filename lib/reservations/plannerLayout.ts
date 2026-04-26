/**
 * Attribue un « couloir » (colonne) à chaque réservation pour éviter le chevauchement visuel
 * lorsque les créneaux se recoupent (algorithme glouton sur intervalles, même idée qu’un planning de salles).
 */

export type IntervalMin = { id: string; startMin: number; endMin: number };

/** Aucun intervalle d’arrivée n’est strictement contenu dans l’ancien — on réutilise la première piste libre. */
export function assignReservationLanes(items: IntervalMin[]): { laneById: Map<string, number>; laneCount: number } {
  if (items.length === 0) {
    return { laneById: new Map(), laneCount: 1 };
  }
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEndAt: number[] = [];
  const laneById = new Map<string, number>();

  for (const it of sorted) {
    let lane = -1;
    for (let L = 0; L < laneEndAt.length; L++) {
      if (it.startMin >= laneEndAt[L]) {
        lane = L;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEndAt.length;
      laneEndAt.push(it.endMin);
    } else {
      laneEndAt[lane] = it.endMin;
    }
    laneById.set(it.id, lane);
  }

  return { laneById, laneCount: Math.max(1, laneEndAt.length) };
}

export function clipInterval(
  startMin: number,
  endMin: number,
  dayStartMin: number,
  dayEndMin: number
): { a: number; b: number } | null {
  const a = Math.max(startMin, dayStartMin);
  const b = Math.min(endMin, dayEndMin);
  if (a >= b) return null;
  return { a, b };
}
