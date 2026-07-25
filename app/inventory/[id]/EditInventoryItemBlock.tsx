"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_UNITS, parseAllowedStockUnit, STOCK_UNIT_LABEL_FR, type AllowedUnit } from "@/lib/constants";
import { updateInventoryItem } from "../actions";
import { uiBtnPrimarySm, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

const TYPE_OPTIONS = [
  { value: "ingredient", label: "Matière première" },
  { value: "prep", label: "Préparation" },
  { value: "resale", label: "Revente" },
] as const;

type Item = {
  id: string;
  name: string;
  unit: string;
  item_type: string;
  current_stock_qty: number;
  min_stock_qty?: number | null;
  reference_purchase_unit_cost_ht?: number | null;
  reference_purchase_is_benchmark?: boolean;
};

export function EditInventoryItemBlock({
  item,
  restaurantId,
  initialStockQty,
}: {
  item: Item;
  restaurantId: string;
  /** Stock calculé (mouvements) pour préremplir le champ ; doit refléter la cible métier. */
  initialStockQty: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState<AllowedUnit>(() => parseAllowedStockUnit(item.unit) ?? "unit");
  const [itemType, setItemType] = useState<"ingredient" | "prep" | "resale">(
    item.item_type === "prep" || item.item_type === "resale" ? item.item_type : "ingredient"
  );
  const [currentStockQty, setCurrentStockQty] = useState(String(initialStockQty));
  const [minStockQty, setMinStockQty] = useState(
    item.min_stock_qty != null ? String(item.min_stock_qty) : ""
  );
  const [referencePurchasePrice, setReferencePurchasePrice] = useState(
    item.reference_purchase_unit_cost_ht != null && Number(item.reference_purchase_unit_cost_ht) > 0
      ? String(item.reference_purchase_unit_cost_ht)
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = parseFloat(currentStockQty.replace(",", "."));
    const minQty = minStockQty.trim() === "" ? null : parseFloat(minStockQty.replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0) return;
    if (minQty !== null && (!Number.isFinite(minQty) || minQty < 0)) return;
    const refTrim = referencePurchasePrice.trim();
    const refParsed = refTrim === "" ? null : parseFloat(refTrim.replace(",", "."));
    if (refParsed !== null && (!Number.isFinite(refParsed) || refParsed < 0)) {
      setError("Prix d’achat de référence invalide (nombre ≥ 0 ou laissez vide).");
      return;
    }
    setLoading(true);
    const result = await updateInventoryItem({
      itemId: item.id,
      restaurantId,
      name: name.trim(),
      unit,
      itemType,
      currentStockQty: qty,
      minStockQty: minQty ?? undefined,
      referencePurchaseUnitCostHt: refParsed === null ? null : refParsed,
    });
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className={uiCard}>
      <h2 className="mb-3 text-sm font-semibold text-stone-900">Modifier le composant</h2>
      {item.reference_purchase_is_benchmark ? (
        <p className="mb-3 rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-2 text-xs text-violet-950">
          Le prix d&apos;achat de référence affiché provient de la{" "}
          <strong className="font-semibold">base indicative France</strong> (moyenne marché). Il sera remplacé dès
          qu&apos;un prix réel est saisi ici, à l&apos;onboarding ou via une réception (BL / facture).
        </p>
      ) : null}
      {error && (
        <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className={uiLabel}>Nom</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${uiInput} w-full min-w-0`} />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
            <span className={uiLabel}>Unité</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as AllowedUnit)}
              className={`${uiSelect} w-full min-w-0`}
            >
              {ALLOWED_UNITS.map((u) => (
                <option key={u} value={u}>
                  {STOCK_UNIT_LABEL_FR[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className={uiLabel}>Type</span>
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as "ingredient" | "prep" | "resale")}
              className={`${uiSelect} w-full min-w-0`}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className={uiLabel}>Stock (mouvements)</span>
            <input
              type="text"
              inputMode="decimal"
              value={currentStockQty}
              onChange={(e) => setCurrentStockQty(e.target.value)}
              className={`${uiInput} w-full min-w-0`}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className={uiLabel}>Seuil min (opt.)</span>
            <input
              type="text"
              inputMode="decimal"
              value={minStockQty}
              onChange={(e) => setMinStockQty(e.target.value)}
              placeholder="—"
              className={`${uiInput} w-full min-w-0`}
            />
          </label>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-1">
            <span className={uiLabel}>Prix achat réf. € HT / {unit}</span>
            <input
              type="text"
              inputMode="decimal"
              value={referencePurchasePrice}
              onChange={(e) => setReferencePurchasePrice(e.target.value)}
              placeholder="ex. 2,50"
              title="Utilisé à la réception si la facture ou le BL ne donne pas de coût, et après le dernier achat enregistré."
              className={`${uiInput} w-full min-w-0`}
            />
          </label>
        </div>

        <button type="submit" disabled={loading || !name.trim()} className={`${uiBtnPrimarySm} w-full sm:w-auto`}>
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
