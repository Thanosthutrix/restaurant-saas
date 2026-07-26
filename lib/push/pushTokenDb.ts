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

/** Tokens push des utilisateurs liés au restaurant (équipe + propriétaire). */
export async function listPushTokensForRestaurant(
  restaurantId: string
): Promise<PushTokenRow[]> {
  const { data: restaurant, error: restErr } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restErr) return [];

  const userIds = new Set<string>();
  if (restaurant?.owner_id) userIds.add(restaurant.owner_id as string);

  const { data: staffRows } = await supabaseServer
    .from("staff_members")
    .select("user_id")
    .eq("restaurant_id", restaurantId)
    .not("user_id", "is", null);

  for (const row of staffRows ?? []) {
    if (row.user_id) userIds.add(row.user_id as string);
  }

  const byRestaurant = await supabaseServer
    .from("user_push_tokens")
    .select("token, platform, user_id")
    .eq("restaurant_id", restaurantId);

  const byUsers =
    userIds.size > 0
      ? await supabaseServer
          .from("user_push_tokens")
          .select("token, platform, user_id")
          .in("user_id", [...userIds])
      : { data: [] as { token: string; platform: string; user_id: string }[] };

  const seen = new Set<string>();
  const out: PushTokenRow[] = [];

  for (const row of [...(byRestaurant.data ?? []), ...(byUsers.data ?? [])]) {
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

export async function deletePushToken(token: string): Promise<void> {
  await supabaseServer.from("user_push_tokens").delete().eq("token", token);
}
