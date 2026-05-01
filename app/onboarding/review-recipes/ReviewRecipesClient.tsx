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
  PENDING_ONBOARDING_CATEGORIES_KEY,
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  PENDING_ONBOARDING_RECIPES_KEY,
  type PendingOnboardingRecipesStored,
} from "@/lib/onboardingPendingMenuStorage";
import type { RecipePhotoSuggestion } from "@/lib/recipe-photo-analysis";
import {
  uiBtnOutlineSm,
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiFileInput,
  uiInput,
  uiMuted,
  uiSectionTitleSm,
  uiSuccess,
} from "@/components/ui/premium";
import { analyzeMoreOnboardingRecipePhotos, applyOnboardingRecipeSuggestions } from "./actions";

type EditableRecipe = RecipePhotoSuggestion & {
  clientId: string;
  selected: boolean;
};

function newClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStored(raw: string | null): RecipePhotoSuggestion[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingOnboardingRecipesStored;
    if (data?.v !== 1 || !Array.isArray(data.items)) return null;
    return data.items;
  } catch {
    return null;
  }
}

function toEditable(items: RecipePhotoSuggestion[]): EditableRecipe[] {
  return items.map((item) => ({
    ...item,
    clientId: newClientId(),
    selected: item.ingredients.length > 0,
    ingredients: item.ingredients.map((ing) => ({
      ...ing,
      unit: ing.unit ? (parseAllowedStockUnit(ing.unit) ?? "unit") : "unit",
    })),
  }));
}

function fileKey(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

export function ReviewRecipesClient() {
  const router = useRouter();
  const initialItems = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_RECIPES_KEY) : null
  );
  const [missing] = useState(() => initialItems == null);
  const [recipes, setRecipes] = useState<EditableRecipe[]>(() =>
    initialItems ? toEditable(initialItems) : []
  );
  const [pending, setPending] = useState(false);
  const [reloadFiles, setReloadFiles] = useState<File[]>([]);
  const [analyzePending, setAnalyzePending] = useState(false);
  const [result, setResult] = useState<{ applied: number; replaced: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function hasPendingCategories(): boolean {
    try {
      return Boolean(sessionStorage.getItem(PENDING_ONBOARDING_CATEGORIES_KEY));
    } catch {
      return false;
    }
  }

  function hasPendingEquipment(): boolean {
    try {
      return Boolean(sessionStorage.getItem(PENDING_ONBOARDING_EQUIPMENT_KEY));
    } catch {
      return false;
    }
  }

  function clearAndGoNext() {
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_RECIPES_KEY);
    } catch {
      /* ignore */
    }
    if (hasPendingCategories()) {
      router.push("/onboarding/review-categories");
      return;
    }
    if (hasPendingEquipment()) {
      router.push("/onboarding/review-equipment");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const updateRecipe = (index: number, patch: Partial<EditableRecipe>) => {
    setRecipes((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const updateIngredient = (
    recipeIndex: number,
    ingredientIndex: number,
    patch: Partial<EditableRecipe["ingredients"][number]>
  ) => {
    setRecipes((prev) =>
      prev.map((row, i) =>
        i === recipeIndex
          ? {
              ...row,
              ingredients: row.ingredients.map((ing, j) => (j === ingredientIndex ? { ...ing, ...patch } : ing)),
            }
          : row
      )
    );
  };

  const removeIngredient = (recipeIndex: number, ingredientIndex: number) => {
    setRecipes((prev) =>
      prev.map((row, i) =>
        i === recipeIndex
          ? { ...row, ingredients: row.ingredients.filter((_, j) => j !== ingredientIndex) }
          : row
      )
    );
  };

  const addIngredient = (recipeIndex: number) => {
    setRecipes((prev) =>
      prev.map((row, i) =>
        i === recipeIndex
          ? { ...row, ingredients: [...row.ingredients, { name: "", qty: 1, unit: "unit" }] }
          : row
      )
    );
  };

  const mergeReloadFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const map = new Map<string, File>();
    for (const file of reloadFiles) map.set(fileKey(file), file);
    for (const file of Array.from(list)) map.set(fileKey(file), file);
    setReloadFiles([...map.values()]);
  };

  const removeReloadFileAt = (index: number) => {
    setReloadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function analyzeReloadedPhotos(mode: "append" | "replace") {
    if (reloadFiles.length === 0) {
      setError("Ajoutez au moins une photo de recette.");
      return;
    }
    const formData = new FormData();
    for (const file of reloadFiles) {
      formData.append("recipe_image", file);
    }
    setAnalyzePending(true);
    setError(null);
    const res = await analyzeMoreOnboardingRecipePhotos(formData);
    setAnalyzePending(false);
    if (!res.ok) {
      setError(res.errors.join(" ") || "Aucune recette détectée.");
      return;
    }
    const next = toEditable(res.suggestions);
    setRecipes((prev) => (mode === "replace" ? next : [...prev, ...next]));
    setReloadFiles([]);
    if (res.errors.length > 0) {
      setError(`Analyse partielle : ${res.errors.join(" ")}`);
    }
  }

  async function applyRecipes() {
    const payload = recipes.map((row) => ({
      selected: row.selected,
      dish_name: row.dish_name,
      normalized_label: row.normalized_label,
      ingredients: row.ingredients
        .filter((ing) => ing.name.trim().length > 0)
        .map((ing) => ({
          name: ing.name.trim(),
          qty: ing.qty != null && Number.isFinite(Number(ing.qty)) ? Number(ing.qty) : null,
          unit: ing.unit ? (parseAllowedStockUnit(ing.unit) ?? "unit") : null,
        })),
    }));
    setPending(true);
    setError(null);
    setResult(null);
    const res = await applyOnboardingRecipeSuggestions(payload);
    setPending(false);
    if (!res.ok && res.applied === 0) {
      setError(res.errors.join(" ") || "Impossible d’appliquer les recettes.");
      return;
    }
    setResult({ applied: res.applied, replaced: res.replaced, skipped: res.skipped, errors: res.errors });
    clearAndGoNext();
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">Aucune recette à valider.</p>
        <button type="button" onClick={clearAndGoNext} className={uiBtnPrimaryBlock}>
          Continuer
        </button>
      </div>
    );
  }

  const selectedCount = recipes.filter((recipe) => recipe.selected && recipe.ingredients.length > 0).length;

  return (
    <div className="space-y-6">
      {error ? <div className={uiError}>{error}</div> : null}
      {result ? (
        <div className={uiSuccess}>
          {result.applied} recette(s) brouillon créée(s). {result.skipped} ignorée(s).
          {result.replaced > 0 ? <p>{result.replaced} recette(s) brouillon remplacée(s).</p> : null}
          {result.errors.length > 0 ? <p className="mt-2">Points à revoir : {result.errors.join(" ; ")}</p> : null}
        </div>
      ) : null}

      <div>
        <h2 className={uiSectionTitleSm}>Recettes détectées ({recipes.length})</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Le nom du plat doit correspondre à un plat déjà créé. Corrigez les quantités par portion avant validation.
        </p>
      </div>

      <div className={`${uiCard} space-y-3`}>
        <div>
          <h3 className={uiSectionTitleSm}>Les propositions ne conviennent pas ?</h3>
          <p className={`mt-1 ${uiMuted}`}>
            Ajoutez d’autres photos de recettes, puis remplacez la liste actuelle ou ajoutez les nouvelles propositions
            à la suite.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Galerie</label>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={analyzePending || pending}
              onChange={(e) => {
                mergeReloadFiles(e.target.files);
                e.target.value = "";
              }}
              className={uiFileInput}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Appareil photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={analyzePending || pending}
              onChange={(e) => {
                mergeReloadFiles(e.target.files);
                e.target.value = "";
              }}
              className={uiFileInput}
            />
          </div>
        </div>
        {reloadFiles.length > 0 ? (
          <ul className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
            {reloadFiles.map((file, i) => (
              <li key={fileKey(file)} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeReloadFileAt(i)}
                  disabled={analyzePending || pending}
                  className={uiBtnOutlineSm}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void analyzeReloadedPhotos("append")}
            disabled={analyzePending || pending || reloadFiles.length === 0}
            className={uiBtnOutlineSm}
          >
            {analyzePending ? "Analyse…" : "Ajouter aux propositions"}
          </button>
          <button
            type="button"
            onClick={() => void analyzeReloadedPhotos("replace")}
            disabled={analyzePending || pending || reloadFiles.length === 0}
            className={uiBtnOutlineSm}
          >
            Remplacer les propositions
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {recipes.map((recipe, recipeIndex) => (
          <div key={recipe.clientId} className={`${uiCard} space-y-4`}>
            <div className="flex flex-wrap items-start gap-3">
              <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={recipe.selected}
                  onChange={(e) => updateRecipe(recipeIndex, { selected: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                Créer
              </label>
              <div className="min-w-[12rem] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">Plat concerné</label>
                <input
                  value={recipe.dish_name}
                  onChange={(e) =>
                    updateRecipe(recipeIndex, {
                      dish_name: e.target.value,
                      normalized_label: "",
                    })
                  }
                  className={`${uiInput} w-full`}
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs font-medium text-slate-500">Portions</label>
                <input
                  type="number"
                  min={1}
                  value={recipe.portions ?? ""}
                  onChange={(e) =>
                    updateRecipe(recipeIndex, {
                      portions: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={`${uiInput} w-full`}
                />
              </div>
            </div>

            <div className="space-y-2">
              {recipe.ingredients.map((ingredient, ingredientIndex) => (
                <div key={`${recipe.clientId}-${ingredientIndex}`} className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem_auto]">
                  <input
                    value={ingredient.name}
                    onChange={(e) => updateIngredient(recipeIndex, ingredientIndex, { name: e.target.value })}
                    placeholder="Ingrédient"
                    className={`${uiInput} w-full`}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={ingredient.qty ?? ""}
                    onChange={(e) =>
                      updateIngredient(recipeIndex, ingredientIndex, {
                        qty: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Qté"
                    className={`${uiInput} w-full`}
                  />
                  <select
                    value={parseAllowedStockUnit(ingredient.unit ?? "") ?? "unit"}
                    onChange={(e) =>
                      updateIngredient(recipeIndex, ingredientIndex, {
                        unit: e.target.value as AllowedUnit,
                      })
                    }
                    className={`${uiInput} w-full`}
                  >
                    {ALLOWED_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {STOCK_UNIT_LABEL_FR[unit]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeIngredient(recipeIndex, ingredientIndex)} className={uiBtnOutlineSm}>
                    Retirer
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addIngredient(recipeIndex)} className={uiBtnOutlineSm}>
                + Ingrédient
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void applyRecipes()}
        disabled={pending || selectedCount === 0}
        className={uiBtnPrimaryBlock}
      >
        {pending ? "Création des recettes…" : `Créer ${selectedCount} recette(s) brouillon`}
      </button>
      <button type="button" onClick={clearAndGoNext} className={uiBtnSecondary}>
        Passer les recettes pour l’instant
      </button>
    </div>
  );
}
