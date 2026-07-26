import {
  getMetaAppId,
  getMetaAppSecret,
  getMetaOAuthRedirectUri,
  getMetaOAuthScopes,
} from "./config";

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export function buildMetaOAuthAuthorizeUrl(
  state: string,
  opts?: { rerequest?: boolean; redirectUri?: string }
): string {
  const appId = getMetaAppId();
  if (!appId) throw new Error("META_APP_ID manquant.");

  const redirectUri = opts?.redirectUri ?? getMetaOAuthRedirectUri();

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("display", "page");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getMetaOAuthScopes().join(","));
  url.searchParams.set("state", state);
  if (opts?.rerequest) {
    url.searchParams.set("auth_type", "rerequest");
  }
  return url.toString();
}

export async function exchangeMetaOAuthCode(
  code: string,
  redirectUri?: string
): Promise<TokenResponse> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) throw new Error("Configuration Meta OAuth incomplète.");

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri ?? getMetaOAuthRedirectUri(),
    code,
  });

  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échange OAuth Meta échoué (${res.status}) : ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Convertit un jeton court en jeton long (≈60 jours). */
export async function exchangeMetaLongLivedToken(shortToken: string): Promise<TokenResponse> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) throw new Error("Configuration Meta OAuth incomplète.");

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jeton long Meta échoué (${res.status}) : ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function fetchMetaUserProfile(accessToken: string): Promise<{ id: string; name: string }> {
  const params = new URLSearchParams({
    fields: "id,name",
    access_token: accessToken,
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/me?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Profil Meta introuvable (${res.status}) : ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string; name?: string };
  return { id: data.id ?? "", name: data.name ?? "Compte Facebook" };
}
