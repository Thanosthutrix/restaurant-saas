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
import { isPostCategoriesOnboardingFlowActive } from "@/lib/onboardingPostCategoriesFlow";
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
import {
  applyOnboardingPurchasePrices,
  loadOnboardingBenchmarkSuggestionsAction,
  type OnboardingBenchmarkChoice,
} from "./actions";

type InventoryOption = { id: string; name: string; unit: string | null };

type EditablePrice = PendingOnboardingPurchasePriceSuggestion & {
  clientId: string;
  selected: boolean;
  inventory_item_id: string;
  create_inventory_item_name: string;
  reference_purchase_unit_cost_ht: number | null;
  unit_choice: AllowedUnit;
  /** Conditionnement côté facture (sac, carton…), comme au pointage BL. */
  purchase_unit_label: string;
  /** Nombre d’unités de stock pour 1 unité livrée facturée (saisie libre). */
  units_per_purchase_str: string;
  /** Ligne base France choisie (uniquement si création d’ingrédient) ; appliquée avant le prix facture côté serveur. */
  benchmark_product_id: string | null;
  benchmark_suggestions: OnboardingBenchmarkChoice[] | null;
  benchmark_load_error: string | null;
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
    purchase_unit_label: (item.unit ?? "").trim(),
    units_per_purchase_str: "",
    benchmark_product_id: null,
    benchmark_suggestions: null,
    benchmark_load_error: null,
  }));
}

function formatEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Affichage des très petits coûts (€/g, €/ml) sans tout arrondir à 0,00 €. */
function formatEurRefUnit(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function isNewIngredientRow(row: EditablePrice): boolean {
  return !row.inventory_item_id && row.create_inventory_item_name.trim().length > 0;
}

export function ReviewPurchasePricesClient({ inventory }: { inventory: InventoryOption[] }) {
  const router = useRouter();
  const initialItems = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_PURCHASE_PRICES_KEY) : null
  );
  const [missing] = useState(() => initialItems == null);
  const [rows, setRows] = useState<EditablePrice[]>(() => (initialItems ? toEditable(initialItems, inventory) : []));
  const [pending, setPending] = useState(false);
  const [benchmarkLoadingClientId, setBenchmarkLoadingClientId] = useState<string | null>(null);
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
    if (isPostCategoriesOnboardingFlowActive()) {
      router.push("/onboarding/upload-revenue-statements");
      return;
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
      purchase_unit: row.purchase_unit_label.trim() || null,
      units_per_purchase: (() => {
        const s = row.units_per_purchase_str.trim().replace(",", ".");
        if (!s) return null;
        const n = Number(s);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      benchmark_product_id: isNewIngredientRow(row) ? row.benchmark_product_id : null,
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
          Validez le prix HT par <strong>unité de stock</strong> (colonne unité). Si vous changez l’unité de stock (ex. g
          → kg), les quantités des <strong>recettes</strong> et le <strong>stock</strong> sont recalculés comme sur la
          fiche composant. Pour un conditionnement différent sur la facture (sac, carton…), renseignez la conversion
          comme au <strong>pointage BL</strong>. Pour chaque <strong>nouvel ingrédient</strong>, vous pouvez d’abord
          l’associer à une ligne de la <strong>base indicative France</strong> : le tarif facture remplace ensuite ce
          prix théorique comme référence réelle.
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
                      benchmark_product_id: null,
                      benchmark_suggestions: null,
                      benchmark_load_error: null,
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
                  onChange={(e) =>
                    updateRow(index, {
                      create_inventory_item_name: e.target.value,
                      inventory_item_id: "",
                      benchmark_product_id: null,
                      benchmark_suggestions: null,
                      benchmark_load_error: null,
                    })
                  }
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
                  onChange={(e) =>
                    updateRow(index, {
                      unit_choice: e.target.value as AllowedUnit,
                      benchmark_product_id: null,
                      benchmark_suggestions: null,
                      benchmark_load_error: null,
                    })
                  }
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

            {isNewIngredientRow(row) ? (
              <div className="space-y-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5">
                <p className="text-xs font-semibold text-emerald-950">Base indicative France (optionnel)</p>
                <p className="text-[11px] leading-snug text-emerald-900/95">
                  Associez « {row.create_inventory_item_name.trim() || "…"} » à une ligne du référentiel. La{" "}
                  <strong>moyenne du fichier</strong> (ex. €/kg) s’affiche en premier ; le second montant est le même
                  prix <strong>converti</strong> pour votre unité de stock. À l’application, le tarif facture remplace la
                  référence.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      benchmarkLoadingClientId === row.clientId || !row.create_inventory_item_name.trim()
                    }
                    onClick={() => {
                      void (async () => {
                        setBenchmarkLoadingClientId(row.clientId);
                        const res = await loadOnboardingBenchmarkSuggestionsAction({
                          name: row.create_inventory_item_name.trim(),
                          unit: row.unit_choice,
                        });
                        setBenchmarkLoadingClientId(null);
                        if (res.ok) {
                          updateRow(index, {
                            benchmark_suggestions: res.data,
                            benchmark_load_error: null,
                            benchmark_product_id: null,
                          });
                        } else {
                          updateRow(index, {
                            benchmark_suggestions: null,
                            benchmark_load_error: res.error,
                            benchmark_product_id: null,
                          });
                        }
                      })();
                    }}
                    className={uiBtnOutlineSm}
                  >
                    {benchmarkLoadingClientId === row.clientId ? "Chargement…" : "Voir les propositions"}
                  </button>
                  {row.benchmark_product_id ? (
                    <button
                      type="button"
                      onClick={() => updateRow(index, { benchmark_product_id: null })}
                      className={`text-xs ${uiMuted} underline`}
                    >
                      Retirer l’association
                    </button>
                  ) : null}
                </div>
                {row.benchmark_load_error ? <p className={`text-xs ${uiError}`}>{row.benchmark_load_error}</p> : null}
                {row.benchmark_suggestions && row.benchmark_suggestions.length === 0 ? (
                  <p className={`text-xs ${uiMuted}`}>
                    Aucune ligne assez proche pour ce nom avec l’unité « {STOCK_UNIT_LABEL_FR[row.unit_choice]} ». Essayez
                    g, kg, ml ou L, ou rapprochez le libellé du catalogue.
                  </p>
                ) : null}
                {row.benchmark_suggestions && row.benchmark_suggestions.length > 0 ? (
                  <ul className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
                    {row.benchmark_suggestions.map((c) => {
                      const selected = row.benchmark_product_id === c.benchmarkProductId;
                      return (
                        <li key={c.benchmarkProductId}>
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(index, {
                                benchmark_product_id: selected ? null : c.benchmarkProductId,
                              })
                            }
                            className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                              selected
                                ? "border-emerald-600 bg-emerald-100/90 text-emerald-950"
                                : "border-emerald-100 bg-white/90 text-slate-800 hover:border-emerald-300"
                            }`}
                          >
                            <span className="font-medium">{c.produitLabel}</span>
                            <span className="text-slate-500"> — {c.famille}</span>
                            <span className="block text-[11px] text-slate-600">
                              Moyenne base : {formatEur(c.catalogMeanEuroHt)} HT / {c.catalogNormalizedUnit}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Pour votre unité de stock ({STOCK_UNIT_LABEL_FR[row.unit_choice]}) : {formatEurRefUnit(c.price)} HT
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
              <p className="text-xs font-semibold text-indigo-950">Facture : unité de conditionnement → stock</p>
              <p className="text-[11px] leading-snug text-indigo-900/95">
                Même principe que la réception : combien d’unités de stock (
                <strong>{STOCK_UNIT_LABEL_FR[row.unit_choice]}</strong>) correspondent à <strong>1 unité livrée</strong>{" "}
                telle qu’à la facture (ex. 1 sac = 20&nbsp;000 si le stock est en g pour un sac de 20&nbsp;kg). Laisser le
                nombre vide = 1 unité facture = 1 unité de stock.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-indigo-900">Libellé unité facture / colis</span>
                  <input
                    value={row.purchase_unit_label}
                    onChange={(e) => updateRow(index, { purchase_unit_label: e.target.value })}
                    className={`w-full ${uiInput} text-sm`}
                    placeholder="ex. colis, sac, kg facturé…"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-indigo-900">
                    1 unité livrée = combien de {STOCK_UNIT_LABEL_FR[row.unit_choice]} ?
                  </span>
                  <input
                    value={row.units_per_purchase_str}
                    onChange={(e) => updateRow(index, { units_per_purchase_str: e.target.value })}
                    inputMode="decimal"
                    className={`w-full ${uiInput} text-sm`}
                    placeholder="ex. 20000 (sac 20 kg, stock en g)"
                  />
                </label>
              </div>
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
