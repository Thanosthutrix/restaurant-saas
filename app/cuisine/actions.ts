"use server";

import { loadKitchenPassQueue, type KitchenPassQueue } from "@/lib/dining/kitchenPassData";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantMembership } from "@/lib/auth/restaurantActionAccess";
import { setDiningOrderLinePrepared, setDiningOrderLinesPrepared } from "@/app/salle/actions";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function memberGate(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantMembership(user.id, restaurantId);
}

export async function loadKitchenPassAction(
  restaurantId: string
): Promise<ActionResult<KitchenPassQueue>> {
  const auth = await memberGate(restaurantId);
  if (!auth.ok) return auth;

  const { data, error } = await loadKitchenPassQueue(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function markKitchenLinePreparedAction(params: {
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

export async function markKitchenTicketAllPreparedAction(params: {
  restaurantId: string;
  orderId: string;
  lineIds: string[];
}): Promise<ActionResult> {
  return setDiningOrderLinesPrepared(params);
}
