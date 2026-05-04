"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRestaurantFormData } from "../actions";
import { createDishesFromMenuSuggestions } from "@/app/dishes/import-menu/actions";
import {
  MenuSuggestionsEditor,
  menuItemsToEditableRows,
  type MenuSuggestionRow,
} from "@/components/menu/MenuSuggestionsEditor";
import { OptionalMenuPhotosPicker } from "@/components/restaurant/OptionalMenuPhotosPicker";
import {
  PENDING_ONBOARDING_RECIPES_KEY,
  type PendingOnboardingRecipesStored,
} from "@/lib/onboardingPendingMenuStorage";
import { RESTAURANT_PROFILE_OTHER, type RestaurantTemplate } from "@/lib/templates/restaurantTemplates";

const SERVICE_TYPES = [
  { value: "lunch", label: "Déjeuner" },
  { value: "dinner", label: "Dîner" },
  { value: "both", label: "Déjeuner et dîner" },
];

const inputClass =
  "w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

type Phase = "form" | "review";

export function CreateRestaurantForm({ templates }: { templates: RestaurantTemplate[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const defaultProfile = templates[0]?.slug ?? RESTAURANT_PROFILE_OTHER;
  const [profile, setProfile] = useState<string>(defaultProfile);
  const [serviceType, setServiceType] = useState("both");
  const [addressText, setAddressText] = useState("");
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [recipeFiles, setRecipeFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("form");
  const [suggestions, setSuggestions] = useState<MenuSuggestionRow[]>([]);
  const [createPending, setCreatePending] = useState(false);
  const [createResult, setCreateResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    draftRecipes: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedTemplate = profile !== RESTAURANT_PROFILE_OTHER ? templates.find((t) => t.slug === profile) : null;

  async function goDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== "form") return;
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("profile", profile);
    fd.append("service_type", serviceType);
    if (addressText.trim()) {
      fd.append("address_text", addressText.trim());
    }
    if (menuFiles.length > 0) {
      fd.append("menu_image_count", String(menuFiles.length));
    }
    for (const f of menuFiles) {
      fd.append("menu_image", f);
    }
    if (recipeFiles.length > 0) {
      fd.append("recipe_image_count", String(recipeFiles.length));
    }
    for (const f of recipeFiles) {
      fd.append("recipe_image", f);
    }
    const result = await createRestaurantFormData(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const restaurantId = result.restaurantId;
    if (!restaurantId) {
      await goDashboard();
      return;
    }
    if (result.recipeSuggestions) {
      const payload: PendingOnboardingRecipesStored = { v: 1, items: result.recipeSuggestions };
      try {
        sessionStorage.setItem(PENDING_ONBOARDING_RECIPES_KEY, JSON.stringify(payload));
      } catch {
        setError(
          "Impossible de conserver les suggestions de recettes localement. Vous pourrez réimporter les recettes depuis Plats."
        );
        return;
      }
    }
    if (menuFiles.length === 0) {
      if (result.recipeSuggestions) {
        router.replace("/onboarding/review-recipes");
        return;
      }
      await goDashboard();
      return;
    }
    const raw = result.menuSuggestions ?? [];
    setSuggestions(menuItemsToEditableRows(raw));
    setPhase("review");
    if (raw.length === 0) {
      setError(
        "Aucun plat détecté. Vous pouvez passer au tableau de bord et utiliser Plats → Importer une photo de carte."
      );
    } else {
      setError(null);
    }
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
      updated: result.updated,
      skipped: result.skipped,
      draftRecipes: result.draftRecipes ?? 0,
      errors: result.errors,
    });
    await goDashboard();
  }

  if (phase === "review") {
    return (
      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Valider les plats détectés</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ajustez rubrique, prix TTC, TVA et type puis enregistrez, ou passez cette étape.
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
          <button
            type="button"
            onClick={() => void goDashboard()}
            className="w-full rounded bg-slate-900 py-2 font-medium text-white hover:bg-slate-800"
          >
            Ouvrir le tableau de bord
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void goDashboard()}
            className="w-full rounded border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Passer sans créer de plats
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Nom du restaurant *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Le Bistrot"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-700">
          Adresse de l&apos;établissement
        </label>
        <textarea
          id="address"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          rows={2}
          placeholder="12 rue de la République, 75001 Paris"
          className={`${inputClass} min-h-[4rem] resize-y`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Optionnel : météo et calendrier. Si renseignée, adresse géocodable en France (Base Adresse Nationale).
        </p>
      </div>
      <div>
        <label htmlFor="profile" className="mb-1 block text-sm font-medium text-slate-700">
          Type d&apos;établissement et modèle de départ
        </label>
        <select
          id="profile"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className={inputClass}
        >
          {templates.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name} — {t.components.length} composants, {t.suggestedDishes.length} plats suggérés
            </option>
          ))}
          <option value={RESTAURANT_PROFILE_OTHER}>Autre — aucun modèle</option>
        </select>
        {selectedTemplate ? (
          <p className="mt-1 text-xs text-slate-500">{selectedTemplate.description}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Aucun composant ni plat prérempli — vous les ajouterez dans l&apos;application.
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Type de service</label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className={inputClass}
        >
          {SERVICE_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <OptionalMenuPhotosPicker files={menuFiles} onChange={setMenuFiles} disabled={loading} />

      <OptionalMenuPhotosPicker
        files={recipeFiles}
        onChange={setRecipeFiles}
        disabled={loading}
        title="Photo(s) de recettes (optionnel)"
          description="Ajoutez plusieurs fiches recettes ou notes cuisine (images ou PDF). L’IA proposera les ingrédients et quantités par portion, puis vous validerez avant création des recettes brouillon."
        galleryLabel="Fiches recettes depuis la galerie"
        cameraLabel="Photographier une recette"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading
          ? menuFiles.length > 0
            ? "Création et analyse…"
            : recipeFiles.length > 0
              ? "Création et analyse des recettes…"
            : "Création…"
          : menuFiles.length > 0 || recipeFiles.length > 0
            ? "Créer et analyser les documents"
            : "Créer le restaurant"}
      </button>
    </form>
  );
}
