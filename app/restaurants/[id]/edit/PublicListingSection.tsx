"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Clock, Globe, MapPin, ShieldCheck, Upload, UtensilsCrossed } from "lucide-react";
import {
  updateRestaurantPublicProfile,
  uploadRestaurantPublicPhotoAction,
} from "@/app/restaurants/actions";
import type { RestaurantPublicProfile } from "@/lib/public/publicDb";
import type { PublicListingPreview } from "@/lib/public/publicListingPreview";

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
    <div className="flex gap-3 rounded-md border border-stone-200 bg-white px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
        <p className="text-sm text-stone-800">{value}</p>
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
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <p className="text-sm font-medium text-stone-800">{label}</p>
      <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative h-24 w-full overflow-hidden rounded-lg bg-stone-100 sm:h-20 sm:w-32">
          {currentUrl ? (
            <Image src={currentUrl} alt="" fill className="object-cover" sizes="128px" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-400">Aucune photo</div>
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
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
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
    ? `${preview.hygiene_label} · ${preview.hygiene_score_live}/100 (7 derniers jours)`
    : preview.hygiene_label;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-4 rounded-lg border border-orange-200 bg-orange-50/40 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
          <Globe className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Portail public (clients)</h2>
          <p className="mt-1 text-xs text-stone-600">
            Les informations ci-dessous proviennent de votre ERP. Seule la description et les photos sont
            spécifiques au portail client.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Fiche publique enregistrée.
        </p>
      ) : null}

      <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Synchronisé depuis l&apos;ERP
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SyncedInfoRow icon={MapPin} label="Adresse" value={preview.address} />
          <SyncedInfoRow icon={UtensilsCrossed} label="Type d'activité" value={preview.cuisine_type} />
          <SyncedInfoRow icon={Clock} label="Horaires d'ouverture" value={preview.opening_hours} />
          <SyncedInfoRow icon={ShieldCheck} label="Score hygiène (live)" value={hygieneDisplay} />
        </div>
        <p className="text-[0.65rem] leading-relaxed text-emerald-900/80">{preview.hygiene_detail}</p>
        <p className="text-[0.65rem] text-stone-500">
          Modifiez l&apos;adresse dans le formulaire ci-dessus, les horaires dans la section Planning, et le
          score se met à jour automatiquement depuis le module Hygiène.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-orange-200 bg-white p-3">
        <input
          type="checkbox"
          checked={isPublicListed}
          onChange={(e) => setIsPublicListed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
        />
        <span>
          <span className="block text-sm font-semibold text-stone-900">
            Afficher ce restaurant sur l&apos;espace public
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Visible dans l&apos;annuaire et accessible via /restaurant/[id].
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="publicDescription" className="mb-1 block text-sm font-medium text-stone-700">
          Description publique (optionnelle)
        </label>
        <textarea
          id="publicDescription"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Présentation courte pour les clients…"
          className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900"
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-orange-600 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {loading ? "Enregistrement…" : "Enregistrer la visibilité et la description"}
      </button>
    </form>
  );
}
