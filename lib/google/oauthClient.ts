import {
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  getGoogleOAuthRedirectUri,
  GOOGLE_OAUTH_SCOPES,
} from "@/lib/google/config";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export function buildGoogleOAuthAuthorizeUrl(state: string): string {
  const clientId = getGoogleOAuthClientId();
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID manquant.");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleOAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleOAuthCode(code: string): Promise<TokenResponse> {
  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Configuration OAuth Google incomplète.");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getGoogleOAuthRedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échange OAuth Google échoué (${res.status}) : ${text.slice(0, 300)}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Configuration OAuth Google incomplète.");
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rafraîchissement OAuth Google échoué (${res.status}) : ${text.slice(0, 300)}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<{ email: string; sub: string }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Impossible de lire le profil Google connecté.");
  }

  const data = (await res.json()) as { email?: string; sub?: string };
  if (!data.email || !data.sub) {
    throw new Error("Profil Google incomplet (email manquant).");
  }

  return { email: data.email, sub: data.sub };
}
