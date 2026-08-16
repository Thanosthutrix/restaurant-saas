"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantMembership } from "@/lib/auth/restaurantActionAccess";
import { createWasteLog } from "@/lib/analysis/wasteDb";
import type { ActionResult } from "@/app/inventory/actions";

export async function logSupplyBreakageAction(params: {
  restaurantId: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  notes?: string | null;
}): Promise<ActionResult<{ wasteLogId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };
  const gate = await assertRestaurantMembership(user.id, params.restaurantId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { data, error } = await createWasteLog({
    restaurantId: params.restaurantId,
    inventoryItemId: params.inventoryItemId,
    wasteType: "supply",
    reason: "breakage",
    quantity: params.quantity,
    unit: params.unit,
    notes: params.notes,
    loggedBy: user.id,
    applyStock: true,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Impossible d'enregistrer la casse." };
  }

  revalidatePath("/inventory/supplies");
  revalidatePath("/inventory");
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/orders/suggestions", "page");
  revalidatePath("/achats");
  revalidatePath("/dashboard");

  return { ok: true, data: { wasteLogId: data.id } };
}
