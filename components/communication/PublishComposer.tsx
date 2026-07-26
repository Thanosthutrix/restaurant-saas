"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Instagram, Send } from "lucide-react";
import { publishCommunicationPostAction } from "@/app/communication/actions";
import type { SocialContentType, SocialPlatform } from "@/lib/meta/socialPostsDb";
import {
  uiBtnPrimary,
  uiCard,
  uiError,
  uiFormLabel,
  uiInput,
  uiLead,
  uiSelect,
  uiSuccess,
  uiWarn,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  instagramConnected: boolean;
  facebookConnected: boolean;
  publishScopesEnabled: boolean;
  onPublished: () => void;
};

const CONTENT_OPTIONS: {
  value: SocialContentType;
  label: string;
  hint: string;
}[] = [
  { value: "feed", label: "Post fil", hint: "Instagram + Facebook" },
  { value: "story", label: "Story", hint: "Instagram + Facebook (story page)" },
  { value: "reel", label: "Reel Instagram", hint: "Facebook : republié en post fil si coché" },
];

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function platformLabel(platform: SocialPlatform): string {
  return platform === "instagram" ? "Instagram" : "Facebook";
}

export function PublishComposer({
  restaurantId,
  instagramConnected,
  facebookConnected,
  publishScopesEnabled,
  onPublished,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(() => {
    const initial: SocialPlatform[] = [];
    if (instagramConnected) initial.push("instagram");
    if (facebookConnected && !instagramConnected) initial.push("facebook");
    return initial;
  });
  const [contentType, setContentType] = useState<SocialContentType>("feed");
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [instagramLocationId, setInstagramLocationId] = useState("");
  const [instagramUserTag, setInstagramUserTag] = useState("");
  const [instagramShareReelToFeed, setInstagramShareReelToFeed] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [facebookCountries, setFacebookCountries] = useState("FR");
  const [facebookAgeMin, setFacebookAgeMin] = useState("");
  const [facebookAgeMax, setFacebookAgeMax] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const bothSelected = platforms.includes("instagram") && platforms.includes("facebook");

  const publishSummary = useMemo(() => {
    if (platforms.length === 0) return null;
    const parts = platforms.map((p) => {
      if (contentType === "reel" && p === "facebook") return "Facebook (post fil)";
      return `${platformLabel(p)} (${CONTENT_OPTIONS.find((c) => c.value === contentType)?.label ?? contentType})`;
    });
    return parts.join(" + ");
  }, [platforms, contentType]);

  function togglePlatform(platform: SocialPlatform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  function handleFileChange(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (platforms.length === 0) {
      setError("Sélectionnez au moins un réseau.");
      return;
    }
    if (!file) {
      setError("Ajoutez une image à publier.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("restaurantId", restaurantId);
    formData.set("platforms", platforms.join(","));
    formData.set("contentType", contentType);
    formData.set("caption", caption);
    formData.set("image", file);
    formData.set("instagramLocationId", instagramLocationId);
    formData.set("instagramUserTag", instagramUserTag);
    formData.set("instagramShareReelToFeed", instagramShareReelToFeed ? "true" : "false");
    formData.set("scheduledAt", scheduledAt);
    formData.set("facebookCountries", facebookCountries);
    formData.set("facebookAgeMin", facebookAgeMin);
    formData.set("facebookAgeMax", facebookAgeMax);

    const result = await publishCommunicationPostAction(formData);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const lines = result.data!.results.map((r) => {
      const name = platformLabel(r.platform);
      if (r.ok) {
        return `✓ ${name}${r.note ? ` (${r.note})` : ""}`;
      }
      return `✗ ${name} : ${r.error}`;
    });
    setSuccess(lines.join("\n"));
    setCaption("");
    handleFileChange(null);
    if (fileRef.current) fileRef.current.value = "";
    onPublished();
  }

  const canPublish =
    platforms.length > 0 &&
    platforms.every(
      (p) =>
        (p === "instagram" && instagramConnected) || (p === "facebook" && facebookConnected)
    );

  return (
    <form onSubmit={handleSubmit} className={`${uiCard} space-y-5 p-5 sm:p-6`}>
      <div>
        <h2 className="text-base font-semibold text-stone-900">Publier un contenu</h2>
        <p className={`mt-1 ${uiLead}`}>
          Publiez sur Instagram et/ou Facebook en une seule fois. Image JPEG, PNG ou WebP (max.
          12 Mo).
        </p>
      </div>

      {!instagramConnected && !facebookConnected ? (
        <p className={uiError}>
          Connectez d&apos;abord vos comptes Meta dans l&apos;onglet Comptes.
        </p>
      ) : null}

      {!publishScopesEnabled ? (
        <p className={uiWarn}>
          Scopes de publication non activés — activez{" "}
          <code className="text-[11px]">META_OAUTH_INCLUDE_PUBLISH_SCOPES=true</code> et les
          permissions Meta, puis reconnectez vos comptes.
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className={uiFormLabel}>Réseaux (plusieurs possibles)</legend>
        <div className="flex flex-wrap gap-3">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              platforms.includes("instagram")
                ? "border-pink-300 bg-pink-50 text-pink-900"
                : "border-stone-200 bg-white text-stone-600"
            } ${!instagramConnected ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={platforms.includes("instagram")}
              disabled={!instagramConnected || loading}
              onChange={() => togglePlatform("instagram")}
            />
            <Instagram className="h-4 w-4" aria-hidden />
            Instagram
          </label>
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              platforms.includes("facebook")
                ? "border-blue-300 bg-blue-50 text-blue-900"
                : "border-stone-200 bg-white text-stone-600"
            } ${!facebookConnected ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={platforms.includes("facebook")}
              disabled={!facebookConnected || loading}
              onChange={() => togglePlatform("facebook")}
            />
            <FacebookIcon className="h-4 w-4" />
            Facebook
          </label>
        </div>
        {bothSelected ? (
          <p className={`text-xs ${uiLead}`}>
            Publication simultanée sur les deux réseaux avec le même visuel.
          </p>
        ) : null}
      </fieldset>

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
          {CONTENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {opt.hint}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="publish-caption" className={uiFormLabel}>
          {contentType === "story"
            ? "Texte (non affiché sur story Instagram ; utilisé sur Facebook si applicable)"
            : "Légende / texte"}
        </label>
        <textarea
          id="publish-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className={`${uiInput} w-full`}
          placeholder="Annonce, menu du jour, hashtags…"
          disabled={loading}
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

      <div className="rounded-xl border border-stone-200 bg-stone-50/70">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-stone-800"
        >
          Options avancées
          <ChevronDown
            className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {showAdvanced ? (
          <div className="space-y-4 border-t border-stone-200 px-4 py-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
              <p className="font-semibold">Limites de l&apos;API Meta</p>
              <p className="mt-1">
                Les stories « Amis proches », sondages, stickers, musique et le ciblage story
                Instagram ne sont pas disponibles via l&apos;API — configurez-les dans l&apos;app
                Instagram si besoin. Ubion envoie une story/fil standard visible publiquement.
              </p>
            </div>

            {platforms.includes("instagram") ? (
              <div className="space-y-3 rounded-lg border border-pink-100 bg-pink-50/40 p-3">
                <p className="text-xs font-semibold text-pink-900">Instagram</p>
                <div>
                  <label htmlFor="ig-location" className={uiFormLabel}>
                    Lieu (ID page Meta)
                  </label>
                  <input
                    id="ig-location"
                    value={instagramLocationId}
                    onChange={(e) => setInstagramLocationId(e.target.value)}
                    className={`${uiInput} w-full`}
                    placeholder="ID lieu Facebook (optionnel)"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="ig-tag" className={uiFormLabel}>
                    Mention @ dans l&apos;image / story
                  </label>
                  <input
                    id="ig-tag"
                    value={instagramUserTag}
                    onChange={(e) => setInstagramUserTag(e.target.value)}
                    className={`${uiInput} w-full`}
                    placeholder="@compte"
                    disabled={loading}
                  />
                </div>
                {contentType === "reel" ? (
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={instagramShareReelToFeed}
                      onChange={(e) => setInstagramShareReelToFeed(e.target.checked)}
                      disabled={loading}
                    />
                    Afficher aussi le reel dans le fil Instagram
                  </label>
                ) : null}
              </div>
            ) : null}

            {platforms.includes("facebook") ? (
              <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <p className="text-xs font-semibold text-blue-900">Facebook</p>
                <div>
                  <label htmlFor="fb-schedule" className={uiFormLabel}>
                    Programmation (posts fil uniquement)
                  </label>
                  <input
                    id="fb-schedule"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className={`${uiInput} w-full`}
                    disabled={loading || contentType === "story"}
                  />
                  {contentType === "story" ? (
                    <p className={`mt-1 text-xs ${uiLead}`}>
                      Les stories Facebook sont publiées immédiatement via l&apos;API.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="fb-countries" className={uiFormLabel}>
                    Audience — pays (codes ISO, ex. FR, BE)
                  </label>
                  <input
                    id="fb-countries"
                    value={facebookCountries}
                    onChange={(e) => setFacebookCountries(e.target.value)}
                    className={`${uiInput} w-full`}
                    placeholder="FR, BE, CH"
                    disabled={loading || contentType === "story"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fb-age-min" className={uiFormLabel}>
                      Âge min.
                    </label>
                    <input
                      id="fb-age-min"
                      type="number"
                      min={13}
                      max={65}
                      value={facebookAgeMin}
                      onChange={(e) => setFacebookAgeMin(e.target.value)}
                      className={`${uiInput} w-full`}
                      disabled={loading || contentType === "story"}
                    />
                  </div>
                  <div>
                    <label htmlFor="fb-age-max" className={uiFormLabel}>
                      Âge max.
                    </label>
                    <input
                      id="fb-age-max"
                      type="number"
                      min={13}
                      max={65}
                      value={facebookAgeMax}
                      onChange={(e) => setFacebookAgeMax(e.target.value)}
                      disabled={loading || contentType === "story"}
                      className={`${uiInput} w-full`}
                    />
                  </div>
                </div>
                <p className={`text-xs ${uiLead}`}>
                  Le ciblage s&apos;applique aux posts fil Facebook. Les stories page sont
                  publiques.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {publishSummary ? (
        <p className="text-sm text-stone-600">
          Sera publié sur : <strong>{publishSummary}</strong>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !canPublish || !file || !publishScopesEnabled}
        className={`inline-flex items-center gap-2 ${uiBtnPrimary}`}
      >
        <Send className="h-4 w-4" aria-hidden />
        {loading
          ? "Publication…"
          : platforms.length > 1
            ? `Publier sur ${platforms.length} réseaux`
            : "Publier maintenant"}
      </button>

      {error ? <p className={uiError}>{error}</p> : null}
      {success ? (
        <p className={`${uiSuccess} whitespace-pre-line`}>{success}</p>
      ) : null}
    </form>
  );
}
