import { getGoogleMapsApiKey } from "@/lib/google/config";
import type { GooglePlaceCandidate } from "@/lib/google/types";

function normalizePlaceId(raw: string): string {
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

function mapCandidate(row: {
  place_id?: string;
  id?: string;
  name?: string;
  formatted_address?: string;
  googleMapsUri?: string;
  rating?: number;
  user_ratings_total?: number;
  userRatingCount?: number;
  business_status?: string;
  businessStatus?: string;
  displayName?: { text?: string };
}): GooglePlaceCandidate | null {
  const placeId = normalizePlaceId(row.place_id ?? row.id ?? "");
  if (!placeId) return null;

  const name =
    row.name ??
    row.displayName?.text ??
    "Établissement Google";

  return {
    placeId,
    name,
    address: row.formatted_address ?? "",
    mapsUri: row.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount:
      row.user_ratings_total != null
        ? Number(row.user_ratings_total)
        : row.userRatingCount != null
          ? Number(row.userRatingCount)
          : null,
    businessStatus: row.business_status ?? row.businessStatus ?? null,
    matchKind: "unknown",
    requestAdminRightsUrl: null,
  };
}

async function searchPlacesLegacy(textQuery: string, locationBias?: { lat: number; lng: number }): Promise<GooglePlaceCandidate[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  url.searchParams.set("input", textQuery);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,rating,user_ratings_total,business_status,geometry"
  );
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", apiKey);
  if (locationBias) {
    url.searchParams.set("locationbias", `point:${locationBias.lat},${locationBias.lng}`);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    status?: string;
    candidates?: Array<Record<string, unknown>>;
  };

  if (data.status !== "OK" || !data.candidates?.length) return [];

  return data.candidates
    .map((c) =>
      mapCandidate({
        place_id: String(c.place_id ?? ""),
        name: String(c.name ?? ""),
        formatted_address: String(c.formatted_address ?? ""),
        rating: c.rating != null ? Number(c.rating) : undefined,
        user_ratings_total: c.user_ratings_total != null ? Number(c.user_ratings_total) : undefined,
        business_status: c.business_status != null ? String(c.business_status) : undefined,
      })
    )
    .filter((c): c is GooglePlaceCandidate => c != null);
}

async function searchPlacesNew(textQuery: string): Promise<GooglePlaceCandidate[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "fr",
      regionCode: "FR",
      maxResultCount: 8,
    }),
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      googleMapsUri?: string;
      rating?: number;
      userRatingCount?: number;
      businessStatus?: string;
    }>;
  };

  return (data.places ?? [])
    .map((p) =>
      mapCandidate({
        id: p.id,
        displayName: p.displayName,
        formatted_address: p.formattedAddress,
        googleMapsUri: p.googleMapsUri,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        businessStatus: p.businessStatus,
      })
    )
    .filter((c): c is GooglePlaceCandidate => c != null);
}

export async function searchGooglePlaceCandidates(params: {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<GooglePlaceCandidate[]> {
  const parts = [params.name.trim(), params.address?.trim()].filter(Boolean);
  if (parts.length === 0) return [];

  const textQuery = parts.join(", ");
  const bias =
    params.latitude != null && params.longitude != null
      ? { lat: params.latitude, lng: params.longitude }
      : undefined;

  const [fromNew, fromLegacy] = await Promise.all([
    searchPlacesNew(textQuery),
    searchPlacesLegacy(textQuery, bias),
  ]);

  const merged = new Map<string, GooglePlaceCandidate>();
  for (const item of [...fromNew, ...fromLegacy]) {
    if (!merged.has(item.placeId)) merged.set(item.placeId, item);
  }

  return [...merged.values()];
}

export async function fetchGooglePlaceDetails(placeId: string): Promise<GooglePlaceCandidate | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const id = normalizePlaceId(placeId);
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,googleMapsUri,rating,userRatingCount,businessStatus",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const p = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    businessStatus?: string;
  };

  return mapCandidate({
    id: p.id,
    displayName: p.displayName,
    formatted_address: p.formattedAddress,
    googleMapsUri: p.googleMapsUri,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    businessStatus: p.businessStatus,
  });
}
