"use client";

import { useRef, useState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { publishCommunicationPostAction } from "@/app/communication/actions";
import type { SocialContentType, SocialPlatform } from "@/lib/meta/socialPostsDb";
import {
  uiBtnPrimary,
  uiCard,
  uiError,
  uiFormLabel,
  uiInputBlock,
  uiLead,
  uiSelect,
  uiSuccess,
  uiInput,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  instagramConnected: boolean;
  facebookConnected: boolean;
  onPublished: () => void;
};

const PLATFORM_OPTIONS: { value: SocialPlatform; label: string; disabled?: boolean }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
];

const CONTENT_OPTIONS: { value: SocialContentType; label: string; platforms: SocialPlatform[] }[] = [
  { value: "feed", label: "Post fil", platforms: ["instagram", "facebook"] },
  { value: "story", label: "Story Instagram", platforms: ["instagram"] },
  { value: "reel", label: "Reel Instagram", platforms: ["instagram"] },
];

export function PublishComposer({
  restaurantId,
  instagramConnected,
  facebookConnected,
  onPublished,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [contentType, setContentType] = useState<SocialContentType>("feed");
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const contentOptions = CONTENT_OPTIONS.filter((opt) => opt.platforms.includes(platform));

  function handlePlatformChange(next: SocialPlatform) {
    setPlatform(next);
    const allowed = CONTENT_OPTIONS.filter((opt) => opt.platforms.includes(next));
    if (!allowed.some((opt) => opt.value === contentType)) {
      setContentType(allowed[0]?.value ?? "feed");
    }
  }

  function handleFileChange(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Ajoutez une image à publier.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("restaurantId", restaurantId);
    formData.set("platform", platform);
    formData.set("contentType", contentType);
    formData.set("caption", caption);
    formData.set("image", file);

    const result = await publishCommunicationPostAction(formData);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(
      result.data?.permalink
        ? "Contenu publié — ouverture du lien dans un nouvel onglet possible depuis Contenus."
        : "Contenu publié."
    );
    setCaption("");
    handleFileChange(null);
    if (fileRef.current) fileRef.current.value = "";
    onPublished();
  }

  const canPublish =
    (platform === "instagram" && instagramConnected) ||
    (platform === "facebook" && facebookConnected);

  return (
    <form onSubmit={handleSubmit} className={`${uiCard} space-y-5 p-5 sm:p-6`}>
      <div>
        <h2 className="text-base font-semibold text-stone-900">Publier un contenu</h2>
        <p className={`mt-1 ${uiLead}`}>
          Image JPEG, PNG ou WebP (max. 12 Mo). La publication part directement sur le réseau
          sélectionné.
        </p>
      </div>

      {!instagramConnected && !facebookConnected ? (
        <p className={uiError}>
          Connectez d&apos;abord vos comptes Meta dans l&apos;onglet Comptes.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="publish-platform" className={uiFormLabel}>
            Réseau
          </label>
          <select
            id="publish-platform"
            value={platform}
            onChange={(e) => handlePlatformChange(e.target.value as SocialPlatform)}
            className={`${uiSelect} w-full`}
            disabled={loading}
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={
                  (opt.value === "instagram" && !instagramConnected) ||
                  (opt.value === "facebook" && !facebookConnected)
                }
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="publish-type" className={uiFormLabel}>
            Type de contenu
          </label>
          <select
            id="publish-type"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as SocialContentType)}
            className={`${uiSelect} w-full`}
            disabled={loading}
          >
            {contentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="publish-caption" className={uiFormLabel}>
          {contentType === "story" ? "Texte (optionnel, non supporté sur story)" : "Légende / texte"}
        </label>
        <textarea
          id="publish-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className={`${uiInput} w-full`}
          placeholder={
            platform === "facebook"
              ? "Annonce, menu du jour, événement…"
              : "Légende Instagram, hashtags…"
          }
          disabled={loading || contentType === "story"}
        />
      </div>

      <div>
        <label className={uiFormLabel}>Image</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-8 text-sm text-stone-600 transition hover:border-copper-300 hover:bg-copper-50/40"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="max-h-48 rounded-xl object-contain" />
          ) : (
            <>
              <ImagePlus className="h-8 w-8 text-stone-400" aria-hidden />
              Choisir une image
            </>
          )}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading || !canPublish || !file}
        className={`inline-flex items-center gap-2 ${uiBtnPrimary}`}
      >
        <Send className="h-4 w-4" aria-hidden />
        {loading ? "Publication…" : "Publier maintenant"}
      </button>

      {error ? <p className={uiError}>{error}</p> : null}
      {success ? <p className={uiSuccess}>{success}</p> : null}
    </form>
  );
}
