import "server-only";

import type { User } from "@supabase/supabase-js";
import { extractOAuthNameParts } from "@/lib/auth/oauthProfile";
import { getConsumerProfileByUserId, upsertConsumerProfile } from "@/lib/public/consumer/consumerDb";

/** Pré-remplit le profil consommateur après une première connexion OAuth. */
export async function bootstrapConsumerProfileFromOAuth(user: User): Promise<void> {
  const existing = await getConsumerProfileByUserId(user.id, user.email ?? null);
  if (existing?.first_name && existing?.last_name) return;

  const { firstName, lastName } = extractOAuthNameParts(user.user_metadata as Record<string, unknown>);
  if (!firstName && !lastName) return;

  await upsertConsumerProfile({
    userId: user.id,
    firstName: firstName || existing?.first_name || "Client",
    lastName: lastName || existing?.last_name || "",
    phone: existing?.phone ?? null,
    marketingOptIn: existing?.marketing_opt_in ?? false,
  });
}
