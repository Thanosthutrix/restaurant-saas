import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { upsertMetaUserConnection } from "@/lib/meta/metaDb";
import { fetchMetaUserProfile } from "@/lib/meta/oauthClient";
import { decodeMetaOAuthState } from "@/lib/meta/oauthState";

export type CompleteMetaOAuthResult =
  | { ok: true; restaurantId: string }
  | { ok: false; error: string };

export async function completeMetaOAuthFromToken(params: {
  state: string;
  accessToken: string;
}): Promise<CompleteMetaOAuthResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const decoded = params.state ? decodeMetaOAuthState(params.state) : null;
  if (!decoded || decoded.userId !== user.id) {
    return { ok: false, error: "Session OAuth invalide ou expirée." };
  }

  const list = await getAccessibleRestaurantsForUser(user.id);
  if (!list.some((r) => r.id === decoded.restaurantId)) {
    return { ok: false, error: "Accès refusé à ce restaurant." };
  }

  try {
    const profile = await fetchMetaUserProfile(params.accessToken);
    await upsertMetaUserConnection({
      restaurantId: decoded.restaurantId,
      metaAccountName: profile.name,
      userAccessToken: params.accessToken,
    });
    return { ok: true, restaurantId: decoded.restaurantId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connexion Meta impossible." };
  }
}
