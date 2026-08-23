import "server-only";

import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import {
  fetchPlatformPaCompanyMe,
  fetchPlatformPaOAuthSession,
} from "@/lib/platform/platformPaApi";
import { upsertPlatformPaConnection } from "@/lib/platform/platformPaDb";
import { exchangePaAuthorizationCode } from "@/lib/pa/oauthClient";
import { decodePaOAuthState, isPlatformPaOAuthState } from "@/lib/pa/oauthState";

export type CompletePlatformPaOAuthResult =
  | { ok: true; companyId: string }
  | { ok: false; error: string };

export async function completePlatformPaOAuthFromCode(params: {
  code: string;
  state: string;
}): Promise<CompletePlatformPaOAuthResult | null> {
  const decoded = params.state ? decodePaOAuthState(params.state) : null;
  if (!decoded || !isPlatformPaOAuthState(decoded)) return null;

  const sessionUser = await getCurrentUser();
  if (sessionUser && sessionUser.id !== decoded.userId) {
    return { ok: false, error: "Session OAuth invalide." };
  }
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, error: "Accès refusé." };
  }

  const company = await getPlatformCompany();
  if (!company || company.id !== decoded.companyId) {
    return { ok: false, error: "Société introuvable." };
  }

  const code = params.code.trim();
  if (!code) return { ok: false, error: "Code OAuth manquant." };

  try {
    const token = await exchangePaAuthorizationCode(code);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    await upsertPlatformPaConnection(decoded.companyId, {
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      token_expires_at: expiresAt,
      enrollment_status: "pending",
    });

    const [paCompany, session] = await Promise.all([
      fetchPlatformPaCompanyMe(decoded.companyId),
      fetchPlatformPaOAuthSession(decoded.companyId),
    ]);

    await upsertPlatformPaConnection(decoded.companyId, {
      provider_company_id: String(paCompany.id),
      company_number: paCompany.number,
      company_verification_status: session.company_verification_status,
      enrollment_status: session.company_verification_status === "failed" ? "error" : "active",
      last_error:
        session.company_verification_status === "failed"
          ? "Vérification KYB refusée par Super PDP."
          : null,
    });

    return { ok: true, companyId: decoded.companyId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertPlatformPaConnection(decoded.companyId, {
      enrollment_status: "error",
      last_error: message,
    });
    return { ok: false, error: message };
  }
}

/** Vérifie accès restaurant (legacy OAuth state). */
export async function assertRestaurantPaOAuthState(stateRaw: string) {
  const decoded = stateRaw ? decodePaOAuthState(stateRaw) : null;
  if (!decoded || isPlatformPaOAuthState(decoded)) return null;

  const sessionUser = await getCurrentUser();
  if (sessionUser && sessionUser.id !== decoded.userId) return null;

  const list = await getAccessibleRestaurantsForUser(decoded.userId);
  if (!list.some((r) => r.id === decoded.restaurantId)) return null;

  return decoded;
}
