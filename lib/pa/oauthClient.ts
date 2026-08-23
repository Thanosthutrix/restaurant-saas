import "server-only";

import {
  SUPER_PDP_AUTHORIZE_URL,
  SUPER_PDP_TOKEN_URL,
  getPaClientId,
  getPaClientSecret,
  getPaOAuthRedirectUri,
} from "./config";

export type PaTokenResponse = {
  access_token: string;
  refresh_token?: string;
  /** Secondes avant expiration (Super PDP : 30 min pour l'access_token). */
  expires_in: number;
  token_type: string;
};

/**
 * URL d'autorisation Authorization Code.
 * `superpdp_send_and_receive=receive` force l'inscription à l'annuaire (réception) dans
 * l'écran de consentement — on n'a pas besoin d'appeler POST /directory_entries nous-mêmes.
 */
export type PaSendAndReceiveMode = "receive" | "send" | "both";

export function buildPaAuthorizeUrl(params: {
  state: string;
  companyNumber?: string;
  companyNumberScheme?: "sandbox" | "fr_siren";
  loginHint?: string;
  /** Inscription annuaire PA : réception, émission, ou les deux. */
  sendAndReceive?: PaSendAndReceiveMode;
}): string {
  const clientId = getPaClientId();
  if (!clientId) throw new Error("SUPER_PDP_CLIENT_ID manquant.");

  const url = new URL(SUPER_PDP_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getPaOAuthRedirectUri());
  url.searchParams.set("state", params.state);
  url.searchParams.set("superpdp_send_and_receive", params.sendAndReceive ?? "receive");
  if (params.companyNumber && params.companyNumberScheme) {
    url.searchParams.set("superpdp_company_number", params.companyNumber);
    url.searchParams.set("superpdp_company_number_scheme", params.companyNumberScheme);
  }
  if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
  return url.toString();
}

async function requestToken(body: URLSearchParams): Promise<PaTokenResponse> {
  const clientId = getPaClientId();
  const clientSecret = getPaClientSecret();
  if (!clientId || !clientSecret) throw new Error("Identifiants OAuth Super PDP manquants.");

  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch(SUPER_PDP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Échange de token Super PDP échoué (${res.status}) : ${text.slice(0, 300)}`);
  }
  return (await res.json()) as PaTokenResponse;
}

export async function exchangePaAuthorizationCode(code: string): Promise<PaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getPaOAuthRedirectUri(),
  });
  return requestToken(body);
}

export async function refreshPaAccessToken(refreshToken: string): Promise<PaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return requestToken(body);
}
