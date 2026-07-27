import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { syncMetaMessagingFromGraph } from "./messagingSync";

/** Sync Graph API + bot catch-up pour tous les restaurants Meta connectés (cron serveur). */
export async function syncAllRestaurantsMetaMessaging(): Promise<{
  restaurants: number;
  syncedMessages: number;
  errors: string[];
}> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("restaurant_id, page_access_token, facebook_page_id")
    .not("page_access_token", "is", null)
    .not("facebook_page_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  let syncedMessages = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const restaurantId = row.restaurant_id as string;
    try {
      const result = await syncMetaMessagingFromGraph(restaurantId);
      syncedMessages += result.syncedMessages;
    } catch (err) {
      errors.push(
        `${restaurantId}: ${err instanceof Error ? err.message : "sync impossible"}`
      );
    }
  }

  return { restaurants: rows.length, syncedMessages, errors };
}
