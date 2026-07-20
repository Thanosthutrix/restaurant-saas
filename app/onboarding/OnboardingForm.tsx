"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ScanLine } from "lucide-react";
import { submitOnboardingFormData } from "./actions";
import { OptionalMenuPhotosPicker } from "@/components/restaurant/OptionalMenuPhotosPicker";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import {
  PENDING_ONBOARDING_MENU_KEY,
  PENDING_ONBOARDING_RECIPES_KEY,
  type PendingOnboardingMenuStored,
  type PendingOnboardingRecipesStored,
} from "@/lib/onboardingPendingMenuStorage";
import { RESTAURANT_PROFILE_OTHER, type RestaurantTemplate } from "@/lib/templates/restaurantTemplates";
import {
  uiBtnPrimaryBlock,
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

export function OnboardingForm({ templates }: { templates: RestaurantTemplate[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const defaultProfile = templates[0]?.slug ?? RESTAURANT_PROFILE_OTHER;
  const [profile, setProfile] = useState<string>(defaultProfile);
  const [serviceType, setServiceType] = useState("both");
  const [addressText, setAddressText] = useState("");
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [recipeFiles, setRecipeFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedTemplate = profile !== RESTAURANT_PROFILE_OTHER ? templates.find((t) => t.slug === profile) : null;

  async function goDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    const result = await submitOnboardingFormData(fd);
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
    const payload: PendingOnboardingMenuStored = { v: 1, items: raw };
    try {
      sessionStorage.setItem(PENDING_ONBOARDING_MENU_KEY, JSON.stringify(payload));
    } catch {
      setError(
        "Impossible de conserver les suggestions localement (navigateur). Réessayez ou importez la carte depuis Plats."
      );
      return;
    }
    router.replace("/onboarding/review-menu");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <EstablishmentSection
        icon={Building2}
        subtitle="Nom, adresse et modèle de départ pour votre espace professionnel."
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
              Utilisée pour la météo et la zone de vacances scolaires. Laissez vide pour renseigner plus tard dans la
              fiche établissement.
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
            <p className={`mt-2 ${uiMuted}`}>
              Si renseignée, adresse géocodable en France (numéro, rue, code postal, ville).
            </p>
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
        subtitle="Importez votre carte ou vos fiches recettes : l'IA propose plats et ingrédients, rien n'est enregistré sans votre validation."
        title="Import intelligent (optionnel)"
      >
        <div className="space-y-2">
          <OptionalMenuPhotosPicker files={menuFiles} onChange={setMenuFiles} disabled={loading} />
          <OptionalMenuPhotosPicker
            cameraLabel="Photographier une recette"
            description="Ajoutez des fiches recettes, cahiers de cuisine ou notes manuscrites (images ou PDF). L'IA proposera ingrédients et quantités par portion."
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
            : "Créer mon restaurant"}
      </button>
    </form>
  );
}
