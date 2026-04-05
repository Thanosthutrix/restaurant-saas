export type DiningDiscountKind = "none" | "percent" | "amount" | "free";

export function parseDiningDiscountKind(raw: unknown): DiningDiscountKind {
  if (raw === "percent" || raw === "amount" || raw === "free") return raw;
  return "none";
}

export function lineGrossFromUnit(qty: number, unitTtc: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!Number.isFinite(unitTtc) || unitTtc <= 0) return 0;
  return Math.round(qty * unitTtc * 100) / 100;
}

/** TTC ligne après remise (unité TTC × qté puis remise). */
export function lineNetAfterDiscount(
  gross: number,
  kind: DiningDiscountKind,
  discountValue: number | null
): number {
  if (gross <= 0) return 0;
  if (kind === "none") return gross;
  if (kind === "free") return 0;
  if (kind === "percent") {
    const p = discountValue ?? 0;
    if (!Number.isFinite(p) || p <= 0) return gross;
    const pct = Math.min(100, p);
    return Math.round(gross * (1 - pct / 100) * 100) / 100;
  }
  if (kind === "amount") {
    const amt = discountValue ?? 0;
    if (!Number.isFinite(amt) || amt <= 0) return gross;
    return Math.max(0, Math.round((gross - amt) * 100) / 100);
  }
  return gross;
}
