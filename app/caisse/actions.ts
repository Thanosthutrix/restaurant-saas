"use server";

import { revalidatePath } from "next/cache";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import { addDishToDiningOrder } from "@/app/salle/actions";
import type { ActionResult } from "@/app/salle/actions";
import {
  createOpenCounterTicketOrder,
  getDiningOrder,
  getDiningOrderLines,
  lineGrossTtc,
  lineTtc,
  orderTotalTtc,
} from "@/lib/dining/diningDb";
import { parseDiningDiscountKind } from "@/lib/dining/lineDiscount";
import { supabaseServer } from "@/lib/supabaseServer";

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
  /** Fiche client (Base clients) liée à la commande. */
  customerId?: string | null;
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

  const { orderId, error } = await createOpenCounterTicketOrder(
    params.restaurantId,
    label,
    params.customerId ?? null
  );
  if (error || !orderId) {
    return { ok: false, error: error?.message ?? "Impossible de créer le ticket." };
  }

  revalidatePath("/caisse");
  revalidatePath("/salle");
  return { ok: true, data: { orderId } };
}

function isOpenCounterOrder(row: {
  status: string;
  dining_table_id: string | null;
  counter_ticket_label: string | null;
}): boolean {
  return (
    row.status === "open" &&
    row.dining_table_id == null &&
    (row.counter_ticket_label ?? "").trim().length > 0
  );
}

/**
 * Ajoute un plat au ticket comptoir « rapide » : réutilise `existingOrderId` s’il est encore ouvert
 * (comptoir), sinon crée un nouveau ticket rapide puis ajoute la ligne.
 */
export async function addDishToQuickCounterOrReuse(params: {
  restaurantId: string;
  dishId: string;
  /** Dernier ticket rapide (session navigateur), optionnel. */
  existingOrderId?: string | null;
}): Promise<ActionResult<{ orderId: string }>> {
  const { restaurantId, dishId } = params;
  const existing = params.existingOrderId?.trim() ?? "";

  if (existing) {
    const ord = await getDiningOrder(existing, restaurantId);
    if (!ord.error && ord.data && isOpenCounterOrder(ord.data)) {
      const add = await addDishToDiningOrder({ restaurantId, orderId: existing, dishId });
      if (add.ok) return { ok: true, data: { orderId: existing } };
    }
  }

  const created = await createCounterDiningOrder({ restaurantId, quick: true });
  if (!created.ok) return created;
  const newId = created.data?.orderId;
  if (!newId) return { ok: false, error: "Création du ticket impossible." };

  const add = await addDishToDiningOrder({ restaurantId, orderId: newId, dishId });
  if (!add.ok) return { ok: false, error: add.error };

  return { ok: true, data: { orderId: newId } };
}

export type QuickCounterSnapshot = {
  ticketLabel: string;
  lines: DiningLineClient[];
  totalTtc: number;
  customerEmail: string | null;
};

/**
 * État du ticket comptoir pour le panneau vente rapide (lignes + total).
 */
export async function getQuickCounterOrderSnapshot(
  restaurantId: string,
  orderId: string
): Promise<{ ok: true; data: QuickCounterSnapshot } | { ok: false; error: string }> {
  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error || !orderRes.data) {
    return { ok: false, error: "Commande introuvable." };
  }
  const order = orderRes.data;
  if (order.status !== "open") {
    return { ok: false, error: "Commande déjà encaissée." };
  }
  if (!isOpenCounterOrder(order)) {
    return { ok: false, error: "Pas un ticket comptoir." };
  }

  const { data: lines, error: lErr } = await getDiningOrderLines(orderId, restaurantId);
  if (lErr) return { ok: false, error: lErr.message };

  const lineClients: DiningLineClient[] = (lines ?? []).map((l) => {
    const d = Array.isArray(l.dishes) ? l.dishes[0] : l.dishes;
    const dv = l.discount_value;
    const discountValue = dv == null || dv === "" ? null : Number(dv);
    return {
      id: l.id,
      dishId: l.dish_id,
      dishName: d?.name ?? "Plat",
      qty: Number(l.qty),
      isPrepared: Boolean((l as { is_prepared?: boolean }).is_prepared),
      lineGrossTtc: lineGrossTtc(l),
      lineTotalTtc: lineTtc(l),
      discountKind: parseDiningDiscountKind(l.discount_kind),
      discountValue: discountValue != null && Number.isFinite(discountValue) ? discountValue : null,
    };
  });

  const totalTtc = orderTotalTtc(lines ?? []);

  let ticketLabel = (order.counter_ticket_label ?? "").trim() || "Comptoir";
  let customerEmail: string | null = null;
  if (order.customer_id) {
    const { data: cRow, error: cErr } = await supabaseServer
      .from("restaurant_customers")
      .select("display_name, email")
      .eq("id", order.customer_id)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .maybeSingle();
    if (!cErr && cRow) {
      const r = cRow as { display_name: string; email: string | null };
      const dn = String(r.display_name ?? "").trim();
      if (dn) ticketLabel = dn;
      const em = String(r.email ?? "").trim();
      customerEmail = em || null;
    }
  }

  return { ok: true, data: { ticketLabel, lines: lineClients, totalTtc, customerEmail } };
}
