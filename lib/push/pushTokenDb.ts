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
