"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDishesFromMenuSuggestions } from "@/app/dishes/import-menu/actions";
import {
  MenuSuggestionsEditor,
  menuItemsToEditableRows,
  type MenuSuggestionRow,
} from "@/components/menu/MenuSuggestionsEditor";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import {
  PENDING_ONBOARDING_MENU_KEY,
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
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  /** Analyse terminée mais 0 plat extrait (liste vide valide). */
  const [emptyExtract, setEmptyExtract] = useState(false);
  const [suggestions, setSuggestions] = useState<MenuSuggestionRow[]>([]);
  const [createPending, setCreatePending] = useState(false);
  const [createResult, setCreateResult] = useState<{
    created: number;
    skipped: number;
    draftRecipes: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const items = parseStored(
      typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_MENU_KEY) : null
    );
    setReady(true);
    if (!items) {
      setMissing(true);
      return;
    }
    setEmptyExtract(items.length === 0);
    setSuggestions(menuItemsToEditableRows(items));
  }, []);

  async function goDashboard() {
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_MENU_KEY);
    } catch {
      /* ignore */
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
      create_draft_recipe: Boolean(s.create_draft_recipe),
    }));
    const toCreate = payload.filter((p) => p.selected && p.suggested_mode !== "ignore").length;
    if (toCreate === 0) {
      await goDashboard();
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
      skipped: result.skipped,
      draftRecipes: result.draftRecipes ?? 0,
      errors: result.errors,
    });
    await goDashboard();
  }

  if (!ready) {
    return <p className={uiMuted}>Chargement…</p>;
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">
          Aucune suggestion à valider (session expirée ou étape déjà terminée).
        </p>
        <button type="button" onClick={() => void goDashboard()} className={uiBtnPrimaryBlock}>
          Ouvrir le tableau de bord
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
          Cochez les plats à créer, ajustez prix TTC / TVA et ingrédients, puis enregistrez. Sans validation ici, aucun plat
          n’est ajouté à votre carte.
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
            ? `Créer les plats et ouvrir le tableau de bord`
            : `Ouvrir le tableau de bord`
        }
      />
      {suggestions.length === 0 ? (
        <button type="button" onClick={() => void goDashboard()} className={uiBtnPrimaryBlock}>
          Ouvrir le tableau de bord
        </button>
      ) : (
        <button type="button" onClick={() => void goDashboard()} className={uiBtnSecondary}>
          Passer sans créer de plats
        </button>
      )}
    </div>
  );
}
