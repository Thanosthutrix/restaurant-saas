import type { GooglePlaceCandidate } from "@/lib/google/types";
import {
  buildGoogleRegularHours,
  type GoogleRegularHours,
  type GoogleSpecialHours,
} from "@/lib/google/googleHours";

type GbpLocationAddress = {
  addressLines?: string[];
  locality?: string;
  postalCode?: string;
  administrativeArea?: string;
  regionCode?: string;
};

function buildStorefrontAddress(addressText: string | null | undefined): GbpLocationAddress | undefined {
  const line = addressText?.trim();
  if (!line) return undefined;
  return {
    addressLines: [line],
    regionCode: "FR",
  };
}

export async function searchGoogleBusinessLocations(
  accessToken: string,
  params: {
    name: string;
    address?: string | null;
    phone?: string | null;
  }
): Promise<GooglePlaceCandidate[]> {
  const res = await fetch("https://mybusiness.googleapis.com/v4/googleLocations:search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location: {
        title: params.name,
        storefrontAddress: buildStorefrontAddress(params.address),
        phoneNumbers: params.phone?.trim()
          ? { primaryPhone: params.phone.trim() }
          : undefined,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recherche Google Business échouée (${res.status}) : ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    googleLocations?: Array<{
      location?: {
        name?: string;
        locationName?: string;
        title?: string;
        storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string };
        metadata?: { placeId?: string };
      };
      requestAdminRightsUrl?: string;
    }>;
  };

  return (data.googleLocations ?? []).map((row) => {
    const loc = row.location;
    const placeId = loc?.metadata?.placeId ?? "";
    const addressParts = [
      ...(loc?.storefrontAddress?.addressLines ?? []),
      loc?.storefrontAddress?.postalCode,
      loc?.storefrontAddress?.locality,
    ].filter(Boolean);

    const claimed = Boolean(row.requestAdminRightsUrl);

    return {
      placeId: placeId || loc?.name || "",
      name: loc?.title ?? loc?.locationName ?? params.name,
      address: addressParts.join(", "),
      mapsUri: placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null,
      rating: null,
      reviewCount: null,
      businessStatus: null,
      matchKind: claimed ? "existing" : "unclaimed_hint",
      requestAdminRightsUrl: row.requestAdminRightsUrl ?? null,
    } satisfies GooglePlaceCandidate;
  });
}

export async function listGoogleBusinessAccounts(accessToken: string): Promise<string[]> {
  const res = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Liste comptes Google Business échouée (${res.status}) : ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { accounts?: Array<{ name?: string }> };
  return (data.accounts ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n));
}

export async function listGoogleBusinessLocationsForAccount(
  accessToken: string,
  accountName: string
): Promise<Array<{ name: string; placeId: string | null }>> {
  const out: Array<{ name: string; placeId: string | null }> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`
    );
    url.searchParams.set("readMask", "name,metadata");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Liste fiches Google échouée (${res.status}) : ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      locations?: Array<{ name?: string; metadata?: { placeId?: string } }>;
      nextPageToken?: string;
    };

    for (const loc of data.locations ?? []) {
      if (!loc.name) continue;
      out.push({
        name: loc.name,
        placeId: loc.metadata?.placeId ?? null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

export async function findGoogleLocationNameByPlaceId(
  accessToken: string,
  placeId: string
): Promise<string | null> {
  const trimmed = placeId.trim();
  if (!trimmed) return null;

  const accounts = await listGoogleBusinessAccounts(accessToken);
  for (const account of accounts) {
    const locations = await listGoogleBusinessLocationsForAccount(accessToken, account);
    const hit = locations.find((l) => l.placeId === trimmed);
    if (hit) return hit.name;
  }
  return null;
}

function buildRegularHours(opening: Record<string, { start: string; end: string }[]>) {
  return buildGoogleRegularHours(opening);
}

export async function updateGoogleBusinessLocationHours(
  accessToken: string,
  locationName: string,
  params: {
    regularHours: GoogleRegularHours;
    specialHours?: GoogleSpecialHours | null;
  }
): Promise<void> {
  const normalizedName = locationName.startsWith("locations/")
    ? locationName
    : `locations/${locationName.replace(/^locations\//, "")}`;

  const updateMask = params.specialHours
    ? "regularHours,specialHours"
    : "regularHours";

  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${normalizedName}`
  );
  url.searchParams.set("updateMask", updateMask);

  const body: Record<string, unknown> = {
    name: normalizedName,
    regularHours: params.regularHours,
  };
  if (params.specialHours) {
    body.specialHours = params.specialHours;
  }

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mise à jour horaires Google échouée (${res.status}) : ${text.slice(0, 400)}`);
  }
}

export async function createGoogleBusinessLocation(
  accessToken: string,
  params: {
    accountName: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    websiteUri?: string | null;
    opening?: Record<string, { start: string; end: string }[]>;
    requestId: string;
  }
): Promise<{ locationName: string; placeId: string | null }> {
  const regularHours = params.opening ? buildRegularHours(params.opening) : undefined;
  if (!regularHours) {
    throw new Error("Horaires d'ouverture ERP requis pour créer la fiche Google.");
  }

  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${params.accountName}/locations`
  );
  url.searchParams.set("requestId", params.requestId);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.name,
      languageCode: "fr",
      phoneNumbers: params.phone?.trim() ? { primaryPhone: params.phone.trim() } : undefined,
      storefrontAddress: buildStorefrontAddress(params.address),
      websiteUri: params.websiteUri?.trim() || undefined,
      regularHours,
      categories: {
        primaryCategory: { name: "gcid:restaurant" },
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Création fiche Google échouée (${res.status}) : ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    name?: string;
    metadata?: { placeId?: string };
  };

  return {
    locationName: data.name ?? "",
    placeId: data.metadata?.placeId ?? null,
  };
}

export async function fetchGoogleVoiceOfMerchant(
  accessToken: string,
  locationName: string
): Promise<{ verified: boolean }> {
  const res = await fetch(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}:getVoiceOfMerchantState`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return { verified: false };
  }

  const data = (await res.json()) as {
    hasVoiceOfMerchant?: boolean;
    hasBusinessAuthority?: boolean;
  };

  return {
    verified: Boolean(data.hasVoiceOfMerchant || data.hasBusinessAuthority),
  };
}
