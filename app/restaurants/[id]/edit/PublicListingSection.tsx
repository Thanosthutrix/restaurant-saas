"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Clock, Globe, MapPin, ShieldCheck, Upload, UtensilsCrossed } from "lucide-react";
import {
  updateRestaurantPublicProfile,
  uploadRestaurantPublicPhotoAction,
} from "@/app/restaurants/actions";
import { EstablishmentSection } from "@/components/restaurant/EstablishmentSection";
import type { RestaurantPublicProfile } from "@/lib/public/publicDb";
import type { PublicListingPreview } from "@/lib/public/publicListingPreview";
import {
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiCardMuted,
  uiError,
  uiFormLabel,
  uiInputBlock,
  uiLead,
  uiSuccess,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initial: RestaurantPublicProfile;
  preview: PublicListingPreview;
};

function SyncedInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-stone-200/70 bg-white px-3 py-2.5 shadow-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-copper-600" aria-hidden />
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
        <p className="text-sm font-medium text-stone-800">{value}</p>
      </div>
    </div>
  );
}

function PhotoUploadField({
  label,
  hint,
  currentUrl,
  onUpload,
  uploading,
}: {
  label: string;
  hint: string;
  currentUrl: string;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={uiCardMuted}>
      <p className="text-sm font-semibold text-stone-800">{label}</p>
      <p className={`mt-0.5 ${uiLead}`}>{hint}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative h-24 w-full overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200/70 sm:h-20 sm:w-32">
          {currentUrl ? (
            <Image src={currentUrl} alt="" fill className="object-cover" sizes="128px" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-400">
              Aucune photo
            </div>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {uploading ? "Envoi…" : "Charger une photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PublicListingSection({ restaurantId, initial, preview }: Props) {
  const [isPublicListed, setIsPublicListed] = useState(initial.is_public_listed);
  const [showPublicHygieneScore, setShowPublicHygieneScore] = useState(
    initial.show_public_hygiene_score
  );
  const [description, setDescription] = useState(initial.description);
  const [imageUrl, setImageUrl] = useState(initial.image_url);
  const [coverUrl, setCoverUrl] = useState(initial.cover_url);
  const [loading, setLoading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function uploadPhoto(kind: "thumb" | "cover", file: File) {
    setError(null);
    setSaved(false);
    if (kind === "thumb") setUploadingThumb(true);
    else setUploadingCover(true);

    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const result = await uploadRestaurantPublicPhotoAction(restaurantId, fd);

    if (kind === "thumb") setUploadingThumb(false);
    else setUploadingCover(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.url) {
      if (kind === "thumb") setImageUrl(result.url);
      else setCoverUrl(result.url);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const result = await updateRestaurantPublicProfile(restaurantId, {
      is_public_listed: isPublicListed,
      show_public_hygiene_score: showPublicHygieneScore,
      description: description.trim(),
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  const hygieneDisplay = preview.hygiene_has_live_data
    ? `${preview.hygiene_label} · ${preview.hygiene_score_live}/100 (7 jours)`
    : preview.hygiene_label;

  return (
    <EstablishmentSection
      icon={Globe}
      iconTone="bg-orange-50 text-orange-700 ring-orange-100"
      title="Portail public (clients)"
      subtitle="Visibilité annuaire, description marketing et photos. Les horaires et l'adresse sont synchronisés depuis cette fiche ERP."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <p className={uiError}>{error}</p> : null}
        {saved ? <p className={uiSuccess}>Fiche publique enregistrée.</p> : null}

        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Synchronisé depuis l&apos;ERP
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <SyncedInfoRow icon={MapPin} label="Adresse" value={preview.address} />
            <SyncedInfoRow icon={UtensilsCrossed} label="Type d'activité" value={preview.cuisine_type} />
            <SyncedInfoRow icon={Clock} label="Horaires d'ouverture" value={preview.opening_hours} />
            <SyncedInfoRow icon={ShieldCheck} label="Score hygiène (live)" value={hygieneDisplay} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-emerald-900/75">{preview.hygiene_detail}</p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200/60 bg-white/90 p-3 shadow-sm">
            <input
              type="checkbox"
              checked={showPublicHygieneScore}
              onChange={(e) => setShowPublicHygieneScore(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="block text-sm font-semibold text-stone-900">
                Afficher le score hygiène sur la fiche publique
              </span>
              <span className={`mt-0.5 block ${uiLead}`}>
                Masquable côté client ; le suivi hygiène ERP reste actif en interne.
              </span>
            </span>
          </label>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200/70 bg-white p-4 shadow-sm">
          <input
            type="checkbox"
            checked={isPublicListed}
            onChange={(e) => setIsPublicListed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-copper-600 focus:ring-copper-500"
          />
          <span>
            <span className="block text-sm font-semibold text-stone-900">
              Afficher ce restaurant sur l&apos;espace public
            </span>
            <span className={`mt-0.5 block ${uiLead}`}>
              Visible dans l&apos;annuaire ubion.fr et via /restaurant/[id].
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="publicDescription" className={uiFormLabel}>
            Description publique (optionnelle)
          </label>
          <textarea
            id="publicDescription"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Présentation courte pour les clients…"
            className={uiInputBlock}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoUploadField
            label="Photo vignette (annuaire)"
            hint="JPEG, PNG ou WebP · max. 12 Mo"
            currentUrl={imageUrl}
            uploading={uploadingThumb}
            onUpload={(file) => uploadPhoto("thumb", file)}
          />
          <PhotoUploadField
            label="Photo de couverture (fiche restaurant)"
            hint="JPEG, PNG ou WebP · max. 12 Mo"
            currentUrl={coverUrl}
            uploading={uploadingCover}
            onUpload={(file) => uploadPhoto("cover", file)}
          />
        </div>

        <button type="submit" disabled={loading} className={uiBtnPrimaryBlock}>
          {loading ? "Enregistrement…" : "Enregistrer la fiche publique"}
        </button>
      </form>
    </EstablishmentSection>
  );
}
