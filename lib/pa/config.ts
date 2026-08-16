/**
 * Configuration de la réception de factures via une Plateforme Agréée (PA, ex-PDP).
 *
 * Modèle confirmé par la spec OpenAPI Super PDP (v1.30.0.beta, lue le 12/08) : OAuth 2.1,
 * Authorization Code par restaurant (délégation vers UNE application éditeur unique), puis
 * lecture par sondage de `GET /invoices` — pas de webhook.
 */

export type PaProvider = "super_pdp" | "iopole";

export const PA_ACTIVE_PROVIDER: PaProvider = "super_pdp";

export const SUPER_PDP_API_BASE = "https://api.superpdp.tech";
export const SUPER_PDP_AUTHORIZE_URL = `${SUPER_PDP_API_BASE}/oauth2/authorize`;
export const SUPER_PDP_TOKEN_URL = `${SUPER_PDP_API_BASE}/oauth2/token`;
export const SUPER_PDP_REVOKE_URL = `${SUPER_PDP_API_BASE}/oauth2/revoke`;

export function getPaClientId(): string | null {
  return process.env.SUPER_PDP_CLIENT_ID?.trim() || null;
}

export function getPaClientSecret(): string | null {
  return process.env.SUPER_PDP_CLIENT_SECRET?.trim() || null;
}

export function isPaOAuthConfigured(): boolean {
  return Boolean(getPaClientId() && getPaClientSecret());
}

export function getPaOAuthRedirectUri(): string {
  const fromApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = fromApp ? fromApp.replace(/\/$/, "") : "http://127.0.0.1:3000";
  return `${base}/api/pa/oauth/callback`;
}
