import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";
import { lineNetAfterDiscount } from "@/lib/dining/lineDiscount";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function orderTotalFromLines(lines: DiningLineClient[]): number {
  let s = 0;
  for (const l of lines) s += l.lineTotalTtc;
  return round2(s);
}

export function optimisticAddDishLine(
  lines: DiningLineClient[],
  dish: { id: string; name: string; selling_price_ttc?: number | string | null }
): DiningLineClient[] {
  const unit = Number(dish.selling_price_ttc);
  const unitTtc = Number.isFinite(unit) && unit > 0 ? unit : 0;
  const existing = lines.find((l) => l.dishId === dish.id);

  if (existing) {
    const qty = existing.qty + 1;
    const gross = round2(qty * unitTtc);
    const lineTotalTtc = lineNetAfterDiscount(gross, existing.discountKind, existing.discountValue);
    return lines.map((l) =>
      l.id === existing.id
        ? { ...l, qty, lineGrossTtc: gross, lineTotalTtc, isPrepared: false }
        : l
    );
  }

  const gross = round2(unitTtc);
  return [
    ...lines,
    {
      id: `opt-${dish.id}-${Date.now()}`,
      dishId: dish.id,
      dishName: dish.name,
      qty: 1,
      isPrepared: false,
      lineGrossTtc: gross,
      lineTotalTtc: gross,
      discountKind: "none" as DiningDiscountKind,
      discountValue: null,
    },
  ];
}

export function optimisticLineQty(
  lines: DiningLineClient[],
  lineId: string,
  qty: number
): DiningLineClient[] {
  return lines.map((l) => {
    if (l.id !== lineId) return l;
    const unit = l.qty > 0 ? l.lineGrossTtc / l.qty : 0;
    const gross = round2(unit * qty);
    const lineTotalTtc = lineNetAfterDiscount(gross, l.discountKind, l.discountValue);
    return {
      ...l,
      qty,
      lineGrossTtc: gross,
      lineTotalTtc,
      isPrepared: Math.abs(l.qty - qty) > 1e-9 ? false : l.isPrepared,
    };
  });
}

export function optimisticRemoveLine(lines: DiningLineClient[], lineId: string): DiningLineClient[] {
  return lines.filter((l) => l.id !== lineId);
}

export function optimisticLinePrepared(
  lines: DiningLineClient[],
  lineId: string,
  isPrepared: boolean
): DiningLineClient[] {
  return lines.map((l) => (l.id === lineId ? { ...l, isPrepared } : l));
}
