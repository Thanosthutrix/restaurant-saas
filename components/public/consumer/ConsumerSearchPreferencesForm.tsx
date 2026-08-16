"use client";

import { useState, useTransition } from "react";
import { saveConsumerSearchPreferencesAction } from "@/app/compte/actions";
import type { ConsumerSearchPreferences } from "@/lib/b2c/experience/consumerPreferencesDb";
import {
  CLIENT_INTENTS,
  CLIENT_INTENT_LABELS,
  ESTABLISHMENT_TYPE_DEFS,
  NOISE_LEVELS,
  NOISE_LEVEL_LABELS,
  PRICE_TIERS,
  PRICE_TIER_LABELS,
  OCCASION_TAGS,
  OCCASION_LABELS,
  type ClientIntent,
  type EstablishmentType,
  type NoiseLevel,
  type PriceTier,
  type OccasionTag,
} from "@/lib/b2c/experience/taxonomy";
import { uiBtnPrimary, uiError, uiLabel } from "@/components/ui/premium";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
        selected
          ? "border-orange-400 bg-orange-50 text-orange-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export function ConsumerSearchPreferencesForm({
  initial,
}: {
  initial: ConsumerSearchPreferences | null;
}) {
  const [excluded, setExcluded] = useState<EstablishmentType[]>(initial?.excluded_establishment_types ?? []);
  const [defaultIntent, setDefaultIntent] = useState<ClientIntent | null>(initial?.default_intent ?? null);
  const [noise, setNoise] = useState<NoiseLevel | null>(initial?.preferred_noise_level ?? null);
  const [maxPrice, setMaxPrice] = useState<PriceTier | null>(initial?.max_price_tier ?? null);
  const [occasions, setOccasions] = useState<OccasionTag[]>(initial?.preferred_occasions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleExcluded = (t: EstablishmentType) => {
    setExcluded((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const toggleOccasion = (o: OccasionTag) => {
    setOccasions((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveConsumerSearchPreferencesAction({
        excludedEstablishmentTypes: excluded,
        defaultIntent,
        preferredNoiseLevel: noise,
        minPriceTier: null,
        maxPriceTier: maxPrice,
        preferredOccasions: occasions,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Ces préférences filtrent les résultats de recherche — un type exclu ne vous sera jamais proposé, même bien noté.
      </p>

      <div>
        <span className={uiLabel}>Je ne veux pas voir…</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ESTABLISHMENT_TYPE_DEFS.filter((t) =>
            ["fast_food", "snack", "kebab", "speakeasy"].includes(t.value)
          ).map((t) => (
            <Chip key={t.value} selected={excluded.includes(t.value)} onClick={() => toggleExcluded(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className={uiLabel}>Envie par défaut</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CLIENT_INTENTS.map((i) => (
            <Chip
              key={i}
              selected={defaultIntent === i}
              onClick={() => setDefaultIntent(defaultIntent === i ? null : i)}
            >
              {CLIENT_INTENT_LABELS[i]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className={uiLabel}>Ambiance préférée</span>
        <div className="mt-2 flex flex-col gap-2">
          {NOISE_LEVELS.map((n) => (
            <Chip key={n} selected={noise === n} onClick={() => setNoise(noise === n ? null : n)}>
              {NOISE_LEVEL_LABELS[n]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className={uiLabel}>Budget max habituel</span>
        <div className="mt-2 flex flex-col gap-2">
          {PRICE_TIERS.map((p) => (
            <Chip key={p} selected={maxPrice === p} onClick={() => setMaxPrice(maxPrice === p ? null : p)}>
              {PRICE_TIER_LABELS[p]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className={uiLabel}>Occasions favorites</span>
        <div className="mt-2 grid gap-2">
          {OCCASION_TAGS.map((o) => (
            <Chip key={o} selected={occasions.includes(o)} onClick={() => toggleOccasion(o)}>
              {OCCASION_LABELS[o]}
            </Chip>
          ))}
        </div>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}
      {saved ? <p className="text-sm font-medium text-emerald-700">Préférences enregistrées.</p> : null}

      <button type="button" className={uiBtnPrimary} onClick={save} disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer mes préférences"}
      </button>
    </div>
  );
}
