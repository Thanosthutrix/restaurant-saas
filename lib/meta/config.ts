export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "business_management",
] as const;

export const STORIES_CACHE_TTL_MS = 15 * 60 * 1000;

export function getMetaAppId(): string | null {
  return process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || null;
}

export function getMetaAppSecret(): string | null {
  return process.env.META_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim() || null;
}

export function getAppBaseUrl(): string {
  const fromApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromApp) return fromApp.replace(/\/$/, "");
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromSite) return fromSite.replace(/\/$/, "");
  // Meta autorise localhost en mode Développement ; 127.0.0.1 doit être ajouté manuellement.
  return "http://localhost:3000";
}

export function getMetaOAuthRedirectUri(): string {
  const explicit = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getAppBaseUrl()}/meta/oauth/complete`;
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(getMetaAppId() && getMetaAppSecret());
}

export const META_GRAPH_API_VERSION = "v21.0";

export function metaGraphUrl(path: string): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${clean}`;
}
