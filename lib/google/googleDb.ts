import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildGoogleReviewLink,
  buildUbionReservationLink,
  isGoogleOAuthConfigured,
  isGooglePlacesConfigured,
} from "@/lib/google/config";
import { refreshGoogleAccessToken } from "@/lib/google/oauthClient";
import type {
  GoogleConnectionStatus,
  GoogleVerificationStatus,
  RestaurantGoogleConnection,
  RestaurantGoogleProfile,
  RestaurantGoogleState,
} from "@/lib/google/types";

type RestaurantGoogleRow = {
  google_place_id: string | null;
  google_maps_uri: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_synced_at: string | null;
};

type ConnectionRow = {
  restaurant_id: string;
  google_account_email: string | null;
  google_account_id: string | null;
  google_location_name: string | null;
  verification_status: GoogleVerificationStatus;
  connection_status: GoogleConnectionStatus;
  last_error: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  google_account_name: string | null;
  updated_at: string;
};

function mapProfile(row: RestaurantGoogleRow | null, restaurantId: string): RestaurantGoogleProfile {
  const placeId = row?.google_place_id?.trim() || null;
  return {
    placeId,
    mapsUri: row?.google_maps_uri?.trim() || null,
    rating: row?.google_rating != null ? Number(row.google_rating) : null,
    reviewCount: row?.google_review_count != null ? Number(row.google_review_count) : null,
    syncedAt: row?.google_synced_at ?? null,
    reviewLink: placeId ? buildGoogleReviewLink(placeId) : null,
    reservationLink: buildUbionReservationLink(restaurantId),
  };
}

function mapConnection(row: ConnectionRow | null): RestaurantGoogleConnection | null {
  if (!row) return null;
  return {
    restaurantId: row.restaurant_id,
    googleAccountEmail: row.google_account_email,
    googleAccountId: row.google_account_id,
    googleLocationName: row.google_location_name,
    verificationStatus: row.verification_status,
    connectionStatus: row.connection_status,
    lastError: row.last_error,
    connectedAt: row.updated_at,
  };
}

export async function getRestaurantGoogleRow(
  restaurantId: string
): Promise<RestaurantGoogleRow | null> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select(
      "google_place_id, google_maps_uri, google_rating, google_review_count, google_synced_at"
    )
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RestaurantGoogleRow;
}

export async function getRestaurantGoogleConnectionRow(
  restaurantId: string
): Promise<ConnectionRow | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_google_connections")
    .select(
      "restaurant_id, google_account_email, google_account_id, google_location_name, verification_status, connection_status, last_error, access_token, refresh_token, token_expires_at, google_account_name, updated_at"
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ConnectionRow;
}

export async function getRestaurantGoogleState(restaurantId: string): Promise<RestaurantGoogleState> {
  try {
    const [row, connection] = await Promise.all([
      getRestaurantGoogleRow(restaurantId),
      getRestaurantGoogleConnectionRow(restaurantId),
    ]);

    return {
      profile: mapProfile(row, restaurantId),
      connection: mapConnection(connection),
      oauthConfigured: isGoogleOAuthConfigured(),
      placesConfigured: isGooglePlacesConfigured(),
    };
  } catch {
    return {
      profile: mapProfile(null, restaurantId),
      connection: null,
      oauthConfigured: isGoogleOAuthConfigured(),
      placesConfigured: isGooglePlacesConfigured(),
    };
  }
}

export async function upsertRestaurantGoogleConnection(params: {
  restaurantId: string;
  googleAccountEmail: string;
  googleAccountId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSec?: number;
  googleAccountName?: string | null;
}): Promise<void> {
  const expiresAt =
    params.expiresInSec != null
      ? new Date(Date.now() + params.expiresInSec * 1000).toISOString()
      : null;

  const { error } = await supabaseServer.from("restaurant_google_connections").upsert(
    {
      restaurant_id: params.restaurantId,
      google_account_email: params.googleAccountEmail,
      google_account_id: params.googleAccountId,
      access_token: params.accessToken,
      refresh_token: params.refreshToken ?? null,
      token_expires_at: expiresAt,
      google_account_name: params.googleAccountName ?? null,
      connection_status: "connected",
      verification_status: "none",
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" }
  );

  if (error) throw new Error(error.message);
}

export async function updateRestaurantGoogleConnectionMeta(
  restaurantId: string,
  patch: Partial<{
    googleLocationName: string | null;
    verificationStatus: GoogleVerificationStatus;
    connectionStatus: GoogleConnectionStatus;
    lastError: string | null;
    googleAccountName: string | null;
  }>
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.googleLocationName !== undefined) updates.google_location_name = patch.googleLocationName;
  if (patch.verificationStatus !== undefined) updates.verification_status = patch.verificationStatus;
  if (patch.connectionStatus !== undefined) updates.connection_status = patch.connectionStatus;
  if (patch.lastError !== undefined) updates.last_error = patch.lastError;
  if (patch.googleAccountName !== undefined) updates.google_account_name = patch.googleAccountName;

  const { error } = await supabaseServer
    .from("restaurant_google_connections")
    .update(updates)
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);
}

export async function linkRestaurantGooglePlace(
  restaurantId: string,
  params: {
    placeId: string;
    mapsUri?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    googleLocationName?: string | null;
  }
): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurants")
    .update({
      google_place_id: params.placeId,
      google_maps_uri: params.mapsUri?.trim() || null,
      google_rating: params.rating ?? null,
      google_review_count: params.reviewCount ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurantId);

  if (error) throw new Error(error.message);

  if (params.googleLocationName !== undefined) {
    await updateRestaurantGoogleConnectionMeta(restaurantId, {
      googleLocationName: params.googleLocationName,
    });
  }
}

export async function markRestaurantGoogleHoursSynced(
  restaurantId: string,
  syncedAt: string
): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurants")
    .update({
      google_synced_at: syncedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurantId);

  if (error) throw new Error(error.message);
}

export async function disconnectRestaurantGoogle(restaurantId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurant_google_connections")
    .delete()
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);
}

export async function getGoogleAccessTokenForRestaurant(
  restaurantId: string
): Promise<string | null> {
  const row = await getRestaurantGoogleConnectionRow(restaurantId);
  if (!row?.access_token) return null;

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return row.access_token;
  }

  if (!row.refresh_token) return row.access_token;

  const refreshed = await refreshGoogleAccessToken(row.refresh_token);
  const newExpires =
    refreshed.expires_in != null
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : null;

  const { error } = await supabaseServer
    .from("restaurant_google_connections")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: newExpires,
      refresh_token: refreshed.refresh_token ?? row.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);
  return refreshed.access_token;
}

export async function getRestaurantGoogleContextForActions(restaurantId: string): Promise<{
  name: string;
  address_text: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
}> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("name, address_text, latitude, longitude, phone")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) throw new Error("Restaurant introuvable.");

  const row = data as {
    name: string;
    address_text: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
  };

  return row;
}
