"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateInventoryItemSupplier } from "../actions";
import { uiBtnPrimarySm, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type ItemSupplier = {
  id: string;
  unit: string;
  supplier_id?: string | null;
  supplier_sku?: string | null;
  purchase_unit?: string | null;
  units_per_purchase?: number | null;
  min_order_quantity?: number | null;
  order_multiple?: number | null;
  target_stock_qty?: number | null;
};

type SupplierOption = { id: string; name: string };

export function InventoryItemSupplierBlock({
  item,
  suppliers,
  restaurantId,
}: {
  item: ItemSupplier;
  suppliers: SupplierOption[];
  restaurantId: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(item.supplier_id ?? "");
  const [supplierSku, setSupplierSku] = useState(item.supplier_sku ?? "");
  const [purchaseUnit, setPurchaseUnit] = useState(item.purchase_unit ?? "");
  const [unitsPerPurchase, setUnitsPerPurchase] = useState(
    item.units_per_purchase != null ? String(item.units_per_purchase) : ""
  );
  const [minOrderQuantity, setMinOrderQuantity] = useState(
    item.min_order_quantity != null ? String(item.min_order_quantity) : ""
  );
  const [orderMultiple, setOrderMultiple] = useState(
    item.order_multiple != null ? String(item.order_multiple) : ""
  );
  const [targetStockQty, setTargetStockQty] = useState(
    item.target_stock_qty != null ? String(item.target_stock_qty) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const up = unitsPerPurchase.trim() === "" ? null : parseFloat(unitsPerPurchase.replace(",", "."));
    const minO = minOrderQuantity.trim() === "" ? null : parseFloat(minOrderQuantity.replace(",", "."));
    const mult = orderMultiple.trim() === "" ? null : parseFloat(orderMultiple.replace(",", "."));
    const target = targetStockQty.trim() === "" ? null : parseFloat(targetStockQty.replace(",", "."));
    if (up !== null && (!Number.isFinite(up) || up <= 0)) return;
    if (minO !== null && (!Number.isFinite(minO) || minO < 0)) return;
    if (mult !== null && (!Number.isFinite(mult) || mult <= 0)) return;
    if (target !== null && (!Number.isFinite(target) || target < 0)) return;
    setLoading(true);
    const result = await updateInventoryItemSupplier({
      itemId: item.id,
      restaurantId,
      supplierId: supplierId || null,
      supplierSku: supplierSku.trim() || null,
      purchaseUnit: purchaseUnit.trim() || null,
      unitsPerPurchase: up ?? undefined,
      minOrderQuantity: minO ?? undefined,
      orderMultiple: mult ?? undefined,
      targetStockQty: target ?? undefined,
    });
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  const stockUnitLabel = item.unit || "unité de stock";

  return (
    <div className={uiCard}>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Achat / Fournisseur</h2>
      <p className="mb-3 text-xs text-slate-500">
        Unité de stock : <strong className="text-slate-800">{stockUnitLabel}</strong>
      </p>
      {error && (
        <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Fournisseur principal</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={`min-w-[180px] ${uiSelect}`}
            >
              <option value="">— Aucun —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Réf. fournisseur</span>
            <input
              type="text"
              value={supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
              placeholder="ex. REF-123"
              className={`w-36 ${uiInput}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Unité d’achat fournisseur</span>
            <input
              type="text"
              value={purchaseUnit}
              onChange={(e) => setPurchaseUnit(e.target.value)}
              placeholder="ex. kg, L, carton, pack"
              className={`w-36 ${uiInput}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>1 unité achetée = combien de {stockUnitLabel} ?</span>
            <input
              type="text"
              inputMode="decimal"
              value={unitsPerPurchase}
              onChange={(e) => setUnitsPerPurchase(e.target.value)}
              placeholder="ex. 1000 (kg→g), 1 (L→L), 6 (pack→unité)"
              className={`w-44 ${uiInput}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Qté min. commande (en unité d’achat)</span>
            <input
              type="text"
              inputMode="decimal"
              value={minOrderQuantity}
              onChange={(e) => setMinOrderQuantity(e.target.value)}
              placeholder="—"
              className={`w-24 ${uiInput}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Multiple de commande (en unité d’achat)</span>
            <input
              type="text"
              inputMode="decimal"
              value={orderMultiple}
              onChange={(e) => setOrderMultiple(e.target.value)}
              placeholder="—"
              className={`w-24 ${uiInput}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Stock cible (en {stockUnitLabel})</span>
            <input
              type="text"
              inputMode="decimal"
              value={targetStockQty}
              onChange={(e) => setTargetStockQty(e.target.value)}
              placeholder="—"
              className={`w-24 ${uiInput}`}
            />
          </label>
        </div>
        <button type="submit" disabled={loading} className={uiBtnPrimarySm}>
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
