import "server-only";

import { SUPER_PDP_API_BASE } from "@/lib/pa/config";
import { refreshPaAccessToken } from "@/lib/pa/oauthClient";
import {
  getPlatformPaConnection,
  upsertPlatformPaConnection,
} from "@/lib/platform/platformPaDb";

async function getValidPlatformAccessToken(companyId: string): Promise<string> {
  const conn = await getPlatformPaConnection(companyId);
  if (!conn?.access_token) throw new Error("Société non connectée à la PA.");

  const expiresAt = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  if (expiresAt > Date.now() + 60_000) return conn.access_token;

  if (!conn.refresh_token) throw new Error("Token expiré — reconnectez la PA.");

  const refreshed = await refreshPaAccessToken(conn.refresh_token);
  await upsertPlatformPaConnection(companyId, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? conn.refresh_token,
    token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  });
  return refreshed.access_token;
}

export async function platformPaApiFetch(
  companyId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getValidPlatformAccessToken(companyId);
  return fetch(`${SUPER_PDP_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}

export async function fetchPlatformPaCompanyMe(companyId: string) {
  const res = await platformPaApiFetch(companyId, "/v1.beta/companies/me");
  if (!res.ok) throw new Error(`GET /companies/me → ${res.status}`);
  return res.json() as Promise<{ id: number; number: string; formal_name: string }>;
}

export async function fetchPlatformPaOAuthSession(companyId: string) {
  const res = await platformPaApiFetch(companyId, "/v1.beta/oauth2_sessions/me");
  if (!res.ok) throw new Error(`GET /oauth2_sessions/me → ${res.status}`);
  return res.json() as Promise<{ company_verification_status: string }>;
}
