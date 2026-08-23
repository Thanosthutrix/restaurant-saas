import "server-only";

import { clampBillableUsers } from "@/lib/billing/config";
import { supabaseServer } from "@/lib/supabaseServer";

/** Propriétaire + collaborateurs actifs (plafonné à 12). */
export async function countBillableUsers(restaurantId: string): Promise<number> {
  const { count } = await supabaseServer
    .from("staff_members")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("active", true);

  return clampBillableUsers(1 + (count ?? 0));
}

/** Quantity passée au Checkout (price Stripe à paliers gradués). */
export async function getCheckoutUserQuantity(restaurantId: string): Promise<number> {
  return countBillableUsers(restaurantId);
}
