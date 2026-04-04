/**
 * Moteur de suggestions de commande fournisseur.
 * Regroupe par fournisseur les composants dont le stock est sous le seuil (ou sous stock cible).
 */

import type { InventoryItem, InventoryItemWithCalculatedStock, Supplier } from "@/lib/db";

export type SuggestedLine = {
  inventory_item_id: string;
  name: string;
  /** Unité de stock (ex: g, kg, ml, l, unit). */
  unit: string;
  purchase_unit: string | null;
  supplier_sku: string | null;
  current_stock_qty: number;
  min_stock_qty: number | null;
  target_stock_qty: number | null;
  /** Besoin calculé en unité de stock (target - current). */
  need_stock_qty: number;
  /** Quantité suggérée en unité d'achat (purchase_unit). */
  suggested_quantity_purchase: number;
  /** Équivalent en unité de stock (suggested_quantity_purchase * ratio). */
  suggested_quantity_stock: number;
};

export type SupplierSuggestion = {
  supplier: Supplier;
  lines: SuggestedLine[];
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/** Stock utilisé pour les besoins d’achat : somme des mouvements si connue, sinon fiche. */
function effectiveStockForOrders(item: InventoryItemWithCalculatedStock): number {
  const m = item.stock_qty_from_movements;
  if (m != null && Number.isFinite(Number(m))) return Number(m);
  return Number(item.current_stock_qty) ?? 0;
}

/** Retourne true si aujourd'hui est un jour de commande pour le fournisseur. */
export function isOrderDayToday(supplier: Supplier): boolean {
  const today = DAY_NAMES[new Date().getDay()];
  return (supplier.order_days ?? []).some((d) => d?.toLowerCase() === today);
}

/**
 * Calcule la quantité à commander en unité d'achat pour atteindre le stock cible.
 * - Besoin en unité de stock = target - current
 * - Conversion : quantité achat = besoin_stock / purchase_to_stock_ratio (arrondi supérieur)
 * - Puis application de min_order_quantity et order_multiple (en unité d'achat).
 * Retourne null si la conversion (units_per_purchase) n'est pas renseignée ou invalide.
 */
function suggestPurchaseQuantity(
  item: InventoryItem,
  effectiveCurrentStock: number
): { needStock: number; qtyPurchase: number; qtyStock: number } | null {
  const ratio = item.units_per_purchase != null ? Number(item.units_per_purchase) : null;
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null;

  const current = effectiveCurrentStock;
  const target =
    item.target_stock_qty != null
      ? Number(item.target_stock_qty)
      : item.min_stock_qty != null
        ? Number(item.min_stock_qty) * 1.5
        : null;
  const minStock = item.min_stock_qty != null ? Number(item.min_stock_qty) : 0;

  if (target == null || target <= current) return null;
  if (current >= minStock && target <= current) return null;
  const needStock = Math.max(0, target - current);

  const minOrder = Number(item.min_order_quantity) || 1;
  const multiple = Number(item.order_multiple) || 1;

  let qtyPurchase = Math.ceil(needStock / ratio);
  if (qtyPurchase < minOrder) qtyPurchase = minOrder;
  if (multiple > 0) qtyPurchase = Math.ceil(qtyPurchase / multiple) * multiple;

  const qtyStock = qtyPurchase * ratio;
  return { needStock, qtyPurchase, qtyStock };
}

/**
 * Pour chaque composant sous le seuil (ou sans seuil mais avec fournisseur),
 * calcule une suggestion et regroupe par fournisseur.
 */
export function computeOrderSuggestions(
  items: InventoryItemWithCalculatedStock[],
  suppliers: Supplier[]
): SupplierSuggestion[] {
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const bySupplier = new Map<string, SuggestedLine[]>();

  for (const item of items) {
    if (!item.supplier_id) continue;
    const supplier = supplierById.get(item.supplier_id);
    if (!supplier?.is_active) continue;

    const minStock = item.min_stock_qty != null ? Number(item.min_stock_qty) : null;
    const current = effectiveStockForOrders(item);
    const underMin = minStock != null && current < minStock;
    const target = item.target_stock_qty != null ? Number(item.target_stock_qty) : minStock != null ? minStock * 2 : null;
    if (target == null && !underMin) continue;
    if (target != null && current >= target) continue;

    const itemWithTarget =
      target != null
        ? { ...item, target_stock_qty: target }
        : { ...item, target_stock_qty: minStock != null ? minStock * 2 : undefined };
    const qty = suggestPurchaseQuantity(itemWithTarget, current);
    if (!qty) continue;

    const line: SuggestedLine = {
      inventory_item_id: item.id,
      name: item.name,
      unit: item.unit,
      purchase_unit: item.purchase_unit ?? null,
      supplier_sku: item.supplier_sku ?? null,
      current_stock_qty: current,
      min_stock_qty: item.min_stock_qty ?? null,
      target_stock_qty: item.target_stock_qty ?? null,
      need_stock_qty: qty.needStock,
      suggested_quantity_purchase: qty.qtyPurchase,
      suggested_quantity_stock: qty.qtyStock,
    };

    const list = bySupplier.get(item.supplier_id) ?? [];
    list.push(line);
    bySupplier.set(item.supplier_id, list);
  }

  return suppliers
    .filter((s) => bySupplier.has(s.id))
    .map((s) => ({ supplier: s, lines: bySupplier.get(s.id)! }));
}
