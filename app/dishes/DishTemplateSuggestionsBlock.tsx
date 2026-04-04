"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyTemplateSuggestions } from "@/app/restaurants/actions";
import type { TemplateSuggestions } from "@/app/restaurants/actions";
import {
  uiBadgeAmber,
  uiBadgeSlate,
  uiBtnOutlineSm,
  uiBtnSecondary,
  uiCard,
  uiMuted,
} from "@/components/ui/premium";

const DISMISS_STORAGE_PREFIX = "rs_dismiss_dish_template_suggestions_v1";

function dismissStorageKey(restaurantId: string) {
  return `${DISMISS_STORAGE_PREFIX}:${restaurantId}`;
}

export function DishTemplateSuggestionsBlock({
  restaurantId,
  suggestions,
}: {
  restaurantId: string;
  suggestions: TemplateSuggestions | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  /** null = préférence pas encore lue (évite d’afficher un flash si déjà masqué). */
  const [showPanel, setShowPanel] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setShowPanel(localStorage.getItem(dismissStorageKey(restaurantId)) !== "1");
    } catch {
      setShowPanel(true);
    }
  }, [restaurantId]);

  const allSuggestedDishes = suggestions?.allSuggestedDishes ?? [];
  const missingDishNames = new Set(
    (suggestions?.missingDishes ?? []).map((d) => d.name.trim().toLowerCase())
  );

  function handleDismiss() {
    try {
      localStorage.setItem(dismissStorageKey(restaurantId), "1");
    } catch {
      /* navigateur privé / quota */
    }
    setShowPanel(false);
  }

  async function handleApply() {
    setMessage(null);
    setLoading(true);
    const result = await applyTemplateSuggestions(restaurantId);
    setLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    const parts: string[] = [];
    if (result.added != null && result.added > 0) parts.push(`${result.added} composant(s) ajouté(s)`);
    if (result.addedDishes != null && result.addedDishes > 0) parts.push(`${result.addedDishes} plat(s) ajouté(s)`);
    const text =
      parts.length > 0
        ? parts.join(". ")
        : "Aucun plat à ajouter (tous sont déjà présents).";
    setMessage({ type: "success", text });
    router.refresh();
  }

  if (showPanel === null || !showPanel) return null;
  if (allSuggestedDishes.length === 0) return null;

  return (
    <div className={`${uiCard} mb-0`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Suggestions du template</h2>
        <button
          type="button"
          onClick={handleDismiss}
          className={`shrink-0 ${uiBtnOutlineSm}`}
          aria-label="Ne plus afficher les suggestions du template sur cette page"
        >
          Masquer
        </button>
      </div>
      <p className={`mb-3 ${uiMuted}`}>
        Plats suggérés par le modèle de votre restaurant. Appliquer crée uniquement les plats manquants, sans doublon.
      </p>
      <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto text-sm">
        {allSuggestedDishes.map((d) => {
          const isMissing = missingDishNames.has(d.name.trim().toLowerCase());
          return (
            <li key={d.name} className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{d.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-slate-500">
                  {d.production_mode === "resale" ? "Revente" : "Préparé"}
                </span>
                {isMissing ? (
                  <span className={uiBadgeAmber}>À créer</span>
                ) : (
                  <span className={uiBadgeSlate}>Déjà créé</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {message && (
        <p
          className={`mb-3 text-sm font-medium ${
            message.type === "success" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}
      <button type="button" onClick={handleApply} disabled={loading} className={uiBtnSecondary}>
        {loading ? "Application…" : "Appliquer les suggestions du template"}
      </button>
    </div>
  );
}
