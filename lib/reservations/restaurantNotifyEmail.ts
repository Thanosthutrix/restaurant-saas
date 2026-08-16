import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { getReservationCapacitySettings } from "./capacitySettingsDb";

/** E-mail de notification réservation pour l'équipe (override ou propriétaire). */
export async function getRestaurantReservationNotifyEmail(
  restaurantId: string
): Promise<string | null> {
  const settings = await getReservationCapacitySettings(restaurantId);
  if (settings.reservation_notify_email) {
    return settings.reservation_notify_email;
  }

  const { data: restaurant } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  const ownerId = restaurant?.owner_id as string | undefined;
  if (!ownerId) return null;

  const { data: userData } = await supabaseServer.auth.admin.getUserById(ownerId);
  return userData?.user?.email?.trim() ?? null;
}
