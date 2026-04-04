"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyTemplateSuggestions } from "../../actions";
import type { TemplateSuggestions } from "../../actions";

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
      parts.length > 0
        ? parts.join(". ")
        : "Aucun élément à ajouter (tous sont déjà présents).";
    setMessage({ type: "success", text });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-700">
        Suggestions du template
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Éléments du modèle qui ne sont pas encore dans votre restaurant. Le bouton ci-dessous les crée sans toucher aux existants.
      </p>

      {missingComponents.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-xs font-medium text-slate-500">
            Composants manquants ({missingComponents.length})
          </h3>
          <ul className="max-h-40 list-inside list-disc overflow-y-auto text-sm text-slate-700">
            {missingComponents.map((c) => (
              <li key={c.name}>
                {c.name} <span className="text-slate-400">({c.unit}, {c.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {missingDishes.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-xs font-medium text-slate-500">
            Plats manquants ({missingDishes.length})
          </h3>
          <ul className="max-h-32 list-inside list-disc overflow-y-auto text-sm text-slate-700">
            {missingDishes.map((d) => (
              <li key={d.name}>
                {d.name} <span className="text-slate-400">({d.production_mode === "resale" ? "revente" : "préparé"})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasSuggestions && (
        <p className="mb-3 text-sm text-slate-500">
          Tous les composants et plats suggérés par le template sont déjà présents.
        </p>
      )}

      {message && (
        <p className={`mb-3 text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleApply}
        disabled={loading}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Application…" : "Appliquer les suggestions du template"}
      </button>
    </div>
  );
}
