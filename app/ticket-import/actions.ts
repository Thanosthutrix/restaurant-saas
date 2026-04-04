"use server";

import { revalidatePath } from "next/cache";
import { createDish } from "@/lib/db";
import {
  updateTicketImportLine,
  addTicketImportLine,
} from "@/lib/sales";

export type TicketImportActionResult = { ok: true } | { ok: false; error: string };

/**
 * Met à jour une ligne (quantité, plat associé, ou statut ignorée).
 */
export async function updateLine(
  lineId: string,
  restaurantId: string,
  payload: { qty?: number; dish_id?: string | null; ignored?: boolean }
): Promise<TicketImportActionResult> {
  const { error } = await updateTicketImportLine(lineId, restaurantId, payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ticket-import/[id]", "page");
  return { ok: true };
}

/**
 * Ajoute une ligne manuelle au ticket.
 */
export async function addLine(
  ticketImportId: string,
  restaurantId: string,
  payload: { raw_label: string; qty: number; dish_id?: string | null }
): Promise<TicketImportActionResult> {
  const { error } = await addTicketImportLine(ticketImportId, restaurantId, payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ticket-import/[id]", "page");
  return { ok: true };
}

/**
 * Associe une ligne à un plat existant (et réactive si elle était ignorée).
 */
export async function associateLineToDish(
  lineId: string,
  restaurantId: string,
  dishId: string
): Promise<TicketImportActionResult> {
  return updateLine(lineId, restaurantId, { dish_id: dishId, ignored: false });
}

/**
 * Marque une ligne comme ignorée (elle ne sera pas incluse dans les ventes).
 */
export async function ignoreLine(lineId: string, restaurantId: string): Promise<TicketImportActionResult> {
  return updateLine(lineId, restaurantId, { ignored: true });
}

/**
 * Réactive une ligne ignorée (remet ignorée à false).
 */
export async function unignoreLine(lineId: string, restaurantId: string): Promise<TicketImportActionResult> {
  return updateLine(lineId, restaurantId, { ignored: false });
}

/**
 * Crée un nouveau plat puis associe la ligne à ce plat (flux "Nouveau plat").
 */
export async function createDishAndAssociateLine(
  restaurantId: string,
  lineId: string,
  dishName: string
): Promise<TicketImportActionResult> {
  const { data: dish, error: createError } = await createDish(restaurantId, dishName.trim());
  if (createError || !dish) return { ok: false, error: createError?.message ?? "Impossible de créer le plat." };
  return updateLine(lineId, restaurantId, { dish_id: dish.id, ignored: false });
}
