export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
] as const;

export function getGoogleOAuthClientId(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null;
}

export function getGoogleOAuthClientSecret(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null;
}

export function getGoogleMapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}

export function getGoogleOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getAppBaseUrl()}/api/google/oauth/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleOAuthClientId() && getGoogleOAuthClientSecret());
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export function buildGoogleReviewLink(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function buildUbionReservationLink(restaurantId: string): string {
  return `${getAppBaseUrl()}/restaurant/${restaurantId}?tab=reservation`;
}
