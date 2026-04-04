"use server";

import { revalidatePath } from "next/cache";
import { createOpenCounterTicketOrder } from "@/lib/dining/diningDb";
import type { ActionResult } from "@/app/salle/actions";

function quickCounterLabel(): string {
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
  return `Comptoir ${time} (${suffix})`;
}

/** Ticket comptoir : vente directe depuis la caisse (sans table). */
export async function createCounterDiningOrder(params: {
  restaurantId: string;
  /** Ignoré si `quick` est true. */
  ticketLabel?: string;
  /** Libellé auto (horodatage + code court). */
  quick?: boolean;
}): Promise<ActionResult<{ orderId: string }>> {
  let label = (params.ticketLabel ?? "").trim();
  if (params.quick) {
    label = quickCounterLabel();
  }
  if (!label) {
    return { ok: false, error: "Indiquez un nom pour le ticket ou utilisez la vente rapide." };
  }
  if (label.length > 120) {
    return { ok: false, error: "Libellé trop long (120 caractères max.)." };
  }

  const { orderId, error } = await createOpenCounterTicketOrder(params.restaurantId, label);
  if (error || !orderId) {
    return { ok: false, error: error?.message ?? "Impossible de créer le ticket." };
  }

  revalidatePath("/caisse");
  revalidatePath("/salle");
  return { ok: true, data: { orderId } };
}
