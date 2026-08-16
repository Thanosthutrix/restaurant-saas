import "server-only";

import { SUPER_PDP_API_BASE } from "./config";
import { refreshPaAccessToken } from "./oauthClient";
import { getPaConnection, upsertPaConnection, type RestaurantPaConnection } from "./paDb";

/**
 * Renvoie un access_token valide pour ce restaurant, en le rafraîchissant si besoin
 * (durée de vie annoncée : 30 min, avec rotation du refresh_token à chaque usage).
 */
async function getValidAccessToken(restaurantId: string): Promise<string> {
  const conn = await getPaConnection(restaurantId);
  if (!conn?.access_token) throw new Error("Restaurant non connecté à la PA.");

  const expiresAt = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  const stillValid = expiresAt > Date.now() + 60_000; // marge d'1 min
  if (stillValid) return conn.access_token;

  if (!conn.refresh_token) throw new Error("Token expiré et aucun refresh_token disponible — reconnexion nécessaire.");

  const refreshed = await refreshPaAccessToken(conn.refresh_token);
  await upsertPaConnection(restaurantId, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? conn.refresh_token,
    token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  });
  return refreshed.access_token;
}

export async function paApiFetch(
  restaurantId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getValidAccessToken(restaurantId);
  return fetch(`${SUPER_PDP_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}

export type PaCompany = {
  id: number;
  number: string;
  number_scheme: string;
  formal_name: string;
};

export type PaOAuthSession = {
  client_id: string;
  company_verification_status: "verified" | "needs_review" | "failed";
  user_identity_verification_status?: "verified" | "needs_review" | "failed" | "not_verified";
};

export async function fetchPaCompanyMe(restaurantId: string): Promise<PaCompany> {
  const res = await paApiFetch(restaurantId, "/v1.beta/companies/me");
  if (!res.ok) throw new Error(`GET /companies/me → ${res.status}`);
  return (await res.json()) as PaCompany;
}

export async function fetchPaOAuthSession(restaurantId: string): Promise<PaOAuthSession> {
  const res = await paApiFetch(restaurantId, "/v1.beta/oauth2_sessions/me");
  if (!res.ok) throw new Error(`GET /oauth2_sessions/me → ${res.status}`);
  return (await res.json()) as PaOAuthSession;
}

export type { RestaurantPaConnection };
