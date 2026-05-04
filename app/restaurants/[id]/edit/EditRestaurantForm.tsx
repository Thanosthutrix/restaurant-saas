"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRestaurant } from "../../actions";
import type { Restaurant } from "@/lib/auth";
import type { RestaurantTemplate } from "@/lib/templates/restaurantTemplates";

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
          className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
        />
      </div>
      <div
        id="messagerie-expediteur"
        className="scroll-mt-6 rounded-md border border-slate-100 bg-slate-50/80 p-3"
      >
        <p className="mb-2 text-sm font-semibold text-slate-800">E-mails clients</p>
        <label htmlFor="messagingSender" className="mb-1 block text-sm font-medium text-slate-700">
          Nom d’expéditeur
        </label>
        <input
          id="messagingSender"
          type="text"
          value={messagingSenderDisplayName}
          onChange={(e) => setMessagingSenderDisplayName(e.target.value)}
          placeholder={name.trim() || "Le Bistrot"}
          className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
        />
        <p className="mt-1 text-xs text-slate-500">
          Libellé affiché dans la boîte du destinataire (ex. « {name.trim() || "Votre restaurant"} » &lt;adresse
          d’envoi de la plateforme&gt;). Laisser vide pour utiliser le nom du restaurant ci-dessus.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Modèle / type d&apos;activité
        </label>
        <select
          value={templateSlug}
          onChange={(e) => setTemplateSlug(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
        >
          <option value="">Aucun modèle</option>
          {templates.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Utilisé pour les suggestions de plats et composants. Changer n&apos;écrase pas vos données.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Type de service
        </label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
        >
          {SERVICE_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="rounded border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">
          Calendrier et contexte (météo, vacances)
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Indiquez l&apos;adresse du restaurant (France). À l&apos;enregistrement, nous géocodons l&apos;adresse pour la
          météo. En mode automatique, la zone de vacances scolaires est déduite du département ; vous pouvez
          forcer A, B ou C si besoin.
        </p>
        <div className="mb-3">
          <label htmlFor="address" className="mb-1 block text-xs text-slate-600">
            Adresse
          </label>
          <textarea
            id="address"
            rows={3}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="12 rue de la Paix, 75002 Paris"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="zone" className="mb-1 block text-xs text-slate-600">
            Zone vacances scolaires
          </label>
          <select
            id="zone"
            value={zoneChoice}
            onChange={(e) => setZoneChoice(e.target.value as ZoneChoice)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="auto">Automatique (selon l&apos;adresse)</option>
            <option value="A">Zone A (manuel)</option>
            <option value="B">Zone B (manuel)</option>
            <option value="C">Zone C (manuel)</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
