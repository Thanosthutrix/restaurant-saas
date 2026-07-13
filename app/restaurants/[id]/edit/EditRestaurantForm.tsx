"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail } from "lucide-react";
import { updateRestaurant } from "../../actions";
import type { Restaurant } from "@/lib/auth";
import type { RestaurantTemplate } from "@/lib/templates/restaurantTemplates";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import {
  uiBtnPrimaryBlock,
  uiCardMuted,
  uiError,
  uiFormLabel,
  uiInputBlock,
  uiLead,
  uiSelectBlock,
} from "@/components/ui/premium";

const SERVICE_TYPES = [
  { value: "lunch", label: "Déjeuner" },
  { value: "dinner", label: "Dîner" },
  { value: "both", label: "Déjeuner et dîner" },
];

type ZoneChoice = "auto" | "A" | "B" | "C";

function initialZoneChoice(r: Restaurant): ZoneChoice {
  if (r.school_zone_is_manual && r.school_zone) return r.school_zone;
  return "auto";
}

export function EditRestaurantForm({
  restaurant,
  templates,
}: {
  restaurant: Restaurant;
  templates: RestaurantTemplate[];
}) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [messagingSenderDisplayName, setMessagingSenderDisplayName] = useState(
    restaurant.messaging_sender_display_name ?? ""
  );
  const [templateSlug, setTemplateSlug] = useState(restaurant.template_slug ?? "");
  const [serviceType, setServiceType] = useState(restaurant.service_type || "both");
  const [addressText, setAddressText] = useState(restaurant.address_text ?? "");
  const [zoneChoice, setZoneChoice] = useState<ZoneChoice>(initialZoneChoice(restaurant));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateRestaurant(restaurant.id, {
      name: name.trim(),
      messaging_sender_display_name: messagingSenderDisplayName.trim() || null,
      template_slug: templateSlug.trim() || null,
      service_type: serviceType,
      address_text: addressText.trim() || null,
      school_zone: zoneChoice === "auto" ? null : zoneChoice,
      school_zone_is_manual: zoneChoice !== "auto",
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <EstablishmentSection
      icon={Building2}
      title="Identité de l'établissement"
      subtitle="Nom, adresse, modèle d'activité et paramètres utilisés sur le portail public, la météo et le planning."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <p className={uiError}>{error}</p> : null}

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

        <div id="messagerie-expediteur" className={`scroll-mt-6 ${uiCardMuted}`}>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
            <Mail className="h-4 w-4 text-copper-600" aria-hidden />
            E-mails clients
          </p>
          <label htmlFor="messagingSender" className={uiFormLabel}>
            Nom d&apos;expéditeur
          </label>
          <input
            id="messagingSender"
            type="text"
            value={messagingSenderDisplayName}
            onChange={(e) => setMessagingSenderDisplayName(e.target.value)}
            placeholder={name.trim() || "Le Bistrot"}
            className={uiInputBlock}
          />
          <p className={`mt-2 ${uiLead}`}>
            Libellé affiché dans la boîte du destinataire. Laisser vide pour utiliser le nom du
            restaurant.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="templateSlug" className={uiFormLabel}>
              Modèle / type d&apos;activité
            </label>
            <select
              id="templateSlug"
              value={templateSlug}
              onChange={(e) => setTemplateSlug(e.target.value)}
              className={uiSelectBlock}
            >
              <option value="">Aucun modèle</option>
              {templates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
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

        <div className={uiCardMuted}>
          <p className="mb-1 text-sm font-semibold text-stone-800">Calendrier et contexte</p>
          <p className={`mb-4 ${uiLead}`}>
            Adresse pour la géolocalisation, la météo et la zone de vacances scolaires (automatique
            ou forcée A / B / C).
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className={uiFormLabel}>
                Adresse
              </label>
              <textarea
                id="address"
                rows={3}
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="12 rue de la Paix, 75002 Paris"
                className={uiInputBlock}
              />
            </div>
            <div>
              <label htmlFor="zone" className={uiFormLabel}>
                Zone vacances scolaires
              </label>
              <select
                id="zone"
                value={zoneChoice}
                onChange={(e) => setZoneChoice(e.target.value as ZoneChoice)}
                className={uiSelectBlock}
              >
                <option value="auto">Automatique (selon l&apos;adresse)</option>
                <option value="A">Zone A (manuel)</option>
                <option value="B">Zone B (manuel)</option>
                <option value="C">Zone C (manuel)</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
          {loading ? "Enregistrement…" : "Enregistrer l'établissement"}
        </button>
      </form>
    </EstablishmentSection>
  );
}
