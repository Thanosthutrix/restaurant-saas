"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOWED_UNITS,
  parseAllowedStockUnit,
  STOCK_UNIT_LABEL_FR,
  type AllowedUnit,
} from "@/lib/constants";
import {
  PENDING_ONBOARDING_PURCHASE_PRICES_KEY,
  type PendingOnboardingPurchasePricesStored,
  type PendingOnboardingPurchasePriceSuggestion,
} from "@/lib/onboardingPendingMenuStorage";
import {
  uiBtnOutlineSm,
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInput,
  uiMuted,
  uiSectionTitleSm,
  uiSelect,
  uiSuccess,
} from "@/components/ui/premium";
import { applyOnboardingPurchasePrices } from "./actions";

type InventoryOption = { id: string; name: string; unit: string | null };

type EditablePrice = PendingOnboardingPurchasePriceSuggestion & {
  clientId: string;
  selected: boolean;
  inventory_item_id: string;
  create_inventory_item_name: string;
  reference_purchase_unit_cost_ht: number | null;
  unit_choice: AllowedUnit;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `price_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStored(raw: string | null): PendingOnboardingPurchasePriceSuggestion[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingOnboardingPurchasePricesStored;
    if (data?.v !== 1 || !Array.isArray(data.items)) return null;
    return data.items;
  } catch {
    return null;
  }
}

function priceFromSuggestion(item: PendingOnboardingPurchasePriceSuggestion): number | null {
  if (item.unit_price_ht != null && Number.isFinite(item.unit_price_ht) && item.unit_price_ht > 0) {
    return item.unit_price_ht;
  }
  if (
    item.line_total_ht != null &&
    item.quantity != null &&
    Number.isFinite(item.line_total_ht) &&
    Number.isFinite(item.quantity) &&
    item.line_total_ht > 0 &&
    item.quantity > 0
  ) {
    return Math.round((item.line_total_ht / item.quantity) * 1_000_000) / 1_000_000;
  }
  return null;
}

function toEditable(items: PendingOnboardingPurchasePriceSuggestion[], inventory: InventoryOption[]): EditablePrice[] {
  const unitByItemId = new Map(inventory.map((item) => [item.id, parseAllowedStockUnit(item.unit ?? "") ?? "unit"]));
  return items.map((item) => ({
    ...item,
    clientId: newClientId(),
    selected: priceFromSuggestion(item) != null,
    inventory_item_id: item.suggested_inventory_item_id ?? "",
    create_inventory_item_name: item.suggested_inventory_item_id ? "" : item.label,
    reference_purchase_unit_cost_ht: priceFromSuggestion(item),
    unit_choice:
      (item.suggested_inventory_item_id ? unitByItemId.get(item.suggested_inventory_item_id) : null) ??
      parseAllowedStockUnit(item.unit ?? "") ??
      "unit",
  }));
}

export function ReviewPurchasePricesClient({ inventory }: { inventory: InventoryOption[] }) {
  const router = useRouter();
  const initialItems = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_PURCHASE_PRICES_KEY) : null
  );
  const [missing] = useState(() => initialItems == null);
  const [rows, setRows] = useState<EditablePrice[]>(() => (initialItems ? toEditable(initialItems, inventory) : []));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; created: number; skipped: number; errors: string[] } | null>(
    null
  );

  function finish() {
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_PURCHASE_PRICES_KEY);
    } catch {
      /* ignore */
    }
    router.push("/dashboard");
    router.refresh();
  }

  function updateRow(index: number, patch: Partial<EditablePrice>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function applyPrices() {
    const payload = rows.map((row) => ({
      selected: row.selected,
      label: row.label,
      inventory_item_id: row.inventory_item_id || null,
      create_inventory_item_name: row.create_inventory_item_name || null,
      unit: row.unit_choice,
      reference_purchase_unit_cost_ht: row.reference_purchase_unit_cost_ht,
      supplier_id: row.supplier_id,
    }));
    setPending(true);
    setError(null);
    setResult(null);
    const res = await applyOnboardingPurchasePrices(payload);
    setPending(false);
    if (!res.ok && res.updated === 0) {
      setError(res.errors.join(" ") || "Impossible d’appliquer les tarifs.");
      return;
    }
    setResult({ updated: res.updated, created: res.created, skipped: res.skipped, errors: res.errors });
    finish();
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">Aucun tarif détecté à valider.</p>
        <button type="button" onClick={finish} className={uiBtnPrimaryBlock}>
          Ouvrir le tableau de bord
        </button>
      </div>
    );
  }

  const selectedCount = rows.filter((row) => row.selected && row.reference_purchase_unit_cost_ht != null).length;

  return (
    <div className="space-y-6">
      {error ? <div className={uiError}>{error}</div> : null}
      {result ? (
        <div className={uiSuccess}>
          {result.updated} tarif(s) appliqué(s), {result.created} ingrédient(s) créé(s).
          {result.errors.length > 0 ? <p className="mt-2">Points à revoir : {result.errors.join(" ; ")}</p> : null}
        </div>
      ) : null}

      <div>
        <h2 className={uiSectionTitleSm}>Tarifs détectés ({rows.length})</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Validez le prix HT par unité de stock. Il alimentera le prix d’achat de référence des ingrédients pour calculer
          les coûts recettes et les marges.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.clientId} className={`${uiCard} space-y-3`}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(index, { selected: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Valider
              </label>
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                <p className="text-xs text-slate-500">
                  Facture : {row.quantity ?? "—"} {row.unit ?? ""} · PU {row.unit_price_ht ?? "—"} € · ligne{" "}
                  {row.line_total_ht ?? "—"} €
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_8rem_8rem_auto] md:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Ingrédient existant</span>
                <select
                  value={row.inventory_item_id}
                  onChange={(e) =>
                    updateRow(index, {
                      inventory_item_id: e.target.value,
                      create_inventory_item_name: "",
                      unit_choice:
                        parseAllowedStockUnit(inventory.find((item) => item.id === e.target.value)?.unit ?? "") ??
                        row.unit_choice,
                    })
                  }
                  className={`w-full ${uiSelect}`}
                >
                  <option value="">Créer / choisir plus tard…</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Ou créer l’ingrédient</span>
                <input
                  value={row.create_inventory_item_name}
                  onChange={(e) => updateRow(index, { create_inventory_item_name: e.target.value, inventory_item_id: "" })}
                  className={`w-full ${uiInput}`}
                  placeholder="Nom ingrédient"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Prix HT/unité</span>
                <input
                  type="number"
                  min={0}
                  step="0.000001"
                  value={row.reference_purchase_unit_cost_ht ?? ""}
                  onChange={(e) =>
                    updateRow(index, {
                      reference_purchase_unit_cost_ht: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={`w-full ${uiInput}`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Unité stock</span>
                <select
                  value={row.unit_choice}
                  onChange={(e) => updateRow(index, { unit_choice: e.target.value as AllowedUnit })}
                  className={`w-full ${uiSelect}`}
                >
                  {ALLOWED_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {STOCK_UNIT_LABEL_FR[unit]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} className={uiBtnOutlineSm}>
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void applyPrices()}
        disabled={pending || selectedCount === 0}
        className={uiBtnPrimaryBlock}
      >
        {pending ? "Application des tarifs…" : `Appliquer ${selectedCount} tarif(s)`}
      </button>
      <button type="button" onClick={finish} className={uiBtnSecondary}>
        Passer les tarifs pour l’instant
      </button>
    </div>
  );
}
