"use server";

import { revalidatePath } from "next/cache";
import { getCurrentRestaurant } from "@/lib/auth";
import { createDeliveryNote } from "@/lib/db";
import { runDeliveryNoteAnalysis } from "@/lib/run-delivery-note-analysis";

export type CreateBlReceptionResult =
  | { ok: true; deliveryNoteId: string; analysisError?: string }
  | { ok: false; error: string };

/**
 * Crée une réception à partir d’une photo de BL (sans commande app), puis lance l’analyse IA des lignes.
 */
export async function createReceptionFromBlPhotoAction(params: {
  restaurantId: string;
  supplierId: string;
  filePath: string;
  fileName: string;
}): Promise<CreateBlReceptionResult> {
  const restaurant = await getCurrentRestaurant();
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

  const analysis = await runDeliveryNoteAnalysis(data.id, params.restaurantId);

  revalidatePath("/livraison");
  revalidatePath("/suppliers");
  revalidatePath("/suppliers/[id]", "page");
  revalidatePath(`/receiving/${data.id}`);

  if (!analysis.ok) {
    return {
      ok: true,
      deliveryNoteId: data.id,
      analysisError: analysis.error,
    };
  }

  return { ok: true, deliveryNoteId: data.id };
}
