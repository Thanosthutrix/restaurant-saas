"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import {
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  PENDING_ONBOARDING_INGREDIENT_CATEGORIES_KEY,
  type PendingOnboardingIngredientCategoriesStored,
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
  uiSuccess,
} from "@/components/ui/premium";
import {
  applyOnboardingIngredientCategoryAssignments,
  type IngredientCategoryAssignmentPayload,
} from "./actions";

type EditableAssignment = {
  clientId: string;
  selected: boolean;
  ingredient_name: string;
  normalized_label: string;
  suggested_category: string;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ingcat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStored(raw: string | null): EditableAssignment[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingOnboardingIngredientCategoriesStored;
    if (data?.v !== 1 || !Array.isArray(data.assignments)) return null;
    const seen = new Set<string>();
    return data.assignments
      .map((assignment) => {
        const ingredientName =
          typeof assignment.ingredient_name === "string" ? assignment.ingredient_name.trim() : "";
        const category =
          typeof assignment.suggested_category === "string"
            ? assignment.suggested_category.trim().replace(/\s+/g, " ")
            : "";
        const normalized =
          typeof assignment.normalized_label === "string" && assignment.normalized_label.trim()
            ? normalizeInventoryItemName(assignment.normalized_label)
            : normalizeInventoryItemName(ingredientName);
        const key = `${normalized}::${category.toLocaleLowerCase("fr")}`;
        if (!ingredientName || !category || seen.has(key)) return null;
        seen.add(key);
        return {
          clientId: newClientId(),
          selected: true,
          ingredient_name: ingredientName,
          normalized_label: normalized,
          suggested_category: category,
        };
      })
      .filter((row): row is EditableAssignment => Boolean(row));
  } catch {
    return null;
  }
}

export function ReviewIngredientCategoriesClient() {
  const router = useRouter();
  const initialRows = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_INGREDIENT_CATEGORIES_KEY) : null
  );
  const [missing] = useState(() => initialRows == null);
  const [rows, setRows] = useState<EditableAssignment[]>(() => initialRows ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    createdCategories: number;
    assignedItems: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  function finish() {
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_INGREDIENT_CATEGORIES_KEY);
    } catch {
      /* ignore */
    }
    try {
      if (sessionStorage.getItem(PENDING_ONBOARDING_EQUIPMENT_KEY)) {
        router.push("/onboarding/review-equipment");
        return;
      }
    } catch {
      /* ignore */
    }
    router.push("/dashboard");
    router.refresh();
  }

  function updateRow(index: number, patch: Partial<EditableAssignment>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function applyCategories() {
    const payload: IngredientCategoryAssignmentPayload[] = rows.map((row) => ({
      selected: row.selected,
      ingredient_name: row.ingredient_name,
      normalized_label: row.normalized_label || normalizeInventoryItemName(row.ingredient_name),
      suggested_category: row.suggested_category,
    }));
    setPending(true);
    setError(null);
    setResult(null);
    const res = await applyOnboardingIngredientCategoryAssignments(payload);
    setPending(false);
    if (!res.ok && res.assignedItems === 0) {
      setError(res.errors.join(" ") || "Impossible de créer les rubriques composants.");
      return;
    }
    setResult({
      createdCategories: res.createdCategories,
      assignedItems: res.assignedItems,
      skipped: res.skipped,
      errors: res.errors,
    });
    finish();
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">Aucune rubrique composant à valider.</p>
        <button type="button" onClick={finish} className={uiBtnPrimaryBlock}>
          Continuer
        </button>
      </div>
    );
  }

  const selectedCount = rows.filter(
    (row) => row.selected && row.ingredient_name.trim() && row.suggested_category.trim()
  ).length;
  const categoryCount = new Set(
    rows
      .filter((row) => row.selected && row.suggested_category.trim())
      .map((row) => row.suggested_category.trim().toLocaleLowerCase("fr"))
  ).size;

  return (
    <div className="space-y-6">
      {error ? <div className={uiError}>{error}</div> : null}
      {result ? (
        <div className={uiSuccess}>
          {result.createdCategories} rubrique(s) créée(s), {result.assignedItems} composant(s) rangé(s).
          {result.errors.length > 0 ? <p className="mt-2">Points à revoir : {result.errors.join(" ; ")}</p> : null}
        </div>
      ) : null}

      <div>
        <h2 className={uiSectionTitleSm}>Rubriques stock proposées ({categoryCount})</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Issues de l’analyse des fiches recettes. Seuls les composants déjà créés (lors de la validation des recettes)
          peuvent être rangés. Corrigez les libellés si besoin.
        </p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className={uiCard}>
            <p className={uiMuted}>Aucune rubrique composant détectée.</p>
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={row.clientId} className={`${uiCard} grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end`}>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:pb-2">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(index, { selected: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Valider
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-slate-500">Composant</span>
                <input
                  value={row.ingredient_name}
                  onChange={(e) =>
                    updateRow(index, {
                      ingredient_name: e.target.value,
                      normalized_label: normalizeInventoryItemName(e.target.value),
                    })
                  }
                  className={`${uiInput} w-full`}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-slate-500">Rubrique stock</span>
                <input
                  value={row.suggested_category}
                  onChange={(e) => updateRow(index, { suggested_category: e.target.value })}
                  className={`${uiInput} w-full`}
                  placeholder="ex. Légumes, Crèmerie, Épicerie"
                />
              </label>
              <button type="button" onClick={() => removeRow(index)} className={uiBtnOutlineSm}>
                Retirer
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => void applyCategories()}
        disabled={pending || selectedCount === 0}
        className={uiBtnPrimaryBlock}
      >
        {pending ? "Création des rubriques…" : `Créer les rubriques et ranger ${selectedCount} composant(s)`}
      </button>
      <button type="button" onClick={finish} className={uiBtnSecondary}>
        Passer cette étape pour l’instant
      </button>
    </div>
  );
}
