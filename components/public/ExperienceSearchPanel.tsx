"use client";

import { useState, useTransition } from "react";
import { Compass, MessageSquare, Sparkles } from "lucide-react";
import { guidedSearchAction } from "@/app/restaurants/experience/actions";
import {
  CLIENT_INTENTS,
  CLIENT_INTENT_LABELS,
  NOISE_LEVELS,
  NOISE_LEVEL_LABELS,
  PRICE_TIERS,
  PRICE_TIER_LABELS,
  type ClientIntent,
  type NoiseLevel,
  type PriceTier,
} from "@/lib/b2c/experience/taxonomy";
import type { ConsumerSearchPreferences } from "@/lib/b2c/experience/consumerPreferencesDb";
import type { Restaurant } from "@/lib/public/types";
import { uiBtnPrimary, uiBtnSecondary, uiError, uiInput, uiLabel } from "@/components/ui/premium";

type MatchRow = {
  restaurantId: string;
  affinityPct: number;
  reasons: string[];
};

type Props = {
  restaurants: Restaurant[];
  onHighlightIds: (ids: string[]) => void;
  initialPrefs?: ConsumerSearchPreferences | null;
  isLoggedIn?: boolean;
};

export function ExperienceSearchPanel({
  restaurants,
  onHighlightIds,
  initialPrefs,
  isLoggedIn,
}: Props) {
  const [mode, setMode] = useState<"natural" | "guided">("natural");
  const [naturalQuery, setNaturalQuery] = useState("");
  const [guidedStep, setGuidedStep] = useState(0);
  const [intent, setIntent] = useState<ClientIntent>(
    initialPrefs?.default_intent ?? "casual_friends"
  );
  const [noise, setNoise] = useState<NoiseLevel | null>(initialPrefs?.preferred_noise_level ?? null);
  const [price, setPrice] = useState<PriceTier | null>(initialPrefs?.max_price_tier ?? null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const restaurantById = new Map(restaurants.map((r) => [r.id, r]));

  const applyMatches = (rows: MatchRow[], sum?: string | null) => {
    setMatches(rows);
    setSummary(sum ?? null);
    onHighlightIds(rows.map((m) => m.restaurantId));
  };

  const runNatural = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/public/search/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: naturalQuery }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Recherche impossible.");
        applyMatches([]);
        return;
      }
      applyMatches(data.matches ?? [], data.summary);
    });
  };

  const runGuided = () => {
    setError(null);
    startTransition(async () => {
      const res = await guidedSearchAction({
        intent,
        noiseLevel: noise,
        priceTier: price,
      });
      if (!res.ok) {
        setError(res.error);
        applyMatches([]);
        return;
      }
      applyMatches(res.data?.matches ?? [], "Résultats selon vos critères");
    });
  };

  return (
    <section className="rounded-2xl border border-orange-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-orange-50/50"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-stone-900">Recherche par envie</span>
            <span className="block text-xs text-stone-500">
              Décrivez votre envie ou laissez-vous guider
            </span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-orange-700">
          {expanded ? "Replier" : "Ouvrir"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-orange-100/80 px-4 pb-4 pt-3">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("natural")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "natural" ? "bg-orange-100 text-orange-900" : "text-stone-600 hover:bg-stone-50"
          }`}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          Exprime ton envie
        </button>
        <button
          type="button"
          onClick={() => setMode("guided")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "guided" ? "bg-orange-100 text-orange-900" : "text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Compass className="h-4 w-4" aria-hidden />
          Guide-moi
        </button>
      </div>

      {mode === "natural" ? (
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Décrivez votre envie</span>
            <input
              type="text"
              value={naturalQuery}
              onChange={(e) => setNaturalQuery(e.target.value)}
              placeholder="Ex. endroit calme ce soir, ~50€/pers, bon vin"
              className={uiInput}
            />
          </label>
          <button type="button" className={uiBtnPrimary} onClick={runNatural} disabled={pending || !naturalQuery.trim()}>
            <Sparkles className="mr-1.5 inline h-4 w-4" aria-hidden />
            {pending ? "Recherche…" : "Rechercher avec l'IA"}
          </button>
          <p className="text-xs text-stone-500">5 recherches IA max / 24 h — sinon utilisez « Guide-moi ».</p>
          {isLoggedIn ? (
            <p className="text-xs text-violet-700">
              Vos exclusions de compte sont appliquées automatiquement.
            </p>
          ) : (
            <p className="text-xs text-stone-500">
              <a href="/compte/connexion?next=/" className="font-semibold text-orange-600 hover:underline">
                Connectez-vous
              </a>{" "}
              pour mémoriser vos envies et exclusions.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {guidedStep === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {CLIENT_INTENTS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntent(i)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                    intent === i ? "border-orange-400 bg-orange-50" : "border-stone-200"
                  }`}
                >
                  {CLIENT_INTENT_LABELS[i]}
                </button>
              ))}
            </div>
          ) : guidedStep === 1 ? (
            <div className="flex flex-col gap-2">
              {NOISE_LEVELS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNoise(noise === n ? null : n)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    noise === n ? "border-orange-400 bg-orange-50" : "border-stone-200"
                  }`}
                >
                  {NOISE_LEVEL_LABELS[n]}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {PRICE_TIERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrice(price === p ? null : p)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    price === p ? "border-orange-400 bg-orange-50" : "border-stone-200"
                  }`}
                >
                  {PRICE_TIER_LABELS[p]}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className={uiBtnSecondary}
              onClick={() => setGuidedStep(Math.max(0, guidedStep - 1))}
              disabled={guidedStep === 0}
            >
              Retour
            </button>
            {guidedStep < 2 ? (
              <button type="button" className={uiBtnPrimary} onClick={() => setGuidedStep(guidedStep + 1)}>
                Suivant
              </button>
            ) : (
              <button type="button" className={uiBtnPrimary} onClick={runGuided} disabled={pending}>
                {pending ? "Calcul…" : "Voir les résultats"}
              </button>
            )}
          </div>
        </div>
      )}

      {error ? <p className={`mt-3 ${uiError}`}>{error}</p> : null}

      {summary && matches.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
          <p className="text-sm font-medium text-stone-800">{summary}</p>
          <ul className="space-y-2">
            {matches.map((m) => {
              const r = restaurantById.get(m.restaurantId);
              if (!r) return null;
              return (
                <li
                  key={m.restaurantId}
                  className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-stone-900">{r.name}</span>
                  <span className="ml-2 text-orange-700">{m.affinityPct} % d&apos;affinité</span>
                  {m.reasons.length ? (
                    <p className="mt-0.5 text-xs text-stone-600">{m.reasons.join(" · ")}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {matches.length === 0 && summary ? (
        <p className="mt-3 text-sm text-stone-600">
          Aucun restaurant correspondant pour l&apos;instant. Les établissements partenaires doivent compléter leur
          fiche « Mon expérience ».
        </p>
      ) : null}
        </div>
      ) : null}
    </section>
  );
}
