"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDishesFromMenuSuggestions } from "@/app/dishes/import-menu/actions";
import {
  MenuSuggestionsEditor,
  menuItemsToEditableRows,
  type MenuSuggestionRow,
} from "@/components/menu/MenuSuggestionsEditor";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import {
  PENDING_ONBOARDING_CATEGORIES_KEY,
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  PENDING_ONBOARDING_MENU_KEY,
  PENDING_ONBOARDING_RECIPES_KEY,
  type PendingOnboardingCategoriesStored,
  type PendingOnboardingMenuStored,
} from "@/lib/onboardingPendingMenuStorage";
import {
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiMuted,
  uiPageTitle,
} from "@/components/ui/premium";

function parseStored(raw: string | null): MenuSuggestionItem[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingOnboardingMenuStored;
    if (data?.v !== 1 || !Array.isArray(data.items)) return null;
    return data.items;
  } catch {
    return null;
  }
}

export function ReviewMenuClient() {
  const router = useRouter();
  const initialItems = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_MENU_KEY) : null
  );
  const [missing] = useState(() => initialItems == null);
  /** Analyse terminée mais 0 plat extrait (liste vide valide). */
  const [emptyExtract] = useState(() => Boolean(initialItems && initialItems.length === 0));
  const [suggestions, setSuggestions] = useState<MenuSuggestionRow[]>(() =>
    initialItems ? menuItemsToEditableRows(initialItems) : []
  );
  const [createPending, setCreatePending] = useState(false);
  const [createResult, setCreateResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    draftRecipes: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function hasPendingRecipes(): boolean {
    try {
      return Boolean(sessionStorage.getItem(PENDING_ONBOARDING_RECIPES_KEY));
    } catch {
      return false;
    }
  }

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

  function storePendingCategories() {
    const assignments = suggestions
      .filter(
        (s) =>
          s.selected &&
          s.suggested_mode !== "ignore" &&
          s.raw_label.trim().length > 0 &&
          (s.suggested_category ?? "").trim().length > 0
      )
      .map((s) => ({
        dish_name: s.raw_label.trim(),
        normalized_label: s.normalized_label || s.raw_label.trim(),
        suggested_category: (s.suggested_category ?? "").trim(),
      }));
    try {
      if (assignments.length > 0) {
        const payload: PendingOnboardingCategoriesStored = { v: 1, assignments };
        sessionStorage.setItem(PENDING_ONBOARDING_CATEGORIES_KEY, JSON.stringify(payload));
      } else {
        sessionStorage.removeItem(PENDING_ONBOARDING_CATEGORIES_KEY);
      }
    } catch {
      /* ignore: les rubriques pourront être gérées depuis Compte */
    }
  }

  async function goNextAfterMenu() {
    storePendingCategories();
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_MENU_KEY);
    } catch {
      /* ignore */
    }
    if (hasPendingRecipes()) {
      router.push("/onboarding/review-recipes");
      return;
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

  async function handleCreateDishesAndFinish() {
    const payload = suggestions.map((s) => ({
      raw_label: s.raw_label,
      selected: s.selected,
      suggested_mode: s.suggested_mode,
      selling_price_ttc: s.selling_price_ttc,
      selling_vat_rate_pct: s.selling_vat_rate_pct,
      suggested_ingredients: (s.suggested_ingredients ?? []).filter(
        (ing) => typeof ing === "string" && ing.trim().length > 0
      ),
      suggested_category: (s.suggested_category ?? "").trim() || null,
      create_draft_recipe: Boolean(s.create_draft_recipe),
    }));
    const toCreate = payload.filter((p) => p.selected && p.suggested_mode !== "ignore").length;
    if (toCreate === 0) {
      await goNextAfterMenu();
      return;
    }
    setCreatePending(true);
    setCreateResult(null);
    setError(null);
    const result = await createDishesFromMenuSuggestions(payload);
    setCreatePending(false);
    if (!result.success) {
      setError(result.errors.join(" "));
      return;
    }
    setCreateResult({
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      draftRecipes: result.draftRecipes ?? 0,
      errors: result.errors,
    });
    await goNextAfterMenu();
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">
          Aucune suggestion à valider (session expirée ou étape déjà terminée).
        </p>
        <button type="button" onClick={() => void goNextAfterMenu()} className={uiBtnPrimaryBlock}>
          Continuer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {emptyExtract ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aucun plat détecté sur ces photos. Vous pouvez ouvrir le tableau de bord et importer une carte plus tard
          depuis Plats.
        </p>
      ) : null}
      <div>
        <h2 className={uiPageTitle}>Valider les plats détectés</h2>
        <p className={`mt-2 ${uiMuted}`}>
          Cochez les plats à créer ou mettre à jour, ajustez rubrique, prix TTC, TVA et type. Les recettes restent
          gérées dans l’étape dédiée.
        </p>
      </div>
      <MenuSuggestionsEditor
        suggestions={suggestions}
        setSuggestions={setSuggestions}
        onCreate={handleCreateDishesAndFinish}
        createPending={createPending}
        createResult={createResult}
        error={error}
        allowProceedWithNone
        createButtonLabel={
          suggestions.some((s) => s.selected && s.suggested_mode !== "ignore" && s.raw_label.trim())
            ? `Créer les plats et continuer`
            : `Continuer`
        }
      />
      {suggestions.length === 0 ? (
        <button type="button" onClick={() => void goNextAfterMenu()} className={uiBtnPrimaryBlock}>
          Continuer
        </button>
      ) : (
        <button type="button" onClick={() => void goNextAfterMenu()} className={uiBtnSecondary}>
          Passer sans créer de plats
        </button>
      )}
    </div>
  );
}
