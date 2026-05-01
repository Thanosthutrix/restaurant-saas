"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import {
  PENDING_ONBOARDING_CATEGORIES_KEY,
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  type PendingOnboardingCategoriesStored,
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
import { applyOnboardingCategoryAssignments } from "./actions";

type EditableAssignment = {
  clientId: string;
  selected: boolean;
  dish_name: string;
  normalized_label: string;
  suggested_category: string;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `category_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStored(raw: string | null): EditableAssignment[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingOnboardingCategoriesStored;
    if (data?.v !== 1 || !Array.isArray(data.assignments)) return null;
    const seen = new Set<string>();
    return data.assignments
      .map((assignment) => {
        const dishName = typeof assignment.dish_name === "string" ? assignment.dish_name.trim() : "";
        const category =
          typeof assignment.suggested_category === "string"
            ? assignment.suggested_category.trim().replace(/\s+/g, " ")
            : "";
        const normalized =
          typeof assignment.normalized_label === "string" && assignment.normalized_label.trim()
            ? assignment.normalized_label.trim()
            : normalizeDishLabel(dishName);
        const key = `${normalized}::${category.toLocaleLowerCase("fr")}`;
        if (!dishName || !category || seen.has(key)) return null;
        seen.add(key);
        return {
          clientId: newClientId(),
          selected: true,
          dish_name: dishName,
          normalized_label: normalized,
          suggested_category: category,
        };
      })
      .filter((row): row is EditableAssignment => Boolean(row));
  } catch {
    return null;
  }
}

export function ReviewCategoriesClient() {
  const router = useRouter();
  const initialRows = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_CATEGORIES_KEY) : null
  );
  const [missing] = useState(() => initialRows == null);
  const [rows, setRows] = useState<EditableAssignment[]>(() => initialRows ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    createdCategories: number;
    assignedDishes: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  function finish() {
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_CATEGORIES_KEY);
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
    const payload = rows.map((row) => ({
      selected: row.selected,
      dish_name: row.dish_name,
      normalized_label: row.normalized_label || normalizeDishLabel(row.dish_name),
      suggested_category: row.suggested_category,
    }));
    setPending(true);
    setError(null);
    setResult(null);
    const res = await applyOnboardingCategoryAssignments(payload);
    setPending(false);
    if (!res.ok && res.assignedDishes === 0) {
      setError(res.errors.join(" ") || "Impossible de créer les rubriques.");
      return;
    }
    setResult({
      createdCategories: res.createdCategories,
      assignedDishes: res.assignedDishes,
      skipped: res.skipped,
      errors: res.errors,
    });
    finish();
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">Aucune rubrique à valider.</p>
        <button type="button" onClick={finish} className={uiBtnPrimaryBlock}>
          Ouvrir le tableau de bord
        </button>
      </div>
    );
  }

  const selectedCount = rows.filter(
    (row) => row.selected && row.dish_name.trim() && row.suggested_category.trim()
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
          {result.createdCategories} rubrique(s) créée(s), {result.assignedDishes} plat(s) rangé(s).
          {result.errors.length > 0 ? <p className="mt-2">Points à revoir : {result.errors.join(" ; ")}</p> : null}
        </div>
      ) : null}

      <div>
        <h2 className={uiSectionTitleSm}>Rubriques proposées ({categoryCount})</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Corrigez les noms si besoin. Les rubriques seront créées dans la carte, puis les plats détectés y seront
          automatiquement rangés.
        </p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className={uiCard}>
            <p className={uiMuted}>Aucune affectation de rubrique détectée.</p>
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
                <span className="block text-xs font-medium text-slate-500">Plat</span>
                <input
                  value={row.dish_name}
                  onChange={(e) =>
                    updateRow(index, {
                      dish_name: e.target.value,
                      normalized_label: normalizeDishLabel(e.target.value),
                    })
                  }
                  className={`${uiInput} w-full`}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-slate-500">Rubrique</span>
                <input
                  value={row.suggested_category}
                  onChange={(e) => updateRow(index, { suggested_category: e.target.value })}
                  className={`${uiInput} w-full`}
                  placeholder="ex. Entrées, Pizzas, Desserts"
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
        {pending ? "Création des rubriques…" : `Créer les rubriques et ranger ${selectedCount} plat(s)`}
      </button>
      <button type="button" onClick={finish} className={uiBtnSecondary}>
        Passer les rubriques pour l’instant
      </button>
    </div>
  );
}
