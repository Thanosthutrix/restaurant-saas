"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateDishRecipe } from "./actions";
import { uiCard, uiMuted } from "@/components/ui/premium";

export function ValidateRecipeButton({
  dishId,
  restaurantId,
}: {
  dishId: string;
  restaurantId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleValidate() {
    setLoading(true);
    const result = await validateDishRecipe({ restaurantId, dishId });
    setLoading(false);
    if (result.ok) router.refresh();
    else alert(result.error);
  }

  return (
    <div className={uiCard}>
      <button
        type="button"
        onClick={handleValidate}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "Validation…" : "Valider la recette"}
      </button>
      <p className={`mt-2 ${uiMuted}`}>
        Après validation, toute modification de la recette repassera le statut en brouillon.
      </p>
    </div>
  );
}
