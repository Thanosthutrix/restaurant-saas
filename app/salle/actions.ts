"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentRestaurant } from "@/lib/auth";
import { createService } from "@/lib/db";
import { recordServiceSalesAndApplyStock } from "@/lib/service/recordServiceSalesAndApplyStock";
import type { ServiceType } from "@/lib/constants";
import {
  ensureOpenDiningOrder,
  getDiningOrder,
  getDiningOrderLines,
  orderTotalTtc,
} from "@/lib/dining/diningDb";
import { toNumber } from "@/lib/utils/safeNumeric";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function todayParisYmd(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function mergeSalesByDish(
  lines: { dish_id: string; qty: unknown }[]
): { dish_id: string; qty: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    const q = toNumber(l.qty);
    if (q <= 0) continue;
    map.set(l.dish_id, (map.get(l.dish_id) ?? 0) + q);
  }
  return [...map.entries()].map(([dish_id, qty]) => ({ dish_id, qty }));
}

export async function openOrGetDiningOrder(params: {
  restaurantId: string;
  diningTableId: string;
}): Promise<ActionResult<{ orderId: string }>> {
  const { restaurantId, diningTableId } = params;
  const { orderId, error } = await ensureOpenDiningOrder(restaurantId, diningTableId);
  if (error || !orderId) return { ok: false, error: error?.message ?? "Impossible d’ouvrir la commande." };
  revalidatePath("/salle");
  revalidatePath("/caisse");
  return { ok: true, data: { orderId } };
}

export async function addDishToDiningOrder(params: {
  restaurantId: string;
  orderId: string;
  dishId: string;
  qty?: number;
}): Promise<ActionResult> {
  const { restaurantId, orderId, dishId } = params;
  const qty = params.qty != null && Number.isFinite(params.qty) && params.qty > 0 ? params.qty : 1;

  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  if (!orderRes.data || orderRes.data.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const { data: line, error: findErr } = await supabaseServer
    .from("dining_order_lines")
    .select("id, qty")
    .eq("dining_order_id", orderId)
    .eq("dish_id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (findErr) return { ok: false, error: findErr.message };

  if (line) {
    const newQty = toNumber((line as { qty: unknown }).qty) + qty;
    const { error: upErr } = await supabaseServer
      .from("dining_order_lines")
      .update({ qty: newQty })
      .eq("id", (line as { id: string }).id);
    if (upErr) return { ok: false, error: upErr.message };
  } else {
    const { error: insErr } = await supabaseServer.from("dining_order_lines").insert({
      restaurant_id: restaurantId,
      dining_order_id: orderId,
      dish_id: dishId,
      qty,
    });
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/salle");
  revalidatePath(`/salle/commande/${orderId}`);
  revalidatePath("/caisse");
  return { ok: true };
}

export async function setDiningOrderLineQty(params: {
  restaurantId: string;
  lineId: string;
  qty: number;
}): Promise<ActionResult> {
  const { restaurantId, lineId, qty } = params;
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantité invalide." };

  const { data: row, error: fErr } = await supabaseServer
    .from("dining_order_lines")
    .select("id, dining_order_id")
    .eq("id", lineId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fErr) return { ok: false, error: fErr.message };
  if (!row) return { ok: false, error: "Ligne introuvable." };

  const orderId = (row as { dining_order_id: string }).dining_order_id;
  const ord = await getDiningOrder(orderId, restaurantId);
  if (ord.error || !ord.data || ord.data.status !== "open") {
    return { ok: false, error: "Commande déjà encaissée." };
  }

  const { error: uErr } = await supabaseServer.from("dining_order_lines").update({ qty }).eq("id", lineId);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
  return { ok: true };
}

export async function removeDiningOrderLine(params: {
  restaurantId: string;
  lineId: string;
}): Promise<ActionResult> {
  const { restaurantId, lineId } = params;

  const { data: row, error: fErr } = await supabaseServer
    .from("dining_order_lines")
    .select("id, dining_order_id")
    .eq("id", lineId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fErr) return { ok: false, error: fErr.message };
  if (!row) return { ok: false, error: "Ligne introuvable." };
  const orderId = (row as { dining_order_id: string }).dining_order_id;
  const ord = await getDiningOrder(orderId, restaurantId);
  if (ord.error || !ord.data || ord.data.status !== "open") {
    return { ok: false, error: "Commande déjà encaissée." };
  }

  const { error: dErr } = await supabaseServer.from("dining_order_lines").delete().eq("id", lineId);
  if (dErr) return { ok: false, error: dErr.message };

  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
  return { ok: true };
}

export type PaymentMethod = "cash" | "card" | "other";

export async function settleDiningOrder(params: {
  restaurantId: string;
  orderId: string;
  serviceType: ServiceType;
  paymentMethod: PaymentMethod;
}): Promise<ActionResult<{ serviceId: string; totalTtc: number }>> {
  const { restaurantId, orderId, serviceType, paymentMethod } = params;

  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const linesRes = await getDiningOrderLines(orderId, restaurantId);
  if (linesRes.error) return { ok: false, error: linesRes.error.message };
  const lines = linesRes.data;
  if (lines.length === 0) return { ok: false, error: "Ajoutez au moins un plat avant d’encaisser." };

  const sales = mergeSalesByDish(lines.map((l) => ({ dish_id: l.dish_id, qty: l.qty })));
  if (sales.length === 0) return { ok: false, error: "Aucune ligne valide." };

  const totalTtc = orderTotalTtc(lines);
  if (totalTtc <= 0) {
    return { ok: false, error: "Total TTC nul : renseignez les prix TTC sur les fiches plats." };
  }

  const serviceDate = todayParisYmd();

  const { data: service, error: svcErr } = await createService(
    restaurantId,
    serviceDate,
    serviceType,
    null
  );
  if (svcErr || !service) {
    return { ok: false, error: svcErr?.message ?? "Impossible de créer le service." };
  }

  const { error: stockErr } = await recordServiceSalesAndApplyStock({
    serviceId: service.id,
    restaurantId,
    sales,
  });
  if (stockErr) {
    return { ok: false, error: `Erreur enregistrement ventes / stock : ${stockErr.message}` };
  }

  const { error: payErr } = await supabaseServer.from("dining_order_payments").insert({
    restaurant_id: restaurantId,
    dining_order_id: orderId,
    payment_method: paymentMethod,
    amount_ttc: totalTtc,
  });
  if (payErr) return { ok: false, error: payErr.message };

  const settledAt = new Date().toISOString();
  const { error: ordErr } = await supabaseServer
    .from("dining_orders")
    .update({
      status: "settled",
      service_id: service.id,
      settled_at: settledAt,
    })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId);

  if (ordErr) return { ok: false, error: ordErr.message };

  revalidatePath("/salle");
  revalidatePath(`/salle/commande/${orderId}`);
  revalidatePath("/caisse");
  revalidatePath("/dashboard");
  revalidatePath("/services");
  revalidatePath("/inventory");
  revalidatePath("/margins");

  return { ok: true, data: { serviceId: service.id, totalTtc } };
}

/** Vérifie que l’utilisateur est sur le bon restaurant (appels internes). */
export async function assertRestaurantContext(): Promise<
  ActionResult<{ restaurantId: string }>
> {
  const r = await getCurrentRestaurant();
  if (!r) return { ok: false, error: "Restaurant non trouvé." };
  return { ok: true, data: { restaurantId: r.id } };
}
