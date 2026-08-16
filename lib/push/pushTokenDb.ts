import { supabaseServer } from "@/lib/supabaseServer";
import { getReservationCapacitySettings } from "@/lib/reservations/capacitySettingsDb";

export type PushPlatform = "ios" | "android" | "web";

export async function upsertUserPushToken(params: {
  userId: string;
  restaurantId: string | null;
  token: string;
  platform: PushPlatform;
}): Promise<{ error: Error | null }> {
  await releasePushTokenFromOtherUsers(params.token, params.userId);

  const { error } = await supabaseServer.from("user_push_tokens").upsert(
    {
      user_id: params.userId,
      restaurant_id: params.restaurantId,
      token: params.token,
      platform: params.platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  return { error: error ? new Error(error.message) : null };
}

/** Retire le token de tout autre compte sur cet appareil (session précédente). */
export async function releasePushTokenFromOtherUsers(
  token: string,
  keepUserId: string
): Promise<void> {
  await supabaseServer
    .from("user_push_tokens")
    .delete()
    .eq("token", token)
    .neq("user_id", keepUserId);
}

export type PushTokenRow = {
  token: string;
  platform: PushPlatform;
  userId: string;
};

function dedupeTokenRows(
  rows: { token: string; platform: string; user_id: string }[]
): PushTokenRow[] {
  const seen = new Set<string>();
  const out: PushTokenRow[] = [];

  for (const row of rows) {
    const token = row.token as string;
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const platform = row.platform as PushPlatform;
    if (platform !== "ios" && platform !== "android") continue;
    out.push({
      token,
      platform,
      userId: row.user_id as string,
    });
  }

  return out;
}

async function loadRestaurantMemberUserIds(restaurantId: string): Promise<Set<string>> {
  const userIds = new Set<string>();

  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurant?.owner_id) userIds.add(restaurant.owner_id as string);

  const { data: staffRows } = await supabaseServer
    .from("staff_members")
    .select("user_id")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .not("user_id", "is", null);

  for (const row of staffRows ?? []) {
    if (row.user_id) userIds.add(row.user_id as string);
  }

  return userIds;
}

/** Tokens push pour notifications opérationnelles (salle, cuisine, Meta…). */
export async function listPushTokensForRestaurant(
  restaurantId: string
): Promise<PushTokenRow[]> {
  const memberIds = await loadRestaurantMemberUserIds(restaurantId);
  if (memberIds.size === 0) return [];

  const { data: scopedRows, error: scopedErr } = await supabaseServer
    .from("user_push_tokens")
    .select("token, platform, user_id")
    .eq("restaurant_id", restaurantId)
    .in("user_id", [...memberIds]);

  if (scopedErr) return [];
  return dedupeTokenRows(scopedRows ?? []);
}

/** Utilisateurs autorisés à recevoir les push réservation (paramétrable). */
export async function getReservationPushRecipientUserIds(
  restaurantId: string
): Promise<string[]> {
  const settings = await getReservationCapacitySettings(restaurantId);
  const configured = settings.reservation_push_user_ids;
  if (configured && configured.length > 0) {
    const members = await loadRestaurantMemberUserIds(restaurantId);
    return configured.filter((id) => members.has(id));
  }

  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  const ownerId = restaurant?.owner_id as string | undefined;
  return ownerId ? [ownerId] : [];
}

/** Push réservation : établissement actif sur l'appareil + destinataires autorisés. */
export async function listReservationPushTokensForRestaurant(
  restaurantId: string
): Promise<PushTokenRow[]> {
  const recipientIds = await getReservationPushRecipientUserIds(restaurantId);
  if (recipientIds.length === 0) return [];

  const { data, error } = await supabaseServer
    .from("user_push_tokens")
    .select("token, platform, user_id")
    .eq("restaurant_id", restaurantId)
    .in("user_id", recipientIds);

  if (error) return [];
  return dedupeTokenRows(data ?? []);
}

export async function unregisterUserPushToken(
  userId: string,
  token: string
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("user_push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", token);

  return { error: error ? new Error(error.message) : null };
}

export async function listPushTokensForUser(userId: string): Promise<PushTokenRow[]> {
  const { data, error } = await supabaseServer
    .from("user_push_tokens")
    .select("token, platform, user_id")
    .eq("user_id", userId);

  if (error || !data) return [];

  return data
    .map((row) => ({
      token: row.token as string,
      platform: row.platform as PushPlatform,
      userId: row.user_id as string,
    }))
    .filter((row) => row.platform === "ios" || row.platform === "android");
}

export async function deletePushToken(token: string): Promise<void> {
  await supabaseServer.from("user_push_tokens").delete().eq("token", token);
}
