/** Normalisation des URLs Instagram / Facebook saisies dans l'ERP. */

export type NormalizedSocialLink = {
  url: string;
  username: string | null;
};

export function normalizeInstagramInput(raw: string): NormalizedSocialLink | null {
  const input = raw.trim();
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      if (!u.hostname.includes("instagram.com")) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      const username = parts[0] === "p" || parts[0] === "reel" ? null : parts[0] ?? null;
      return {
        url: `https://www.instagram.com/${username ?? parts[0] ?? ""}/`,
        username: username?.replace(/^@/, "") ?? null,
      };
    } catch {
      return null;
    }
  }

  const username = input.replace(/^@/, "").replace(/\s/g, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return null;
  return {
    url: `https://www.instagram.com/${username}/`,
    username,
  };
}

export function normalizeFacebookInput(raw: string): NormalizedSocialLink | null {
  const input = raw.trim();
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      if (!u.hostname.includes("facebook.com") && !u.hostname.includes("fb.com")) return null;
      return { url: u.toString().replace(/\/$/, "") + "/", username: null };
    } catch {
      return null;
    }
  }

  const slug = input.replace(/^@/, "").replace(/\s/g, "");
  if (!slug || slug.length > 100) return null;
  return {
    url: `https://www.facebook.com/${slug}/`,
    username: slug,
  };
}

export function buildInstagramProfileUrl(username: string): string {
  return `https://www.instagram.com/${username.replace(/^@/, "")}/`;
}
