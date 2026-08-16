import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { decodePaOAuthState } from "./oauthState";
import { exchangePaAuthorizationCode } from "./oauthClient";
import { fetchPaCompanyMe, fetchPaOAuthSession } from "./apiClient";
import { upsertPaConnection } from "./paDb";

export type CompletePaOAuthResult = { ok: true; restaurantId: string } | { ok: false; error: string };

async function assertOAuthStateAccess(
  stateRaw: string
): Promise<{ ok: true; restaurantId: string; userId: string } | { ok: false; error: string }> {
  const decoded = stateRaw ? decodePaOAuthState(stateRaw) : null;
  if (!decoded) return { ok: false, error: "Session OAuth invalide ou expirée." };

  const sessionUser = await getCurrentUser();
  if (sessionUser && sessionUser.id !== decoded.userId) {
    return { ok: false, error: "Session OAuth invalide ou expirée." };
  }

  const list = await getAccessibleRestaurantsForUser(decoded.userId);
  if (!list.some((r) => r.id === decoded.restaurantId)) {
    return { ok: false, error: "Accès refusé à ce restaurant." };
  }

  return { ok: true, restaurantId: decoded.restaurantId, userId: decoded.userId };
}

export async function completePaOAuthFromCode(params: {
  code: string;
  state: string;
}): Promise<CompletePaOAuthResult> {
  const access = await assertOAuthStateAccess(params.state);
  if (!access.ok) return access;

  const code = params.code.trim();
  if (!code) return { ok: false, error: "Code OAuth manquant." };

  try {
    const token = await exchangePaAuthorizationCode(code);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Stockage immédiat du token : les appels suivants (companies/me, sessions/me) en dépendent.
    await upsertPaConnection(access.restaurantId, {
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      token_expires_at: expiresAt,
      enrollment_status: "pending",
    });

    const [company, session] = await Promise.all([
      fetchPaCompanyMe(access.restaurantId),
      fetchPaOAuthSession(access.restaurantId),
    ]);

    // company_verification_status peut rester "needs_review" un moment (vérification KYB
    // asynchrone côté Super PDP) : ce n'est pas un échec, la connexion est enregistrée quand même.
    await upsertPaConnection(access.restaurantId, {
      provider_company_id: String(company.id),
      company_number: company.number,
      company_verification_status: session.company_verification_status,
      enrollment_status: session.company_verification_status === "failed" ? "error" : "active",
      last_error: session.company_verification_status === "failed" ? "Vérification KYB refusée par Super PDP." : null,
    });

    return { ok: true, restaurantId: access.restaurantId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertPaConnection(access.restaurantId, { enrollment_status: "error", last_error: message });
    return { ok: false, error: message };
  }
}
