"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import {
  saveExperienceProfileAction,
  fetchExperienceProfileAction,
} from "@/app/restaurants/experience/actions";
import {
  ESTABLISHMENT_TYPE_DEFS,
  NOISE_LEVELS,
  NOISE_LEVEL_LABELS,
  OCCASION_TAGS,
  OCCASION_LABELS,
  PRICE_TIERS,
  PRICE_TIER_LABELS,
  VENUE_FEATURE_TAGS,
  VENUE_FEATURE_LABELS,
  type EstablishmentType,
  type PriceTier,
  ESTABLISHMENT_TYPE_BY_VALUE,
} from "@/lib/b2c/experience/taxonomy";
import {
  uiBtnPrimary,
  uiBtnSecondary,
  uiError,
  uiInput,
  uiLabel,
  uiLead,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const STEPS = ["Catégorisation", "Ambiance & cadre", "Votre histoire"] as const;

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
          ? "border-copper-400 bg-copper-50 text-copper-900 ring-1 ring-copper-200"
          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
      }`}
    >
      {children}
    </button>
  );
}

export function ExperienceProfileModal({ restaurantId, open, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [establishmentType, setEstablishmentType] = useState<EstablishmentType>("bistro_brasserie");
  const [priceTier, setPriceTier] = useState<PriceTier>("euro_2");
  const [noiseLevel, setNoiseLevel] = useState<string | null>(null);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [venueFeatures, setVenueFeatures] = useState<string[]>([]);
  const [experienceSummary, setExperienceSummary] = useState("");
  const [signatureDish, setSignatureDish] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    setLoading(true);
    void fetchExperienceProfileAction(restaurantId).then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        const p = res.data;
        setEstablishmentType(p.establishment_type);
        setPriceTier(p.price_tier);
        setNoiseLevel(p.noise_level);
        setOccasions(p.occasions);
        setVenueFeatures(p.venue_features);
        setExperienceSummary(p.experience_summary ?? "");
        setSignatureDish(p.signature_dish ?? "");
      }
    });
  }, [open, restaurantId]);

  const allowedPriceTiers = ESTABLISHMENT_TYPE_BY_VALUE[establishmentType].allowedPriceTiers;

  useEffect(() => {
    if (!allowedPriceTiers.includes(priceTier)) {
      setPriceTier(allowedPriceTiers[0]!);
    }
  }, [establishmentType, allowedPriceTiers, priceTier]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveExperienceProfileAction({
        restaurantId,
        establishmentType,
        priceTier,
        noiseLevel,
        occasions,
        venueFeatures,
        experienceSummary,
        signatureDish,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved?.();
      onClose();
    });
  };

  if (!open) return null;

  return (
    <ModalOverlay ariaLabel="Mon expérience" onClose={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-100">
            <Sparkles className="h-5 w-5 text-violet-700" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-stone-900">Mon expérience</h2>
            <p className={uiLead}>
              Étape {step + 1}/{STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <>
              {error ? <p className={`mb-3 ${uiError}`}>{error}</p> : null}

              {step === 0 ? (
                <div className="space-y-4">
                  <div>
                    <span className={uiLabel}>Type d&apos;établissement</span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {ESTABLISHMENT_TYPE_DEFS.map((t) => (
                        <Chip
                          key={t.value}
                          selected={establishmentType === t.value}
                          onClick={() => setEstablishmentType(t.value)}
                        >
                          {t.label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className={uiLabel}>Ticket moyen réel estimé</span>
                    <div className="mt-2 flex flex-col gap-2">
                      {PRICE_TIERS.filter((t) => allowedPriceTiers.includes(t)).map((t) => (
                        <Chip key={t} selected={priceTier === t} onClick={() => setPriceTier(t)}>
                          {PRICE_TIER_LABELS[t]}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <span className={uiLabel}>Niveau sonore habituel</span>
                    <div className="mt-2 flex flex-col gap-2">
                      {NOISE_LEVELS.map((n) => (
                        <Chip
                          key={n}
                          selected={noiseLevel === n}
                          onClick={() => setNoiseLevel(noiseLevel === n ? null : n)}
                        >
                          {NOISE_LEVEL_LABELS[n]}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className={uiLabel}>Pour quelles occasions ?</span>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {OCCASION_TAGS.map((o) => (
                        <Chip
                          key={o}
                          selected={occasions.includes(o)}
                          onClick={() => toggle(occasions, setOccasions, o)}
                        >
                          {OCCASION_LABELS[o]}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className={uiLabel}>Atouts du lieu</span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {VENUE_FEATURE_TAGS.map((f) => (
                        <Chip
                          key={f}
                          selected={venueFeatures.includes(f)}
                          onClick={() => toggle(venueFeatures, setVenueFeatures, f)}
                        >
                          {VENUE_FEATURE_LABELS[f]}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-1">
                    <span className={uiLabel}>
                      Résumez l&apos;expérience que vous voulez faire vivre (2 phrases)
                    </span>
                    <textarea
                      value={experienceSummary}
                      onChange={(e) => setExperienceSummary(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      className={`${uiInput} min-h-[6rem] w-full resize-y py-2`}
                      placeholder="Ex. Une table conviviale où l'on prend le temps de savourer des produits locaux…"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={uiLabel}>Votre spécialité phare du moment</span>
                    <input
                      type="text"
                      value={signatureDish}
                      onChange={(e) => setSignatureDish(e.target.value)}
                      maxLength={500}
                      className={uiInput}
                      placeholder="Ex. Magret de canard au miel de lavande"
                    />
                  </label>
                  <p className="text-xs text-stone-500">
                    Ces textes enrichissent la recherche client. Le type d&apos;établissement reste le plafond
                    strict — un fast-food ne pourra pas apparaître en recherche gastronomique.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-stone-100 px-4 py-3">
          <button
            type="button"
            className={uiBtnSecondary}
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            disabled={pending}
          >
            {step > 0 ? "Retour" : "Annuler"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className={uiBtnPrimary} onClick={() => setStep(step + 1)} disabled={loading}>
              Suivant
            </button>
          ) : (
            <button type="button" className={uiBtnPrimary} onClick={submit} disabled={pending || loading}>
              {pending ? "Enregistrement…" : "Enregistrer mon expérience"}
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
