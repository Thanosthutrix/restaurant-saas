"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { isMetaOAuthConfigured } from "@/lib/meta/config";
import {
  disconnectMetaConnection,
  getRestaurantSocialState,
  linkMetaFacebookPage,
  syncInstagramStories,
  updateRestaurantSocialLinks,
  type RestaurantMetaConnection,
  type RestaurantSocialState,
} from "@/lib/meta/metaDb";
import { buildMetaOAuthAuthorizeUrl } from "@/lib/meta/oauthClient";
import { completeMetaOAuthFromToken } from "@/lib/meta/completeOAuth";
import { encodeMetaOAuthState } from "@/lib/meta/oauthState";
import { normalizeFacebookInput, normalizeInstagramInput } from "@/lib/meta/socialUrls";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function assertRestaurantAccess(userId: string, restaurantId: string) {
  const list = await getAccessibleRestaurantsForUser(userId);
  if (!list.some((r) => r.id === restaurantId)) {
    return { ok: false as const, error: "Accès refusé à ce restaurant." };
  }
  return { ok: true as const };
}

function revalidateSocialPaths(restaurantId: string) {
  revalidatePath(`/restaurants/${restaurantId}/edit`);
  revalidatePath(`/restaurant/${restaurantId}`);
  revalidatePath("/");
}

export async function getRestaurantSocialStateAction(
  restaurantId: string
): Promise<RestaurantSocialState> {
  return getRestaurantSocialState(restaurantId);
}

export async function saveSocialLinksAction(params: {
  restaurantId: string;
  instagramInput: string;
  facebookInput: string;
}): Promise<ActionResult<RestaurantSocialState>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, params.restaurantId);
  if (!access.ok) return access;

  const ig = params.instagramInput.trim()
    ? normalizeInstagramInput(params.instagramInput)
    : null;
  const fb = params.facebookInput.trim()
    ? normalizeFacebookInput(params.facebookInput)
    : null;

  if (params.instagramInput.trim() && !ig) {
    return { ok: false, error: "URL ou identifiant Instagram invalide." };
  }
  if (params.facebookInput.trim() && !fb) {
    return { ok: false, error: "URL ou page Facebook invalide." };
  }

  try {
    await updateRestaurantSocialLinks(params.restaurantId, {
      instagramUrl: ig?.url ?? null,
      facebookUrl: fb?.url ?? null,
      instagramUsername: ig?.username ?? null,
    });
    revalidateSocialPaths(params.restaurantId);
    return { ok: true, data: await getRestaurantSocialState(params.restaurantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

export async function getMetaOAuthStartUrlAction(
  restaurantId: string
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (!isMetaOAuthConfigured()) {
    return {
      ok: false,
      error: "OAuth Meta non configuré (META_APP_ID / META_APP_SECRET).",
    };
  }

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const state = encodeMetaOAuthState({
    restaurantId,
    userId: user.id,
    ts: Date.now(),
  });

  return { ok: true, data: { url: buildMetaOAuthAuthorizeUrl(state) } };
}

export async function completeMetaOAuthAction(params: {
  state: string;
  accessToken: string;
}): Promise<ActionResult<{ restaurantId: string }>> {
  const result = await completeMetaOAuthFromToken(params);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateSocialPaths(result.restaurantId);
  return { ok: true, data: { restaurantId: result.restaurantId } };
}

export async function linkMetaFacebookPageAction(
  restaurantId: string,
  pageId: string
): Promise<ActionResult<RestaurantMetaConnection>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const state = await getRestaurantSocialState(restaurantId);
  const page = state.pendingPages.find((p) => p.id === pageId);
  if (!page) return { ok: false, error: "Page Facebook introuvable." };

  try {
    const linked = await linkMetaFacebookPage({ restaurantId, page });
    revalidateSocialPaths(restaurantId);
    if (!linked) return { ok: false, error: "Liaison impossible." };
    return { ok: true, data: linked };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Liaison impossible." };
  }
}

export async function refreshInstagramStoriesAction(
  restaurantId: string
): Promise<ActionResult<RestaurantMetaConnection | null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    const meta = await syncInstagramStories(restaurantId, true);
    revalidateSocialPaths(restaurantId);
    return { ok: true, data: meta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Synchronisation impossible." };
  }
}

export async function disconnectMetaAction(
  restaurantId: string
): Promise<ActionResult<RestaurantSocialState>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    await disconnectMetaConnection(restaurantId);
    revalidateSocialPaths(restaurantId);
    return { ok: true, data: await getRestaurantSocialState(restaurantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Déconnexion impossible." };
  }
}
