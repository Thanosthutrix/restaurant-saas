import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { upsertMetaUserConnection } from "@/lib/meta/metaDb";
import { exchangeMetaLongLivedToken, fetchMetaUserProfile } from "@/lib/meta/oauthClient";
import { decodeMetaOAuthState } from "@/lib/meta/oauthState";

export type CompleteMetaOAuthResult =
  | { ok: true; restaurantId: string }
  | { ok: false; error: string };

export async function completeMetaOAuthFromToken(params: {
  state: string;
  accessToken: string;
}): Promise<CompleteMetaOAuthResult> {
  const decoded = params.state ? decodeMetaOAuthState(params.state) : null;
  if (!decoded) {
    return { ok: false, error: "Session OAuth invalide ou expirée." };
  }

  const sessionUser = await getCurrentUser();
  // Au retour Meta, la session Ubion est parfois absente (Safari, www vs apex) : le state signé fait foi.
  if (sessionUser && sessionUser.id !== decoded.userId) {
    return { ok: false, error: "Session OAuth invalide ou expirée." };
  }

  const accessToken = params.accessToken.trim();
  if (!accessToken) {
    return { ok: false, error: "Jeton Meta manquant." };
  }

  const list = await getAccessibleRestaurantsForUser(decoded.userId);
  if (!list.some((r) => r.id === decoded.restaurantId)) {
    return { ok: false, error: "Accès refusé à ce restaurant." };
  }

  try {
    let token = accessToken;
    let expiresInSec: number | undefined;
    try {
      const long = await exchangeMetaLongLivedToken(accessToken);
      token = long.access_token;
      expiresInSec = long.expires_in;
    } catch {
      /* Jeton déjà long ou échange impossible — on conserve le jeton reçu. */
    }

    const profile = await fetchMetaUserProfile(token);
    await upsertMetaUserConnection({
      restaurantId: decoded.restaurantId,
      metaAccountName: profile.name,
      userAccessToken: token,
      expiresInSec,
    });
    return { ok: true, restaurantId: decoded.restaurantId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connexion Meta impossible." };
  }
}
