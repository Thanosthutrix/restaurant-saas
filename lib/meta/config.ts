/** Scopes lecture (stories, pages, profil IG) — fonctionnent sans App Review avancée. */
export const META_OAUTH_SCOPES_READ = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "business_management",
] as const;

/** Scopes publication — à activer dans Meta for Developers AVANT de les demander à l'OAuth. */
export const META_OAUTH_SCOPES_PUBLISH = [
  "pages_manage_posts",
  "instagram_content_publish",
] as const;

/** Scopes messagerie (Instagram DM + Messenger) — App Review requis en production. */
export const META_OAUTH_SCOPES_MESSAGING = [
  "pages_messaging",
  "instagram_manage_messages",
  "pages_manage_metadata",
] as const;

/** @deprecated Utiliser getMetaOAuthScopes() */
export const META_OAUTH_SCOPES = [...META_OAUTH_SCOPES_READ, ...META_OAUTH_SCOPES_PUBLISH] as const;

export function isMetaPublishScopesEnabled(): boolean {
  const v = process.env.META_OAUTH_INCLUDE_PUBLISH_SCOPES?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isMetaMessagingScopesEnabled(): boolean {
  const v = process.env.META_OAUTH_INCLUDE_MESSAGING_SCOPES?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getMetaOAuthScopes(): readonly string[] {
  const scopes: string[] = [...META_OAUTH_SCOPES_READ];
  if (isMetaPublishScopesEnabled()) {
    scopes.push(...META_OAUTH_SCOPES_PUBLISH);
  }
  if (isMetaMessagingScopesEnabled()) {
    scopes.push(...META_OAUTH_SCOPES_MESSAGING);
  }
  return scopes;
}

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

export function getMetaOAuthRedirectUri(requestOrigin?: string | null): string {
  const explicit = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (requestOrigin?.trim()) {
    return `${requestOrigin.trim().replace(/\/$/, "")}/meta/oauth/complete`;
  }
  return `${getAppBaseUrl()}/meta/oauth/complete`;
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(getMetaAppId() && getMetaAppSecret());
}

export function getMetaWebhookUrl(): string {
  return `${getAppBaseUrl()}/api/meta/webhook`;
}

export function getMetaWebhookVerifyToken(): string | null {
  return process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || null;
}

export function isMetaWebhookConfigured(): boolean {
  return Boolean(getMetaWebhookVerifyToken() && getMetaAppSecret());
}

export const META_GRAPH_API_VERSION = "v21.0";

export function metaGraphUrl(path: string): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${clean}`;
}
