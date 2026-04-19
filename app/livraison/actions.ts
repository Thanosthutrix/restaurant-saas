"use server";

import { revalidatePath } from "next/cache";
import { getRestaurantForPage } from "@/lib/auth";
import { createDeliveryNote } from "@/lib/db";

export type CreateBlReceptionResult =
  | { ok: true; deliveryNoteId: string }
  | { ok: false; error: string };

/** Crée une réception avec le fichier BL archivé. Les lignes se saisissent sur la fiche réception. */
export async function createReceptionFromBlPhotoAction(params: {
  restaurantId: string;
  supplierId: string;
  filePath: string;
  fileName: string;
}): Promise<CreateBlReceptionResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== params.restaurantId) {
    return { ok: false, error: "Non autorisé." };
  }

  const { data, error } = await createDeliveryNote({
    restaurantId: params.restaurantId,
    supplierId: params.supplierId,
    purchaseOrderId: null,
    filePath: params.filePath,
    fileName: params.fileName,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Impossible de créer la réception." };
  }

  revalidatePath("/livraison");
  revalidatePath("/suppliers");
  revalidatePath("/suppliers/[id]", "page");
  revalidatePath(`/receiving/${data.id}`);

  return { ok: true, deliveryNoteId: data.id };
}
