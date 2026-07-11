"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import {
  createGoogleBusinessLocation,
  fetchGoogleVoiceOfMerchant,
  listGoogleBusinessAccounts,
  searchGoogleBusinessLocations,
} from "@/lib/google/businessProfile";
import { isGoogleOAuthConfigured, isGooglePlacesConfigured } from "@/lib/google/config";
import {
  disconnectRestaurantGoogle,
  getGoogleAccessTokenForRestaurant,
  getRestaurantGoogleContextForActions,
  getRestaurantGoogleState,
  linkRestaurantGooglePlace,
  updateRestaurantGoogleConnectionMeta,
} from "@/lib/google/googleDb";
import { buildGoogleOAuthAuthorizeUrl } from "@/lib/google/oauthClient";
import { encodeGoogleOAuthState } from "@/lib/google/oauthState";
import { fetchGooglePlaceDetails, searchGooglePlaceCandidates } from "@/lib/google/placesSearch";
import { getRestaurantPlanningHourMaps } from "@/lib/staff/staffDb";
import { buildUbionReservationLink } from "@/lib/google/config";
import { trySyncRestaurantHoursToGoogle } from "@/lib/google/syncHours";
import type { GooglePlaceCandidate, RestaurantGoogleState } from "@/lib/google/types";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function assertRestaurantAccess(userId: string, restaurantId: string) {
  const list = await getAccessibleRestaurantsForUser(userId);
  if (!list.some((r) => r.id === restaurantId)) {
    return { ok: false as const, error: "Accès refusé à ce restaurant." };
  }
  return { ok: true as const };
}

function revalidateGooglePaths(restaurantId: string) {
  revalidatePath(`/restaurants/${restaurantId}/edit`);
  revalidatePath(`/restaurant/${restaurantId}`);
  revalidatePath("/");
}

export async function getRestaurantGoogleStateAction(
  restaurantId: string
): Promise<RestaurantGoogleState> {
  return getRestaurantGoogleState(restaurantId);
}

export async function getGoogleOAuthStartUrlAction(
  restaurantId: string
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (!isGoogleOAuthConfigured()) {
    return {
      ok: false,
      error: "OAuth Google non configuré (GOOGLE_OAUTH_CLIENT_ID / SECRET).",
    };
  }

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const state = encodeGoogleOAuthState({
    restaurantId,
    userId: user.id,
    ts: Date.now(),
  });

  return { ok: true, data: { url: buildGoogleOAuthAuthorizeUrl(state) } };
}

export async function searchGoogleBusinessCandidatesAction(
  restaurantId: string
): Promise<ActionResult<{ candidates: GooglePlaceCandidate[]; source: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const ctx = await getRestaurantGoogleContextForActions(restaurantId);
  const accessToken = await getGoogleAccessTokenForRestaurant(restaurantId);

  if (accessToken) {
    try {
      const gbpCandidates = await searchGoogleBusinessLocations(accessToken, {
        name: ctx.name,
        address: ctx.address_text,
        phone: ctx.phone,
      });
      if (gbpCandidates.length > 0) {
        return { ok: true, data: { candidates: gbpCandidates, source: "google_business" } };
      }
    } catch (err) {
      // Fallback Places si l'API GBP n'est pas encore approuvée.
      console.warn("[googleActions] GBP search failed:", err);
    }
  }

  if (!isGooglePlacesConfigured()) {
    return {
      ok: false,
      error: "Clé Google Maps manquante (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).",
    };
  }

  const candidates = await searchGooglePlaceCandidates({
    name: ctx.name,
    address: ctx.address_text,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
  });

  return { ok: true, data: { candidates, source: "places" } };
}

export async function linkGooglePlaceAction(
  restaurantId: string,
  placeId: string,
  googleLocationName?: string | null
): Promise<ActionResult<RestaurantGoogleState>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const trimmed = placeId.trim();
  if (!trimmed) return { ok: false, error: "Place ID requis." };

  const details = await fetchGooglePlaceDetails(trimmed);

  await linkRestaurantGooglePlace(restaurantId, {
    placeId: trimmed,
    mapsUri: details?.mapsUri ?? null,
    rating: details?.rating ?? null,
    reviewCount: details?.reviewCount ?? null,
    googleLocationName: googleLocationName ?? null,
  });

  if (googleLocationName) {
    const accessToken = await getGoogleAccessTokenForRestaurant(restaurantId);
    if (accessToken) {
      const voice = await fetchGoogleVoiceOfMerchant(accessToken, googleLocationName);
      await updateRestaurantGoogleConnectionMeta(restaurantId, {
        verificationStatus: voice.verified ? "verified" : "pending",
        connectionStatus: voice.verified ? "connected" : "needs_action",
      });
    }
  }

  await trySyncRestaurantHoursToGoogle(restaurantId);

  revalidateGooglePaths(restaurantId);
  return { ok: true, data: await getRestaurantGoogleState(restaurantId) };
}

export async function createGoogleBusinessLocationAction(
  restaurantId: string
): Promise<ActionResult<RestaurantGoogleState>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const accessToken = await getGoogleAccessTokenForRestaurant(restaurantId);
  if (!accessToken) {
    return { ok: false, error: "Connectez d'abord votre compte Google Business." };
  }

  const ctx = await getRestaurantGoogleContextForActions(restaurantId);
  const hourMaps = await getRestaurantPlanningHourMaps(restaurantId);
  const accounts = await listGoogleBusinessAccounts(accessToken);
  if (accounts.length === 0) {
    return { ok: false, error: "Aucun compte Google Business trouvé pour ce compte Google." };
  }

  try {
    const created = await createGoogleBusinessLocation(accessToken, {
      accountName: accounts[0]!,
      name: ctx.name,
      address: ctx.address_text,
      phone: ctx.phone,
      websiteUri: buildUbionReservationLink(restaurantId),
      opening: hourMaps.opening as Record<string, { start: string; end: string }[]>,
      requestId: `${restaurantId}-${Date.now()}`,
    });

    if (created.placeId) {
      await linkRestaurantGooglePlace(restaurantId, {
        placeId: created.placeId,
        googleLocationName: created.locationName,
      });
    } else {
      await updateRestaurantGoogleConnectionMeta(restaurantId, {
        googleLocationName: created.locationName,
        verificationStatus: "pending",
        connectionStatus: "needs_action",
        lastError: null,
      });
    }

    revalidateGooglePaths(restaurantId);
    await trySyncRestaurantHoursToGoogle(restaurantId);
    return { ok: true, data: await getRestaurantGoogleState(restaurantId) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Création Google impossible.";
    await updateRestaurantGoogleConnectionMeta(restaurantId, {
      connectionStatus: "needs_action",
      lastError: message,
    });
    return { ok: false, error: message };
  }
}

export async function syncGoogleBusinessHoursAction(
  restaurantId: string
): Promise<ActionResult<{ syncedAt: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const result = await trySyncRestaurantHoursToGoogle(restaurantId);
  if (!result) {
    return { ok: false, error: "Synchronisation impossible." };
  }
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidateGooglePaths(restaurantId);
  return { ok: true, data: { syncedAt: result.syncedAt } };
}

export async function disconnectGoogleBusinessAction(
  restaurantId: string
): Promise<ActionResult<RestaurantGoogleState>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  await disconnectRestaurantGoogle(restaurantId);
  revalidateGooglePaths(restaurantId);
  return { ok: true, data: await getRestaurantGoogleState(restaurantId) };
}

export async function refreshGoogleBusinessVerificationAction(
  restaurantId: string
): Promise<ActionResult<RestaurantGoogleState>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const state = await getRestaurantGoogleState(restaurantId);
  const locationName = state.connection?.googleLocationName;
  const accessToken = await getGoogleAccessTokenForRestaurant(restaurantId);

  if (!accessToken || !locationName) {
    return { ok: false, error: "Fiche Google Business non liée ou compte déconnecté." };
  }

  const voice = await fetchGoogleVoiceOfMerchant(accessToken, locationName);
  await updateRestaurantGoogleConnectionMeta(restaurantId, {
    verificationStatus: voice.verified ? "verified" : "pending",
    connectionStatus: voice.verified ? "connected" : "needs_action",
    lastError: null,
  });

  revalidateGooglePaths(restaurantId);
  return { ok: true, data: await getRestaurantGoogleState(restaurantId) };
}
