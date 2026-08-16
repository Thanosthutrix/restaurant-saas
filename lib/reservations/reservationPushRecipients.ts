import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { getReservationPushRecipientUserIds } from "@/lib/push/pushTokenDb";

export type ReservationPushRecipientOption = {
  userId: string;
  label: string;
  kind: "owner" | "staff";
};

export async function listReservationPushRecipientOptions(
  restaurantId: string
): Promise<ReservationPushRecipientOption[]> {
  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("owner_id, name")
    .eq("id", restaurantId)
    .maybeSingle();

  const out: ReservationPushRecipientOption[] = [];
  const ownerId = restaurant?.owner_id as string | undefined;
  if (ownerId) {
    out.push({
      userId: ownerId,
      label: "Propriétaire",
      kind: "owner",
    });
  }

  const { data: staffRows } = await supabaseServer
    .from("staff_members")
    .select("user_id, display_name, app_role")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .not("user_id", "is", null)
    .order("display_name");

  for (const row of staffRows ?? []) {
    const userId = row.user_id as string;
    if (!userId || userId === ownerId) continue;
    const name = String(row.display_name ?? "Collaborateur").trim();
    const role = row.app_role ? String(row.app_role) : null;
    out.push({
      userId,
      label: role ? `${name} (${role})` : name,
      kind: "staff",
    });
  }

  return out;
}

export async function resolveActiveReservationPushRecipientIds(
  restaurantId: string
): Promise<string[]> {
  return getReservationPushRecipientUserIds(restaurantId);
}
