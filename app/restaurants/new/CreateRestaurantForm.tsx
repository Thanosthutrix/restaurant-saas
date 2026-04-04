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
  const [avgCovers, setAvgCovers] = useState("");
  const [serviceType, setServiceType] = useState("both");
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("form");
  const [suggestions, setSuggestions] = useState<MenuSuggestionRow[]>([]);
  const [createPending, setCreatePending] = useState(false);
  const [createResult, setCreateResult] = useState<{
    created: number;
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
    fd.append("avg_covers", avgCovers);
    fd.append("service_type", serviceType);
    if (menuFiles.length > 0) {
      fd.append("menu_image_count", String(menuFiles.length));
    }
    for (const f of menuFiles) {
      fd.append("menu_image", f);
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
    if (menuFiles.length === 0) {
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
            Ajustez prix TTC, TVA, type et ingrédients puis enregistrez, ou passez cette étape.
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
        <label htmlFor="avgCovers" className="mb-1 block text-sm font-medium text-slate-700">
          Nombre moyen de couverts / jour
        </label>
        <input
          id="avgCovers"
          type="number"
          min={1}
          value={avgCovers}
          onChange={(e) => setAvgCovers(e.target.value)}
          placeholder="50"
          className={inputClass}
        />
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading
          ? menuFiles.length > 0
            ? "Création et analyse…"
            : "Création…"
          : menuFiles.length > 0
            ? "Créer et analyser la carte"
            : "Créer le restaurant"}
      </button>
    </form>
  );
}
