"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeSuggestion } from "@/lib/recipes/findRecipeSuggestionForDish";
import { applySuggestedRecipeToDish } from "./actions";

export function RecipeSuggestionBlock({
  dishId,
  restaurantId,
  suggestion,
}: {
  dishId: string;
  restaurantId: string;
  suggestion: RecipeSuggestion;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUseBase() {
    setLoading(true);
    const result = await applySuggestedRecipeToDish({ restaurantId, dishId });
    setLoading(false);
    if (result.ok) router.refresh();
    else alert(result.error);
  }

  if (!suggestion) return null;

  return (
    <div className="mb-0 rounded-2xl border border-violet-200/80 bg-violet-50/60 p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-violet-950">Suggestion de recette disponible</h2>
      <p className="mb-3 text-sm text-violet-800">
        Base suggérée à vérifier. Quantités indicatives à ajuster selon votre recette.
      </p>
      <ul className="mb-4 space-y-1 text-sm text-slate-700">
        {suggestion.components.map((c, i) => (
          <li key={i}>
            {c.name} — {c.qty} {c.unit}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleUseBase}
        disabled={loading}
        className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600 disabled:opacity-50"
      >
        {loading ? "Application…" : "Utiliser cette base"}
      </button>
    </div>
  );
}
