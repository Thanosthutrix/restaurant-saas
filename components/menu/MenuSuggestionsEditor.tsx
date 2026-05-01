"use client";

import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import { FRENCH_SELLING_VAT_PRESETS, sellingPriceHtFromTtc } from "@/lib/tax/frenchSellingVat";
import {
  uiBtnOutlineSm,
  uiBtnPrimary,
  uiCard,
  uiError,
  uiInput,
  uiMuted,
  uiSectionTitleSm,
  uiSelect,
  uiSuccess,
} from "@/components/ui/premium";

function newClientRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export type MenuSuggestionRow = MenuSuggestionItem & {
  /** Clé React stable (ajout / duplication / suppression de lignes). */
  clientRowId: string;
  selected: boolean;
  create_draft_recipe: boolean;
};

/** Ligne vide pour un plat saisi manuellement (oubli de l’analyse). */
export function emptyMenuSuggestionRow(): MenuSuggestionRow {
  return {
    clientRowId: newClientRowId(),
    raw_label: "",
    normalized_label: "",
    suggested_mode: "prepared",
    selling_vat_rate_pct: 10,
    suggested_ingredients: [],
    selected: true,
    create_draft_recipe: false,
  };
}

/** Copie la ligne (ex. même base, autre goût / variante) — à renommer ensuite. */
export function duplicateMenuSuggestionRow(row: MenuSuggestionRow): MenuSuggestionRow {
  return {
    ...row,
    clientRowId: newClientRowId(),
    suggested_ingredients: [...(row.suggested_ingredients ?? [])],
    create_draft_recipe: false,
  };
}

export function menuItemsToEditableRows(items: MenuSuggestionItem[]): MenuSuggestionRow[] {
  return (Array.isArray(items) ? items : []).map((s) => {
    const mode = s.suggested_mode;
    const ttc = s.selling_price_ttc ?? s.selling_price_ht;
    const vat = s.selling_vat_rate_pct ?? (mode === "resale" ? 20 : 10);
    return {
      ...s,
      selling_price_ttc: ttc ?? undefined,
      selling_vat_rate_pct: vat,
      selling_price_ht: undefined,
      clientRowId: newClientRowId(),
      suggested_ingredients: Array.isArray(s.suggested_ingredients) ? s.suggested_ingredients : [],
      selected: s.suggested_mode !== "ignore",
      create_draft_recipe: false,
    };
  });
}

const checkboxClass =
  "h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 accent-indigo-600 focus:ring-indigo-500";

type CreateResult = {
  created: number;
  updated: number;
  skipped: number;
  draftRecipes: number;
  errors: string[];
};

type Props = {
  suggestions: MenuSuggestionRow[];
  setSuggestions: React.Dispatch<React.SetStateAction<MenuSuggestionRow[]>>;
  onCreate: () => void | Promise<void>;
  createPending: boolean;
  createResult: CreateResult | null;
  error: string | null;
  /** Libellé du bouton de création (ex. inclure « et ouvrir le tableau de bord »). */
  createButtonLabel?: string;
  /** Sous-titre sous le titre des suggestions */
  description?: string;
  /** Si true, le bouton reste actif même sans plat coché (ex. « Ouvrir le tableau de bord »). */
  allowProceedWithNone?: boolean;
};

export function MenuSuggestionsEditor({
  suggestions,
  setSuggestions,
  onCreate,
  createPending,
  createResult,
  error,
  createButtonLabel,
  description,
  allowProceedWithNone = false,
}: Props) {
  const setRowSelected = (index: number, selected: boolean) => {
    setSuggestions((prev) => prev.map((row, i) => (i === index ? { ...row, selected } : row)));
  };

  const setRowRawLabel = (index: number, raw_label: string) => {
    setSuggestions((prev) => prev.map((row, i) => (i === index ? { ...row, raw_label } : row)));
  };

  const setRowSuggestedCategory = (index: number, suggested_category: string) => {
    setSuggestions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, suggested_category } : row))
    );
  };

  const setRowSellingPriceTtc = (index: number, value: string) => {
    setSuggestions((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (value.trim() === "") return { ...row, selling_price_ttc: undefined };
        const n = parseFloat(value.replace(",", "."));
        return {
          ...row,
          selling_price_ttc: Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined,
        };
      })
    );
  };

  const setRowVatPct = (index: number, value: string) => {
    const n = parseFloat(value.replace(",", "."));
    setSuggestions((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const fallback = row.suggested_mode === "resale" ? 20 : 10;
        const vat =
          Number.isFinite(n) && n >= 0 && n <= 100 ? n : (row.selling_vat_rate_pct ?? fallback);
        return { ...row, selling_vat_rate_pct: vat };
      })
    );
  };

  const setRowMode = (index: number, suggested_mode: "prepared" | "resale" | "ignore") => {
    setSuggestions((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        let selling_vat_rate_pct = row.selling_vat_rate_pct ?? (row.suggested_mode === "resale" ? 20 : 10);
        if (suggested_mode === "resale" && row.suggested_mode !== "resale") selling_vat_rate_pct = 20;
        if (suggested_mode === "prepared" && row.suggested_mode === "resale") selling_vat_rate_pct = 10;
        return {
          ...row,
          suggested_mode,
          selling_vat_rate_pct,
          create_draft_recipe: false,
        };
      })
    );
  };

  const addEmptyRow = () => {
    setSuggestions((prev) => [...prev, emptyMenuSuggestionRow()]);
  };

  const duplicateRowAt = (index: number) => {
    setSuggestions((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const copy = duplicateMenuSuggestionRow(row);
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removeRowAt = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const isActionable = (s: MenuSuggestionRow) =>
    s.selected && s.suggested_mode !== "ignore" && s.raw_label.trim().length > 0;

  const toCreate = suggestions.filter(isActionable).length;

  return (
    <>
      {error && <div className={uiError}>{error}</div>}

      {createResult && (
        <div className={uiSuccess}>
          {createResult.created > 0 && <p>{createResult.created} plat(s) créé(s).</p>}
          {createResult.updated > 0 && <p>{createResult.updated} plat(s) mis à jour.</p>}
          {createResult.skipped > 0 && <p>{createResult.skipped} ligne(s) sans changement.</p>}
          {createResult.errors.length > 0 && (
            <p className="mt-2 font-medium text-amber-800">Erreurs : {createResult.errors.join(" ; ")}</p>
          )}
        </div>
      )}

      <div className={uiCard}>
        <h2 className={`mb-1 ${uiSectionTitleSm}`}>Suggestions ({suggestions.length})</h2>
        <p className={`mb-3 ${uiMuted}`}>
          {description ??
            "Cochez les plats à créer ou mettre à jour, corrigez la rubrique, le mode, le prix TTC (carte client) et la TVA si besoin. Les recettes se gèrent uniquement dans l’étape dédiée aux recettes."}
        </p>
        <div className="mb-4">
          <button type="button" onClick={addEmptyRow} className={uiBtnOutlineSm}>
            + Plat oublié par l’analyse
          </button>
        </div>
        {suggestions.length === 0 ? (
          <p className={`mb-4 ${uiMuted}`}>
            Aucune ligne pour l’instant. Utilisez le bouton ci-dessus pour saisir un plat à la main.
          </p>
        ) : (
          <div className="space-y-4">
            {suggestions.map((row, i) => (
              <div key={row.clientRowId} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => setRowSelected(i, e.target.checked)}
                    disabled={row.suggested_mode === "ignore"}
                    className={checkboxClass}
                  />
                  <input
                    type="text"
                    value={row.raw_label}
                    onChange={(e) => setRowRawLabel(i, e.target.value)}
                    className={`min-w-[120px] flex-1 ${uiInput}`}
                    placeholder="Nom du plat"
                  />
                  <label className={`flex min-w-[9rem] flex-col gap-0.5 ${uiMuted}`}>
                    <span className="whitespace-nowrap text-xs">Rubrique IA</span>
                    <input
                      type="text"
                      value={row.suggested_category ?? ""}
                      onChange={(e) => setRowSuggestedCategory(i, e.target.value)}
                      className={`${uiInput} py-1.5 text-sm`}
                      placeholder="ex. Pizzas"
                    />
                  </label>
                  <label className={`flex flex-col gap-0.5 ${uiMuted}`}>
                    <span className="whitespace-nowrap text-xs">PV TTC €</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={
                        row.selling_price_ttc != null && Number.isFinite(row.selling_price_ttc)
                          ? row.selling_price_ttc
                          : ""
                      }
                      onChange={(e) => setRowSellingPriceTtc(i, e.target.value)}
                      className={`w-24 ${uiInput} py-1.5 text-sm`}
                      placeholder="—"
                    />
                  </label>
                  <label className={`flex flex-col gap-0.5 ${uiMuted}`}>
                    <span className="whitespace-nowrap text-xs">TVA</span>
                    <select
                      value={String(
                        row.selling_vat_rate_pct ?? (row.suggested_mode === "resale" ? 20 : 10)
                      )}
                      onChange={(e) => setRowVatPct(i, e.target.value)}
                      className={`min-w-[7rem] ${uiSelect} py-1.5 text-sm`}
                    >
                      {(() => {
                        const v =
                          row.selling_vat_rate_pct ?? (row.suggested_mode === "resale" ? 20 : 10);
                        const presetSet = new Set(FRENCH_SELLING_VAT_PRESETS.map((p) => p.ratePct));
                        return (
                          <>
                            {!presetSet.has(v) && (
                              <option value={String(v)}>{v} %</option>
                            )}
                            {FRENCH_SELLING_VAT_PRESETS.map((p) => (
                              <option key={p.ratePct} value={String(p.ratePct)}>
                                {p.label}
                              </option>
                            ))}
                          </>
                        );
                      })()}
                    </select>
                  </label>
                  {row.selling_price_ttc != null &&
                    row.selling_price_ttc > 0 &&
                    (() => {
                      const v = row.selling_vat_rate_pct ?? (row.suggested_mode === "resale" ? 20 : 10);
                      const ht = sellingPriceHtFromTtc(row.selling_price_ttc, v);
                      return (
                        <span className="self-end text-[11px] text-slate-500">
                          ≈ {ht.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT
                        </span>
                      );
                    })()}
                  <select
                    value={row.suggested_mode}
                    onChange={(e) => setRowMode(i, e.target.value as "prepared" | "resale" | "ignore")}
                    className={`${uiSelect} text-sm`}
                  >
                    <option value="prepared">Préparé</option>
                    <option value="resale">Revente</option>
                    <option value="ignore">Ignorer</option>
                  </select>
                  <div className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto">
                    <button type="button" onClick={() => duplicateRowAt(i)} className={uiBtnOutlineSm}>
                      Dupliquer
                    </button>
                    <button type="button" onClick={() => removeRowAt(i)} className={uiBtnOutlineSm}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={createPending || (toCreate === 0 && !allowProceedWithNone)}
            className={uiBtnPrimary}
          >
            {createPending
              ? "Création…"
              : (createButtonLabel ?? `Créer / mettre à jour ${toCreate} plat(s)`)}
          </button>
        </div>
      </div>
    </>
  );
}
