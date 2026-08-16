import { supabaseServer } from "@/lib/supabaseServer";

export type PushPlatform = "ios" | "android" | "web";

export async function upsertUserPushToken(params: {
  userId: string;
  restaurantId: string | null;
  token: string;
  platform: PushPlatform;
}): Promise<{ error: Error | null }> {
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

export type PushTokenRow = {
  token: string;
  platform: PushPlatform;
  userId: string;
};

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
    .not("user_id", "is", null);

  for (const row of staffRows ?? []) {
    if (row.user_id) userIds.add(row.user_id as string);
  }

  return userIds;
}

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

/**
 * Tokens push pour un établissement précis.
 * N'inclut que les appareils enregistrés pour CE restaurant (cookie actif au moment du register).
 * Ne notifie pas un autre établissement du même utilisateur multi-sites.
 */
export async function listPushTokensForRestaurant(
  restaurantId: string
): Promise<PushTokenRow[]> {
  const { data: scopedRows, error: scopedErr } = await supabaseServer
    .from("user_push_tokens")
    .select("token, platform, user_id")
    .eq("restaurant_id", restaurantId);

  if (scopedErr) return [];

  const memberIds = await loadRestaurantMemberUserIds(restaurantId);

  let legacyRows: { token: string; platform: string; user_id: string }[] = [];
  if (memberIds.size > 0) {
    const { data } = await supabaseServer
      .from("user_push_tokens")
      .select("token, platform, user_id")
      .is("restaurant_id", null)
      .in("user_id", [...memberIds]);
    legacyRows = data ?? [];
  }

  return dedupeTokenRows([...(scopedRows ?? []), ...legacyRows]);
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
