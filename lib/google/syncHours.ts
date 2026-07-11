import {
  findGoogleLocationNameByPlaceId,
  updateGoogleBusinessLocationHours,
} from "@/lib/google/businessProfile";
import { buildGoogleRegularHours, buildGoogleSpecialHours } from "@/lib/google/googleHours";
import {
  getGoogleAccessTokenForRestaurant,
  getRestaurantGoogleConnectionRow,
  getRestaurantGoogleRow,
  markRestaurantGoogleHoursSynced,
  updateRestaurantGoogleConnectionMeta,
} from "@/lib/google/googleDb";
import { getRestaurantPlanningHourMaps, listPlanningDayOverridesInRange } from "@/lib/staff/staffDb";
import { addDays, toISODateString } from "@/lib/staff/weekUtils";

export type GoogleHoursSyncResult =
  | { ok: true; syncedAt: string }
  | { ok: false; error: string; skipped?: boolean };

const SYNC_HORIZON_DAYS = 365;

async function resolveGoogleLocationName(
  restaurantId: string,
  accessToken: string
): Promise<string | null> {
  const connection = await getRestaurantGoogleConnectionRow(restaurantId);
  if (connection?.google_location_name?.trim()) {
    return connection.google_location_name.trim();
  }

  const profile = await getRestaurantGoogleRow(restaurantId);
  const placeId = profile?.google_place_id?.trim();
  if (!placeId) return null;

  const found = await findGoogleLocationNameByPlaceId(accessToken, placeId);
  if (found) {
    await updateRestaurantGoogleConnectionMeta(restaurantId, {
      googleLocationName: found,
    });
  }
  return found;
}

export async function syncRestaurantHoursToGoogle(
  restaurantId: string
): Promise<GoogleHoursSyncResult> {
  const accessToken = await getGoogleAccessTokenForRestaurant(restaurantId);
  if (!accessToken) {
    return {
      ok: false,
      skipped: true,
      error: "Compte Google Business non connecté.",
    };
  }

  const locationName = await resolveGoogleLocationName(restaurantId, accessToken);
  if (!locationName) {
    return {
      ok: false,
      skipped: true,
      error:
        "Fiche Google introuvable pour la synchronisation. Liez la fiche avec un compte Google connecté.",
    };
  }

  const hourMaps = await getRestaurantPlanningHourMaps(restaurantId);
  const regularHours = buildGoogleRegularHours(hourMaps.opening);
  if (!regularHours) {
    return {
      ok: false,
      error: "Aucun horaire d'ouverture ERP à envoyer vers Google.",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fromYmd = toISODateString(today);
  const toExclusive = toISODateString(addDays(today, SYNC_HORIZON_DAYS));

  const overrides = await listPlanningDayOverridesInRange(restaurantId, fromYmd, toExclusive);
  const specialHours = buildGoogleSpecialHours(hourMaps.opening, overrides, fromYmd);

  try {
    await updateGoogleBusinessLocationHours(accessToken, locationName, {
      regularHours,
      specialHours,
    });

    const syncedAt = new Date().toISOString();
    await markRestaurantGoogleHoursSynced(restaurantId, syncedAt);
    await updateRestaurantGoogleConnectionMeta(restaurantId, {
      lastError: null,
      connectionStatus: "connected",
    });

    return { ok: true, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Synchronisation Google impossible.";
    await updateRestaurantGoogleConnectionMeta(restaurantId, {
      lastError: message,
      connectionStatus: "needs_action",
    });
    return { ok: false, error: message };
  }
}

/** Sync best-effort : ne lève pas d'exception. */
export async function trySyncRestaurantHoursToGoogle(
  restaurantId: string
): Promise<GoogleHoursSyncResult | null> {
  try {
    const result = await syncRestaurantHoursToGoogle(restaurantId);
    if (!result.ok && !result.skipped) {
      console.warn("[google/syncHours]", restaurantId, result.error);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Synchronisation Google impossible.";
    console.warn("[google/syncHours]", restaurantId, message);
    await updateRestaurantGoogleConnectionMeta(restaurantId, {
      lastError: message,
      connectionStatus: "needs_action",
    }).catch(() => undefined);
    return { ok: false, error: message };
  }
}
