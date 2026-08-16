/**
 * Rate limiting recherche IA B2C — 5 requêtes / fenêtre de 24 h par clé client.
 */

import { supabaseServer } from "@/lib/supabaseServer";

const MAX_SEARCHES = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function checkAndIncrementAiSearchRateLimit(
  clientKey: string
): Promise<{ allowed: true; remaining: number } | { allowed: false; remaining: 0 }> {
  const now = Date.now();
  const { data } = await supabaseServer
    .from("b2c_ai_search_usage")
    .select("search_count, window_started_at")
    .eq("client_key", clientKey)
    .maybeSingle();

  const row = data as { search_count: number; window_started_at: string } | null;
  const windowStart = row ? new Date(row.window_started_at).getTime() : 0;
  const expired = !row || now - windowStart > WINDOW_MS;

  if (expired) {
    await supabaseServer.from("b2c_ai_search_usage").upsert({
      client_key: clientKey,
      search_count: 1,
      window_started_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
    return { allowed: true, remaining: MAX_SEARCHES - 1 };
  }

  const count = row?.search_count ?? 0;
  if (count >= MAX_SEARCHES) {
    return { allowed: false, remaining: 0 };
  }

  await supabaseServer
    .from("b2c_ai_search_usage")
    .update({
      search_count: count + 1,
      updated_at: new Date(now).toISOString(),
    })
    .eq("client_key", clientKey);

  return { allowed: true, remaining: MAX_SEARCHES - count - 1 };
}
