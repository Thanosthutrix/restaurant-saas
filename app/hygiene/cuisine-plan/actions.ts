"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import {
  getRestaurantKitchenFloorPlanDocument,
  upsertRestaurantKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDb";
import {
  parseStoredKitchenFloorPlanDocument,
  type StoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDocument";

type ActionResult = { ok: true } | { ok: false; error: string };

async function gateKitchenPlan(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
}

export async function saveKitchenFloorPlanLayoutAction(
  restaurantId: string,
  document: StoredKitchenFloorPlanDocument
): Promise<ActionResult> {
  const authz = await gateKitchenPlan(restaurantId);
  if (!authz.ok) return authz;

  const parsed = parseStoredKitchenFloorPlanDocument(document);
  const { error } = await upsertRestaurantKitchenFloorPlanDocument(restaurantId, parsed);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hygiene/cuisine-plan");
  revalidatePath("/hygiene/temperatures-ouverture");
  return { ok: true };
}

export async function loadKitchenFloorPlanLayoutAction(
  restaurantId: string
): Promise<{ ok: true; document: StoredKitchenFloorPlanDocument | null } | { ok: false; error: string }> {
  const authz = await gateKitchenPlan(restaurantId);
  if (!authz.ok) return authz;

  const { data, error } = await getRestaurantKitchenFloorPlanDocument(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, document: data };
}
