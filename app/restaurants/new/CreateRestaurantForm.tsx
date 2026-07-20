"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ScanLine, UtensilsCrossed } from "lucide-react";
import { createRestaurantFormData } from "../actions";
import { createDishesFromMenuSuggestions } from "@/app/dishes/import-menu/actions";
import {
  MenuSuggestionsEditor,
  menuItemsToEditableRows,
  type MenuSuggestionRow,
} from "@/components/menu/MenuSuggestionsEditor";
import { OptionalMenuPhotosPicker } from "@/components/restaurant/OptionalMenuPhotosPicker";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import {
  PENDING_ONBOARDING_RECIPES_KEY,
  type PendingOnboardingRecipesStored,
} from "@/lib/onboardingPendingMenuStorage";
import { RESTAURANT_PROFILE_OTHER, type RestaurantTemplate } from "@/lib/templates/restaurantTemplates";
import {
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiCardMuted,
  uiError,
  uiFormLabel,
  uiInputBlock,
  uiLead,
  uiMuted,
  uiSelectBlock,
} from "@/components/ui/premium";

const SERVICE_TYPES = [
  { value: "lunch", label: "Déjeuner" },
  { value: "dinner", label: "Dîner" },
  { value: "both", label: "Déjeuner et dîner" },
];

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
      <EstablishmentSection
        icon={UtensilsCrossed}
        iconTone="bg-emerald-50 text-emerald-700 ring-emerald-100"
        subtitle="Ajustez rubrique, prix TTC, TVA et type puis enregistrez, ou passez cette étape."
        title="Valider les plats détectés"
      >
        <MenuSuggestionsEditor
          allowProceedWithNone
          createButtonLabel={
            suggestions.some((s) => s.selected && s.suggested_mode !== "ignore" && s.raw_label.trim())
              ? "Créer les plats et ouvrir le tableau de bord"
              : "Ouvrir le tableau de bord"
          }
          createPending={createPending}
          createResult={createResult}
          error={error}
          onCreate={handleCreateDishesAndFinish}
          setSuggestions={setSuggestions}
          suggestions={suggestions}
        />
        {suggestions.length === 0 ? (
          <button type="button" onClick={() => void goDashboard()} className={`mt-4 ${uiBtnPrimaryBlock}`}>
            Ouvrir le tableau de bord
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void goDashboard()}
            className={`mt-4 w-full ${uiBtnSecondary} py-2.5`}
          >
            Passer sans créer de plats
          </button>
        )}
      </EstablishmentSection>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <EstablishmentSection
        icon={Building2}
        subtitle="Informations de base pour le nouvel établissement."
        title="Identité de l'établissement"
      >
        {error ? <p className={`mb-4 ${uiError}`}>{error}</p> : null}

        <div className="space-y-5">
          <div>
            <label htmlFor="name" className={uiFormLabel}>
              Nom du restaurant *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Le Bistrot"
              className={uiInputBlock}
            />
          </div>

          <div className={uiCardMuted}>
            <p className="mb-1 text-sm font-semibold text-stone-800">Adresse et calendrier</p>
            <p className={`mb-4 ${uiLead}`}>
              Optionnel : météo et calendrier scolaire. Si renseignée, adresse géocodable en France.
            </p>
            <label htmlFor="address" className={uiFormLabel}>
              Adresse de l&apos;établissement
            </label>
            <textarea
              id="address"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              rows={2}
              placeholder="12 rue de la République, 75001 Paris"
              className={`${uiInputBlock} min-h-[4rem] resize-y`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile" className={uiFormLabel}>
                Type d&apos;établissement
              </label>
              <select
                id="profile"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                className={uiSelectBlock}
              >
                {templates.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name} — {t.components.length} composants, {t.suggestedDishes.length} plats
                  </option>
                ))}
                <option value={RESTAURANT_PROFILE_OTHER}>Autre — aucun modèle</option>
              </select>
              {selectedTemplate ? (
                <p className={`mt-2 ${uiMuted}`}>{selectedTemplate.description}</p>
              ) : (
                <p className={`mt-2 ${uiMuted}`}>
                  Aucun composant ni plat prérempli — vous les ajouterez dans l&apos;application.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="serviceType" className={uiFormLabel}>
                Type de service
              </label>
              <select
                id="serviceType"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className={uiSelectBlock}
              >
                {SERVICE_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </EstablishmentSection>

      <EstablishmentSection
        icon={ScanLine}
        iconTone="bg-violet-50 text-violet-700 ring-violet-100"
        subtitle="Importez carte ou recettes pour préremplir votre espace avec l'IA."
        title="Import intelligent (optionnel)"
      >
        <div className="space-y-2">
          <OptionalMenuPhotosPicker files={menuFiles} onChange={setMenuFiles} disabled={loading} />
          <OptionalMenuPhotosPicker
            cameraLabel="Photographier une recette"
            description="Ajoutez plusieurs fiches recettes ou notes cuisine (images ou PDF). L'IA proposera les ingrédients et quantités par portion."
            disabled={loading}
            files={recipeFiles}
            galleryLabel="Fiches recettes depuis la galerie"
            onChange={setRecipeFiles}
            title="Photo(s) de recettes (optionnel)"
          />
        </div>
      </EstablishmentSection>

      <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
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
