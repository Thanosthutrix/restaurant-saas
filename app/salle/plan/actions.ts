"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import {
  getRestaurantFloorPlanDocument,
  upsertRestaurantFloorPlanDocument,
} from "@/lib/dining/floorPlanDb";
import {
  parseStoredFloorPlanDocument,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";

type ActionResult = { ok: true } | { ok: false; error: string };

async function gateFloorPlan(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantAction(user.id, restaurantId, "reservations.mutate");
}

export async function saveFloorPlanLayoutAction(
  restaurantId: string,
  document: StoredFloorPlanDocument
): Promise<ActionResult> {
  const authz = await gateFloorPlan(restaurantId);
  if (!authz.ok) return authz;

  const parsed = parseStoredFloorPlanDocument(document);
  const { error } = await upsertRestaurantFloorPlanDocument(restaurantId, parsed);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/salle/plan");
  revalidatePath("/salle");
  return { ok: true };
}

export async function loadFloorPlanLayoutAction(
  restaurantId: string
): Promise<{ ok: true; document: StoredFloorPlanDocument | null } | { ok: false; error: string }> {
  const authz = await gateFloorPlan(restaurantId);
  if (!authz.ok) return authz;

  const { data, error } = await getRestaurantFloorPlanDocument(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, document: data };
}
