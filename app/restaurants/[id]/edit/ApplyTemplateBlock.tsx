"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { applyTemplateSuggestions } from "../../actions";
import type { TemplateSuggestions } from "../../actions";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import {
  uiBtnPrimarySm,
  uiError,
  uiLead,
  uiSuccess,
} from "@/components/ui/premium";

export function ApplyTemplateBlock({
  restaurantId,
  templateSlug,
  suggestions,
}: {
  restaurantId: string;
  templateSlug: string | null;
  suggestions: TemplateSuggestions | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!templateSlug?.trim()) return null;

  const missingComponents = suggestions?.missingComponents ?? [];
  const missingDishes = suggestions?.missingDishes ?? [];
  const hasSuggestions = missingComponents.length > 0 || missingDishes.length > 0;

  async function handleApply() {
    setMessage(null);
    setLoading(true);
    const result = await applyTemplateSuggestions(restaurantId);
    setLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    const parts: string[] = [];
    if (result.added && result.added > 0) parts.push(`${result.added} composant(s) ajouté(s)`);
    if (result.addedDishes && result.addedDishes > 0) parts.push(`${result.addedDishes} plat(s) ajouté(s)`);
    const text =
      parts.length > 0 ? parts.join(". ") : "Aucun élément à ajouter (tous sont déjà présents).";
    setMessage({ type: "success", text });
    router.refresh();
  }

  return (
    <EstablishmentSection
      icon={Sparkles}
      iconTone="bg-amber-50 text-amber-800 ring-amber-100"
      title="Suggestions du template"
      subtitle="Composants et plats du modèle d'activité pas encore créés dans votre établissement."
    >
      {missingComponents.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Composants manquants ({missingComponents.length})
          </h3>
          <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-sm text-stone-700">
            {missingComponents.map((c) => (
              <li key={c.name}>
                {c.name}{" "}
                <span className="text-stone-400">
                  ({c.unit}, {c.type})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {missingDishes.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Plats manquants ({missingDishes.length})
          </h3>
          <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-sm text-stone-700">
            {missingDishes.map((d) => (
              <li key={d.name}>
                {d.name}{" "}
                <span className="text-stone-400">
                  ({d.production_mode === "resale" ? "revente" : "préparé"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasSuggestions && (
        <p className={`mb-4 ${uiLead}`}>
          Tous les composants et plats suggérés par le template sont déjà présents.
        </p>
      )}

      {message ? (
        <p className={`mb-4 ${message.type === "success" ? uiSuccess : uiError}`}>{message.text}</p>
      ) : null}

      <button type="button" onClick={handleApply} disabled={loading} className={uiBtnPrimarySm}>
        {loading ? "Application…" : "Appliquer les suggestions du template"}
      </button>
    </EstablishmentSection>
  );
}
