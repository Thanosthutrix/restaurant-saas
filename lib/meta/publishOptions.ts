import type { SocialContentType, SocialPlatform } from "@/lib/meta/socialPostsDb";

export type InstagramPublishOptions = {
  locationId: string | null;
  userTagUsername: string | null;
  shareReelToFeed: boolean;
};

export type FacebookPublishOptions = {
  scheduledAt: string | null;
  countries: string[];
  ageMin: number | null;
  ageMax: number | null;
};

export type PublishRequest = {
  platforms: SocialPlatform[];
  contentType: SocialContentType;
  caption: string;
  instagram: InstagramPublishOptions;
  facebook: FacebookPublishOptions;
};

export type PublishTarget = {
  platform: SocialPlatform;
  contentType: SocialContentType;
  /** Message affiché si le type diffère (ex. reel → fil Facebook). */
  note?: string;
};

export function resolvePublishTargets(request: PublishRequest): PublishTarget[] {
  if (request.platforms.length === 0) return [];

  return request.platforms.map((platform) => {
    if (request.contentType === "reel" && platform === "facebook") {
      return {
        platform,
        contentType: "feed",
        note: "Le reel est publié en post fil sur Facebook (pas en reel natif).",
      };
    }
    return { platform, contentType: request.contentType };
  });
}

export function parsePublishRequestFromFormData(formData: FormData): PublishRequest | { error: string } {
  const platformsRaw = String(formData.get("platforms") ?? "");
  const platforms = platformsRaw
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SocialPlatform => p === "instagram" || p === "facebook");

  const contentType = String(formData.get("contentType") ?? "") as SocialContentType;
  if (contentType !== "feed" && contentType !== "story" && contentType !== "reel") {
    return { error: "Type de contenu invalide." };
  }
  if (platforms.length === 0) {
    return { error: "Sélectionnez au moins un réseau." };
  }
  if (contentType === "story" && !platforms.includes("instagram") && !platforms.includes("facebook")) {
    return { error: "Story : sélectionnez Instagram et/ou Facebook." };
  }

  const countriesRaw = String(formData.get("facebookCountries") ?? "")
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

  const ageMinRaw = String(formData.get("facebookAgeMin") ?? "").trim();
  const ageMaxRaw = String(formData.get("facebookAgeMax") ?? "").trim();
  const ageMin = ageMinRaw ? Number(ageMinRaw) : null;
  const ageMax = ageMaxRaw ? Number(ageMaxRaw) : null;

  if (ageMin != null && (Number.isNaN(ageMin) || ageMin < 13 || ageMin > 65)) {
    return { error: "Âge minimum Facebook invalide (13–65)." };
  }
  if (ageMax != null && (Number.isNaN(ageMax) || ageMax < 13 || ageMax > 65)) {
    return { error: "Âge maximum Facebook invalide (13–65)." };
  }
  if (ageMin != null && ageMax != null && ageMin > ageMax) {
    return { error: "L'âge minimum ne peut pas dépasser l'âge maximum." };
  }

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  let scheduledAt: string | null = null;
  if (scheduledAtRaw) {
    const dt = new Date(scheduledAtRaw);
    if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now() + 60_000) {
      return { error: "La date de programmation doit être dans le futur (min. 1 min)." };
    }
    scheduledAt = dt.toISOString();
  }

  return {
    platforms,
    contentType,
    caption: String(formData.get("caption") ?? ""),
    instagram: {
      locationId: String(formData.get("instagramLocationId") ?? "").trim() || null,
      userTagUsername: String(formData.get("instagramUserTag") ?? "")
        .trim()
        .replace(/^@/, "") || null,
      shareReelToFeed: formData.get("instagramShareReelToFeed") === "true",
    },
    facebook: {
      scheduledAt,
      countries: countriesRaw,
      ageMin,
      ageMax,
    },
  };
}

export function buildFacebookTargeting(
  opts: FacebookPublishOptions
): Record<string, unknown> | null {
  const targeting: Record<string, unknown> = {};
  if (opts.countries.length > 0) {
    targeting.geo_locations = { countries: opts.countries };
  }
  if (opts.ageMin != null) targeting.age_min = opts.ageMin;
  if (opts.ageMax != null) targeting.age_max = opts.ageMax;
  return Object.keys(targeting).length > 0 ? targeting : null;
}
