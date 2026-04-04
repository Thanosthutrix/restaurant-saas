"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitOnboardingFormData } from "./actions";
import { OptionalMenuPhotosPicker } from "@/components/restaurant/OptionalMenuPhotosPicker";
import {
  PENDING_ONBOARDING_MENU_KEY,
  type PendingOnboardingMenuStored,
} from "@/lib/onboardingPendingMenuStorage";
import { RESTAURANT_PROFILE_OTHER, type RestaurantTemplate } from "@/lib/templates/restaurantTemplates";
import {
  uiBtnPrimaryBlock,
  uiError,
  uiFormLabel,
  uiInputBlock,
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
  const [avgCovers, setAvgCovers] = useState("");
  const [serviceType, setServiceType] = useState("both");
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
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
    fd.append("avg_covers", avgCovers);
    fd.append("service_type", serviceType);
    if (menuFiles.length > 0) {
      fd.append("menu_image_count", String(menuFiles.length));
    }
    for (const f of menuFiles) {
      fd.append("menu_image", f);
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
    if (menuFiles.length === 0) {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className={uiError}>{error}</p>}
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
      <div>
        <label htmlFor="profile" className={uiFormLabel}>
          Type d&apos;établissement et modèle de départ
        </label>
        <select
          id="profile"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className={uiSelectBlock}
        >
          {templates.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name} — {t.components.length} composants, {t.suggestedDishes.length} plats suggérés
            </option>
          ))}
          <option value={RESTAURANT_PROFILE_OTHER}>Autre — aucun modèle (vous remplirez vous-même)</option>
        </select>
        {selectedTemplate ? (
          <p className={`mt-1 ${uiMuted}`}>{selectedTemplate.description}</p>
        ) : (
          <p className={`mt-1 ${uiMuted}`}>
            Aucun composant ni plat prérempli. Vous pourrez tout ajouter depuis l&apos;application.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="avgCovers" className={uiFormLabel}>
          Nombre moyen de couverts / jour
        </label>
        <input
          id="avgCovers"
          type="number"
          min={1}
          value={avgCovers}
          onChange={(e) => setAvgCovers(e.target.value)}
          placeholder="50"
          className={uiInputBlock}
        />
      </div>
      <div>
        <label className={uiFormLabel}>Type de service</label>
        <select
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

      <OptionalMenuPhotosPicker files={menuFiles} onChange={setMenuFiles} disabled={loading} />

      <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
        {loading
          ? menuFiles.length > 0
            ? "Création et analyse…"
            : "Création…"
          : menuFiles.length > 0
            ? "Créer et analyser la carte"
            : "Créer mon restaurant"}
      </button>
    </form>
  );
}
