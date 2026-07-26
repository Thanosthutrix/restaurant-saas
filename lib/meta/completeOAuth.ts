import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import {
  getRestaurantSocialLinks,
  linkMetaFacebookPage,
  linkMetaFacebookPageFromHint,
  upsertMetaUserConnection,
} from "@/lib/meta/metaDb";
import {
  exchangeMetaLongLivedToken,
  exchangeMetaOAuthCode,
  fetchMetaUserProfile,
} from "@/lib/meta/oauthClient";
import { listMetaFacebookPages } from "@/lib/meta/graphApi";
import { getMetaOAuthRedirectUri } from "@/lib/meta/config";
import { decodeMetaOAuthState } from "@/lib/meta/oauthState";

export type CompleteMetaOAuthResult =
  | { ok: true; restaurantId: string }
  | { ok: false; error: string };

async function assertOAuthStateAccess(stateRaw: string): Promise<
  | { ok: true; restaurantId: string; userId: string }
  | { ok: false; error: string }
> {
  const decoded = stateRaw ? decodeMetaOAuthState(stateRaw) : null;
  if (!decoded) {
    return { ok: false, error: "Session OAuth invalide ou expirée." };
  }

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

export async function completeMetaOAuthFromCode(params: {
  code: string;
  state: string;
}): Promise<CompleteMetaOAuthResult> {
  const access = await assertOAuthStateAccess(params.state);
  if (!access.ok) return access;

  const code = params.code.trim();
  if (!code) {
    return { ok: false, error: "Code OAuth Meta manquant." };
  }

  try {
    const decoded = decodeMetaOAuthState(params.state);
    const redirectUri = decoded?.redirectUri ?? getMetaOAuthRedirectUri();
    const short = await exchangeMetaOAuthCode(code, redirectUri);
    const long = await exchangeMetaLongLivedToken(short.access_token);
    const profile = await fetchMetaUserProfile(long.access_token);
    await upsertMetaUserConnection({
      restaurantId: access.restaurantId,
      metaAccountName: profile.name,
      userAccessToken: long.access_token,
      expiresInSec: long.expires_in,
    });

    try {
      await linkMetaFacebookPageFromHint(access.restaurantId);
    } catch {
      try {
        const links = await getRestaurantSocialLinks(access.restaurantId);
        const pages = await listMetaFacebookPages(long.access_token, {
          facebookUrlHint: links.facebookUrl,
        });
        if (pages.length === 1) {
          await linkMetaFacebookPage({ restaurantId: access.restaurantId, page: pages[0] });
        }
      } catch {
        /* L'utilisateur choisira la page manuellement. */
      }
    }

    return { ok: true, restaurantId: access.restaurantId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connexion Meta impossible." };
  }
}

export async function completeMetaOAuthFromToken(params: {
  state: string;
  accessToken: string;
}): Promise<CompleteMetaOAuthResult> {
  const access = await assertOAuthStateAccess(params.state);
  if (!access.ok) return access;

  const accessToken = params.accessToken.trim();
  if (!accessToken) {
    return { ok: false, error: "Jeton Meta manquant." };
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
      restaurantId: access.restaurantId,
      metaAccountName: profile.name,
      userAccessToken: token,
      expiresInSec,
    });

    try {
      await linkMetaFacebookPageFromHint(access.restaurantId);
    } catch {
      try {
        const links = await getRestaurantSocialLinks(access.restaurantId);
        const pages = await listMetaFacebookPages(token, {
          facebookUrlHint: links.facebookUrl,
        });
        if (pages.length === 1) {
          await linkMetaFacebookPage({ restaurantId: access.restaurantId, page: pages[0] });
        }
      } catch {
        /* L'utilisateur choisira la page manuellement. */
      }
    }

    return { ok: true, restaurantId: access.restaurantId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connexion Meta impossible." };
  }
}
