"use client";

import { useState } from "react";
import { updateDishPublicListing } from "./actions";
import { MENU_CATEGORIES, type MenuCategory } from "@/lib/public/menuCategories";
import { uiCard, uiLabel, uiSelect, uiBtnPrimarySm } from "@/components/ui/premium";

type Props = {
  dishId: string;
  restaurantId: string;
  initialIsPublic: boolean;
  initialMenuCategory: MenuCategory | null;
  initialDescription: string;
};

const CATEGORIES = MENU_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

export function DishPublicListingBlock({
  dishId,
  restaurantId,
  initialIsPublic,
  initialMenuCategory,
  initialDescription,
}: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [menuCategory, setMenuCategory] = useState<MenuCategory>(initialMenuCategory ?? "plat");
  const [description, setDescription] = useState(initialDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const result = await updateDishPublicListing({
      dishId,
      restaurantId,
      isPublic,
      menuCategory,
      description: description.trim(),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className={`${uiCard} space-y-4 border-orange-200 bg-orange-50/30`}>
      <div>
        <h2 className="text-sm font-semibold text-stone-900">Carte publique (clients)</h2>
        <p className="mt-1 text-xs text-stone-500">
          Affiche ce plat sur le portail B2C si le restaurant est visible publiquement.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Carte publique mise à jour.</p> : null}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-stone-300 text-orange-600"
        />
        <span className="text-sm text-stone-800">Afficher sur la carte publique</span>
      </label>

      <div>
        <label htmlFor="menuCategory" className={uiLabel}>
          Catégorie carte
        </label>
        <select
          id="menuCategory"
          value={menuCategory}
          onChange={(e) => setMenuCategory(e.target.value as MenuCategory)}
          className={uiSelect}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dishPublicDescription" className={uiLabel}>
          Description (carte publique)
        </label>
        <textarea
          id="dishPublicDescription"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Courte description pour les clients…"
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
        />
      </div>

      <button type="submit" disabled={loading} className={uiBtnPrimarySm}>
        {loading ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
