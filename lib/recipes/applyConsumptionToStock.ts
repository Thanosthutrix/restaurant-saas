/**
 * Applique la consommation calculée au stock réel (inventory_items.current_stock_qty)
 * et au journal des mouvements (lignes `consumption` négatives).
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { revertServiceConsumptionMovements } from "@/lib/stock/fifo";
import { insertConsumptionMovements } from "@/lib/stock/stockMovements";
import type { ConsumedItem } from "./computeSalesConsumption";

export type ApplyConsumptionResult = { error: Error | null };

export type ApplyConsumptionMeta = {
  referenceLabel?: string | null;
  createdBy?: string | null;
};

/** Métadonnées pour annuler la consommation d’un service (restauration FIFO + suppression des mouvements). */
export type RevertConsumptionMeta = {
  serviceId: string;
};

/**
 * Décrémente le stock des inventory_items selon les quantités consommées.
 * Utilise GREATEST(0, current_stock_qty - qty) pour respecter la contrainte >= 0.
 */
export async function applyConsumptionToStock(
  restaurantId: string,
  consumption: ConsumedItem[],
  meta?: ApplyConsumptionMeta
): Promise<ApplyConsumptionResult> {
  if (consumption.length === 0) {
    console.log("[applyConsumptionToStock] Aucune consommation à appliquer.");
    return { error: null };
  }

  const ref = meta?.referenceLabel ?? null;
  const createdBy = meta?.createdBy ?? null;
  const movErr = await insertConsumptionMovements(restaurantId, consumption, ref, createdBy);
  if (movErr.error) return movErr;

  console.log(`[applyConsumptionToStock] Application pour ${consumption.length} composant(s)...`);

  for (const item of consumption) {
    if (item.qty <= 0) continue;
    const { data: row, error: fetchErr } = await supabaseServer
      .from("inventory_items")
      .select("current_stock_qty")
      .eq("id", item.inventory_item_id)
      .eq("restaurant_id", restaurantId)
      .single();

    if (fetchErr || row == null) {
      console.error("[applyConsumptionToStock] Erreur lecture", item.inventory_item_id, fetchErr?.message);
      return { error: new Error(`Composant ${item.inventory_item_id} introuvable ou erreur: ${fetchErr?.message ?? "inconnu"}`) };
    }

    const current = Number(row.current_stock_qty) || 0;
    const newQty = Math.max(0, current - item.qty);

    const { error: updateErr } = await supabaseServer
      .from("inventory_items")
      .update({ current_stock_qty: newQty })
      .eq("id", item.inventory_item_id)
      .eq("restaurant_id", restaurantId);

    if (updateErr) {
      console.error("[applyConsumptionToStock] Erreur update", item.name, item.inventory_item_id, updateErr.message);
      return { error: new Error(updateErr.message) };
    }

    console.log(`[applyConsumptionToStock] Décrémenté: ${item.name} (${item.inventory_item_id}) ${current} → ${newQty} (-${item.qty} ${item.unit})`);
  }

  console.log("[applyConsumptionToStock] Stock mis à jour avec succès.");
  return { error: null };
}

/**
 * Remet en stock les quantités qui avaient été consommées (inverse de applyConsumptionToStock).
 * Restaure les lots FIFO puis supprime les mouvements `consumption` du service (`Service <id>`).
 */
export async function revertConsumptionFromStock(
  restaurantId: string,
  consumption: ConsumedItem[],
  meta: RevertConsumptionMeta
): Promise<ApplyConsumptionResult> {
  if (consumption.length === 0) return { error: null };

  const fifoErr = await revertServiceConsumptionMovements(restaurantId, meta.serviceId);
  if (fifoErr.error) return fifoErr;

  for (const item of consumption) {
    if (item.qty <= 0) continue;
    const { data: row, error: fetchErr } = await supabaseServer
      .from("inventory_items")
      .select("current_stock_qty")
      .eq("id", item.inventory_item_id)
      .eq("restaurant_id", restaurantId)
      .single();

    if (fetchErr || row == null) {
      return { error: new Error(`Composant ${item.inventory_item_id} introuvable ou erreur: ${fetchErr?.message ?? "inconnu"}`) };
    }

    const current = Number(row.current_stock_qty) || 0;
    const newQty = current + item.qty;

    const { error: updateErr } = await supabaseServer
      .from("inventory_items")
      .update({ current_stock_qty: newQty })
      .eq("id", item.inventory_item_id)
      .eq("restaurant_id", restaurantId);

    if (updateErr) return { error: new Error(updateErr.message) };
  }

  return { error: null };
}
