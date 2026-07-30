"use server";

import { loadBarPassQueue, type DiningPassQueue } from "@/lib/dining/diningPassData";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantMembership } from "@/lib/auth/restaurantActionAccess";
import { setDiningOrderLinePrepared } from "@/app/salle/actions";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function memberGate(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantMembership(user.id, restaurantId);
}

export async function loadBarPassAction(
  restaurantId: string
): Promise<ActionResult<DiningPassQueue>> {
  const auth = await memberGate(restaurantId);
  if (!auth.ok) return auth;

  const { data, error } = await loadBarPassQueue(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function markBarLinePreparedAction(params: {
  restaurantId: string;
  lineId: string;
}): Promise<ActionResult> {
  const result = await setDiningOrderLinePrepared({
    restaurantId: params.restaurantId,
    lineId: params.lineId,
    isPrepared: true,
  });
  if (!result.ok) return result;
  return { ok: true };
}
