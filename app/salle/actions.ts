"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentRestaurant } from "@/lib/auth";
import { createService, deleteService, getService } from "@/lib/db";
import { recordServiceSalesAndApplyStock } from "@/lib/service/recordServiceSalesAndApplyStock";
import type { ServiceType } from "@/lib/constants";
import {
  ensureOpenDiningOrder,
  getDiningOrder,
  getDiningOrderLineById,
  getDiningOrderLines,
  lineGrossTtc,
  orderTotalTtc,
} from "@/lib/dining/diningDb";
import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";
import { lineNetAfterDiscount, parseDiningDiscountKind } from "@/lib/dining/lineDiscount";
import type { DiningPaymentMethod } from "@/lib/dining/diningPaymentMethods";
import { mergeSalesByDish } from "@/lib/dining/mergeSalesByDish";
import { toNumber } from "@/lib/utils/safeNumeric";
import { computeSalesConsumption } from "@/lib/recipes/computeSalesConsumption";
import { revertConsumptionFromStock } from "@/lib/recipes/applyConsumptionToStock";
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function todayParisYmd(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  const lineAfter = await getDiningOrderLineById(lineId, restaurantId);
  if (lineAfter.data) {
    const ln = lineAfter.data;
    const gross = lineGrossTtc(ln);
    const kind = parseDiningDiscountKind(ln.discount_kind);
    const raw = ln.discount_value;
    const val = raw == null || raw === "" ? null : Number(raw);
    if (kind === "amount" && val != null && Number.isFinite(val) && gross > 0 && val > gross + 0.0001) {
      const capped = Math.round(gross * 100) / 100;
      await supabaseServer
        .from("dining_order_lines")
        .update({ discount_value: capped })
        .eq("id", lineId)
        .eq("restaurant_id", restaurantId);
    }
    if ((kind === "percent" || kind === "amount") && gross <= 0) {
      await supabaseServer
        .from("dining_order_lines")
        .update({ discount_kind: "none", discount_value: null })
        .eq("id", lineId)
        .eq("restaurant_id", restaurantId);
    }
  }

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

export async function setDiningOrderLineDiscount(params: {
  restaurantId: string;
  lineId: string;
  kind: DiningDiscountKind;
  /** Pourcentage (0–100] ou montant TTC de remise ; ignoré si none / free. */
  discountValue: number | null;
}): Promise<ActionResult> {
  const { restaurantId, lineId, kind } = params;
  let discountValue = params.discountValue;

  const lineRes = await getDiningOrderLineById(lineId, restaurantId);
  if (lineRes.error) return { ok: false, error: lineRes.error.message };
  const line = lineRes.data;
  if (!line) return { ok: false, error: "Ligne introuvable." };

  const orderId = line.dining_order_id;
  const ord = await getDiningOrder(orderId, restaurantId);
  if (ord.error || !ord.data || ord.data.status !== "open") {
    return { ok: false, error: "Commande déjà encaissée." };
  }

  const gross = lineGrossTtc(line);

  if (kind === "none" || kind === "free") {
    discountValue = null;
  } else if (kind === "percent") {
    if (discountValue == null || !Number.isFinite(discountValue)) {
      return { ok: false, error: "Indiquez un pourcentage de remise." };
    }
    if (gross <= 0) {
      return { ok: false, error: "Prix TTC du plat manquant : impossible d’appliquer un pourcentage." };
    }
    if (discountValue <= 0 || discountValue > 100) {
      return { ok: false, error: "Le pourcentage doit être entre 0 et 100." };
    }
  } else if (kind === "amount") {
    if (discountValue == null || !Number.isFinite(discountValue)) {
      return { ok: false, error: "Indiquez un montant de remise." };
    }
    if (gross <= 0) {
      return { ok: false, error: "Prix TTC du plat manquant : impossible d’appliquer une remise en montant." };
    }
    if (discountValue <= 0) {
      return { ok: false, error: "Le montant doit être positif." };
    }
    if (discountValue > gross + 0.0001) {
      return { ok: false, error: "La remise ne peut pas dépasser le total ligne." };
    }
  }

  const net = lineNetAfterDiscount(gross, kind, discountValue);
  if (net < 0) {
    return { ok: false, error: "Remise incohérente." };
  }

  const { error: uErr } = await supabaseServer
    .from("dining_order_lines")
    .update({
      discount_kind: kind,
      discount_value: discountValue,
    })
    .eq("id", lineId)
    .eq("restaurant_id", restaurantId);

  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
  return { ok: true };
}

/** Supprime une commande encore ouverte (client parti sans commander, ou annulation). Aucun service ni stock. */
export async function cancelOpenDiningOrder(params: {
  restaurantId: string;
  orderId: string;
}): Promise<ActionResult> {
  const { restaurantId, orderId } = params;

  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const { error: delErr } = await supabaseServer
    .from("dining_orders")
    .delete()
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "open");

  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
  return { ok: true };
}

/**
 * Annule un encaissement : inverse le stock (FIFO), supprime le service + service_sales,
 * supprime le paiement et remet la commande en « open » pour permettre les corrections.
 */
export async function reopenSettledDiningOrder(params: {
  restaurantId: string;
  orderId: string;
}): Promise<ActionResult> {
  const { restaurantId, orderId } = params;

  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "settled") {
    return { ok: false, error: "Commande introuvable ou non encaissée." };
  }

  const serviceId = order.service_id;
  if (!serviceId) {
    return { ok: false, error: "Aucun service lié à cette commande." };
  }

  const svcRes = await getService(serviceId);
  if (svcRes.error || !svcRes.data) {
    return { ok: false, error: svcRes.error?.message ?? "Service introuvable." };
  }
  if (svcRes.data.restaurant_id !== restaurantId) {
    return { ok: false, error: "Restaurant incohérent." };
  }

  const { data: salesRows, error: salesErr } = await supabaseServer
    .from("service_sales")
    .select("dish_id, qty")
    .eq("service_id", serviceId)
    .eq("restaurant_id", restaurantId);

  if (salesErr) return { ok: false, error: salesErr.message };

  const sales = mergeSalesByDish((salesRows ?? []) as { dish_id: string; qty: unknown }[]);

  if (sales.length > 0) {
    const consumptionResult = await computeSalesConsumption(restaurantId, sales);
    const rev = await revertConsumptionFromStock(restaurantId, consumptionResult.consumption, {
      serviceId,
    });
    if (rev.error) {
      return {
        ok: false,
        error: `Annulation stock impossible : ${rev.error.message}`,
      };
    }
  }

  const delSvc = await deleteService(serviceId);
  if (delSvc.error) return { ok: false, error: delSvc.error.message };

  const { error: payDelErr } = await supabaseServer
    .from("dining_order_payments")
    .delete()
    .eq("dining_order_id", orderId)
    .eq("restaurant_id", restaurantId);

  if (payDelErr) return { ok: false, error: payDelErr.message };

  const { error: ordErr } = await supabaseServer
    .from("dining_orders")
    .update({
      status: "open",
      settled_at: null,
      service_id: null,
    })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId);

  if (ordErr) return { ok: false, error: ordErr.message };

  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/services");
  revalidatePath("/inventory");
  revalidatePath("/margins");

  return { ok: true };
}

export type PaymentMethod = DiningPaymentMethod;

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

  let grossSum = 0;
  for (const l of lines) grossSum += lineGrossTtc(l);
  const totalTtc = orderTotalTtc(lines);

  if (grossSum <= 0) {
    return { ok: false, error: "Total TTC nul : renseignez les prix TTC sur les fiches plats." };
  }
  if (totalTtc < 0) {
    return { ok: false, error: "Total incohérent après remises." };
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
