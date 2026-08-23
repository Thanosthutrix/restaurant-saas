import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

/** Retire le restaurant de l'annuaire public Ubion (sans suppression). */
export async function unpublishRestaurantFromPortal(restaurantId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurants")
    .update({ is_public_listed: false })
    .eq("id", restaurantId)
    .eq("is_public_listed", true);

  if (error) {
    console.error("[unpublishRestaurantFromPortal]", restaurantId, error.message);
  }
}

export async function handleRestaurantAccessLost(restaurantId: string): Promise<void> {
  await unpublishRestaurantFromPortal(restaurantId);
}
