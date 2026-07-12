"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRestaurantForPage } from "@/lib/auth";
import { assertRestaurantAction, assertRestaurantMembership } from "@/lib/auth/restaurantActionAccess";
import { getCurrentUser } from "@/lib/auth";
import { createCustomer } from "@/lib/customers/customersDb";
import { createService, deleteService, getService } from "@/lib/db";
import { recordServiceSalesAndApplyStock } from "@/lib/service/recordServiceSalesAndApplyStock";
import type { ServiceType } from "@/lib/constants";
import { recordOrderSettledForCustomer } from "@/lib/customers/customersDb";
import {
  dishFromJoin,
  ensureOpenDiningOrder,
  getDiningOrder,
  getDiningOrderLineById,
  getDiningOrderLines,
  listDiningOrderPayments,
  type LineWithDish,
  lineGrossTtc,
  lineTtc,
  orderTotalTtc,
  setDiningOrderCustomerId,
  setDiningOrderGuestLabel,
  sumDiningOrderPayments,
} from "@/lib/dining/diningDb";
import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";
import { lineNetAfterDiscount, parseDiningDiscountKind } from "@/lib/dining/lineDiscount";
import type { DiningPaymentMethod } from "@/lib/dining/diningPaymentMethods";
import { mergeSalesByDish } from "@/lib/dining/mergeSalesByDish";
import { normalizeVatRatePct } from "@/lib/tax/frenchSellingVat";
import { toNumber } from "@/lib/utils/safeNumeric";
import { computeSalesConsumption } from "@/lib/recipes/computeSalesConsumption";
import { revertConsumptionFromStock } from "@/lib/recipes/applyConsumptionToStock";
import { trySendDiningOrderReadyEmail } from "@/lib/messaging/diningOrderReadyEmail";
import {
  loadDiningOrderViewData,
  type DiningOrderViewData,
} from "@/lib/dining/diningOrderViewData";
import { fetchOrderTicketSnapshot, type OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";
/**
 * Garde-fou IDOR : l'utilisateur doit être propriétaire ou membre du personnel actif
 * de ce restaurant. Sans cela, un `restaurantId` fourni par le client permettrait
 * d'agir sur la caisse / les commandes de n'importe quel établissement.
 */
async function memberGate(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantMembership(user.id, restaurantId);
}

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function revalidateDiningOrderFull(orderId: string) {
  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
}

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

export async function loadTableOrderModalData(params: {
  restaurantId: string;
  diningTableId: string;
}): Promise<ActionResult<DiningOrderViewData>> {
  const { restaurantId, diningTableId } = params;
  const { orderId, error } = await ensureOpenDiningOrder(restaurantId, diningTableId);
  if (error || !orderId) {
    return { ok: false, error: error?.message ?? "Impossible d’ouvrir la commande." };
  }
  const loaded = await loadDiningOrderViewData(restaurantId, orderId);
  if (loaded.error || !loaded.data) {
    return { ok: false, error: loaded.error ?? "Impossible de charger la commande." };
  }
  return { ok: true, data: loaded.data };
}

export async function loadDiningOrderModalData(params: {
  restaurantId: string;
  orderId: string;
}): Promise<ActionResult<DiningOrderViewData>> {
  const { restaurantId, orderId } = params;
  const loaded = await loadDiningOrderViewData(restaurantId, orderId);
  if (loaded.error || !loaded.data) {
    return { ok: false, error: loaded.error ?? "Impossible de charger la commande." };
  }
  return { ok: true, data: loaded.data };
}

export async function addDishToDiningOrder(params: {
  restaurantId: string;
  orderId: string;
  dishId: string;
  qty?: number;
}): Promise<ActionResult<OrderTicketSnapshot>> {
  const { restaurantId, orderId, dishId } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;
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
      .update({ qty: newQty, is_prepared: false })
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

  const snap = await fetchOrderTicketSnapshot(restaurantId, orderId);
  if (snap.error || !snap.data) {
    return { ok: false, error: snap.error ?? "Impossible de charger le ticket." };
  }
  return { ok: true, data: snap.data };
}

export async function setDiningOrderLineQty(params: {
  restaurantId: string;
  lineId: string;
  qty: number;
}): Promise<ActionResult<OrderTicketSnapshot>> {
  const { restaurantId, lineId, qty } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantité invalide." };

  const { data: row, error: fErr } = await supabaseServer
    .from("dining_order_lines")
    .select("id, dining_order_id, qty")
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

  const prevQty = toNumber((row as { qty: unknown }).qty);
  const resetPrepared = !Number.isFinite(prevQty) || Math.abs(prevQty - qty) > 1e-9;
  const { error: uErr } = await supabaseServer
    .from("dining_order_lines")
    .update(resetPrepared ? { qty, is_prepared: false } : { qty })
    .eq("id", lineId);
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

  const snap = await fetchOrderTicketSnapshot(restaurantId, orderId);
  if (snap.error || !snap.data) {
    return { ok: false, error: snap.error ?? "Impossible de charger le ticket." };
  }
  return { ok: true, data: snap.data };
}

export async function removeDiningOrderLine(params: {
  restaurantId: string;
  lineId: string;
}): Promise<ActionResult<OrderTicketSnapshot>> {
  const { restaurantId, lineId } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;

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

  const snap = await fetchOrderTicketSnapshot(restaurantId, orderId);
  if (snap.error || !snap.data) {
    return { ok: false, error: snap.error ?? "Impossible de charger le ticket." };
  }
  return { ok: true, data: snap.data };
}

export async function setDiningOrderLineDiscount(params: {
  restaurantId: string;
  lineId: string;
  kind: DiningDiscountKind;
  /** Pourcentage (0–100] ou montant TTC de remise ; ignoré si none / free. */
  discountValue: number | null;
}): Promise<ActionResult<OrderTicketSnapshot>> {
  const { restaurantId, lineId, kind } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;
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

  const snap = await fetchOrderTicketSnapshot(restaurantId, orderId);
  if (snap.error || !snap.data) {
    return { ok: false, error: snap.error ?? "Impossible de charger le ticket." };
  }
  return { ok: true, data: snap.data };
}

export async function applyGlobalDiningOrderDiscount(params: {
  restaurantId: string;
  orderId: string;
  kind: DiningDiscountKind;
  /** Pourcentage (0–100] ou montant TTC total à répartir ; ignoré si none / free. */
  discountValue: number | null;
}): Promise<ActionResult<OrderTicketSnapshot>> {
  const { restaurantId, orderId, kind } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;
  let discountValue = params.discountValue;

  const ord = await getDiningOrder(orderId, restaurantId);
  if (ord.error || !ord.data || ord.data.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const linesRes = await getDiningOrderLines(orderId, restaurantId);
  if (linesRes.error) return { ok: false, error: linesRes.error.message };
  const lines = linesRes.data;
  if (lines.length === 0) return { ok: false, error: "Aucune ligne sur la commande." };

  if (kind === "none" || kind === "free") {
    discountValue = null;
  } else if (kind === "percent") {
    if (discountValue == null || !Number.isFinite(discountValue)) {
      return { ok: false, error: "Indiquez un pourcentage de remise." };
    }
    if (discountValue <= 0 || discountValue > 100) {
      return { ok: false, error: "Le pourcentage doit être entre 0 et 100." };
    }
    const hasPricedLine = lines.some((l) => lineGrossTtc(l) > 0);
    if (!hasPricedLine) {
      return { ok: false, error: "Prix TTC manquants : impossible d’appliquer un pourcentage." };
    }
  } else if (kind === "amount") {
    if (discountValue == null || !Number.isFinite(discountValue)) {
      return { ok: false, error: "Indiquez un montant de remise." };
    }
    if (discountValue <= 0) {
      return { ok: false, error: "Le montant doit être positif." };
    }
    let grossSum = 0;
    for (const l of lines) grossSum += lineGrossTtc(l);
    if (grossSum <= 0) {
      return { ok: false, error: "Total catalogue nul : impossible d’appliquer une remise." };
    }
    if (discountValue > grossSum + 0.0001) {
      return { ok: false, error: "La remise ne peut pas dépasser le total catalogue." };
    }
  }

  const updates: { id: string; discount_kind: DiningDiscountKind; discount_value: number | null }[] =
    [];

  if (kind === "amount") {
    const grosses = lines.map((l) => lineGrossTtc(l));
    const grossSum = grosses.reduce((a, b) => a + b, 0);
    const totalDisc = discountValue ?? 0;
    let assigned = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const gross = grosses[i]!;
      let lineDisc: number;
      if (gross <= 0) {
        updates.push({ id: line.id, discount_kind: "none", discount_value: null });
        continue;
      }
      if (i === lines.length - 1) {
        lineDisc = Math.round((totalDisc - assigned) * 100) / 100;
      } else {
        lineDisc = Math.round((gross / grossSum) * totalDisc * 100) / 100;
        assigned += lineDisc;
      }
      if (lineDisc <= 0) {
        updates.push({ id: line.id, discount_kind: "none", discount_value: null });
      } else {
        updates.push({ id: line.id, discount_kind: "amount", discount_value: lineDisc });
      }
    }
  } else {
    for (const line of lines) {
      const gross = lineGrossTtc(line);
      if (kind === "percent" && gross <= 0) {
        updates.push({ id: line.id, discount_kind: "none", discount_value: null });
        continue;
      }
      updates.push({ id: line.id, discount_kind: kind, discount_value: discountValue });
    }
  }

  try {
    await Promise.all(
      updates.map(async (u) => {
        const gross = lineGrossTtc(lines.find((l) => l.id === u.id)!);
        const net = lineNetAfterDiscount(gross, u.discount_kind, u.discount_value);
        if (net < 0) throw new Error("Remise incohérente.");

        const { error: uErr } = await supabaseServer
          .from("dining_order_lines")
          .update({
            discount_kind: u.discount_kind,
            discount_value: u.discount_value,
          })
          .eq("id", u.id)
          .eq("restaurant_id", restaurantId);
        if (uErr) throw new Error(uErr.message);
      })
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Remise incohérente." };
  }

  const snap = await fetchOrderTicketSnapshot(restaurantId, orderId);
  if (snap.error || !snap.data) {
    return { ok: false, error: snap.error ?? "Impossible de charger le ticket." };
  }
  return { ok: true, data: snap.data };
}

export async function recordDiningOrderPartialPayment(params: {
  restaurantId: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  amountTtc: number;
}): Promise<ActionResult<{ amountPaidTtc: number; amountDueTtc: number }>> {
  const { restaurantId, orderId, paymentMethod, amountTtc } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;

  if (!Number.isFinite(amountTtc) || amountTtc <= 0) {
    return { ok: false, error: "Indiquez un montant positif." };
  }

  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const linesRes = await getDiningOrderLines(orderId, restaurantId);
  if (linesRes.error) return { ok: false, error: linesRes.error.message };
  const lines = linesRes.data;
  if (lines.length === 0) return { ok: false, error: "Ajoutez au moins un plat." };

  const totalTtc = orderTotalTtc(lines);
  const payRes = await listDiningOrderPayments(orderId, restaurantId);
  if (payRes.error) return { ok: false, error: payRes.error.message };
  const alreadyPaid = sumDiningOrderPayments(payRes.data);
  const remainder = Math.round((totalTtc - alreadyPaid) * 100) / 100;

  if (remainder <= 0) {
    return { ok: false, error: "L’addition est déjà entièrement payée." };
  }
  if (amountTtc > remainder + 0.009) {
    return {
      ok: false,
      error: `Le montant dépasse le reste dû (${remainder.toFixed(2).replace(".", ",")} €).`,
    };
  }

  const { error: payErr } = await supabaseServer.from("dining_order_payments").insert({
    restaurant_id: restaurantId,
    dining_order_id: orderId,
    payment_method: paymentMethod,
    amount_ttc: Math.round(amountTtc * 100) / 100,
  });
  if (payErr) return { ok: false, error: payErr.message };

  const newPaid = Math.round((alreadyPaid + amountTtc) * 100) / 100;
  const newDue = Math.max(0, Math.round((totalTtc - newPaid) * 100) / 100);

  return { ok: true, data: { amountPaidTtc: newPaid, amountDueTtc: newDue } };
}

/**
 * Marque une ligne de commande salle comme prête côté cuisine. Si toutes les lignes sont prêtes
 * et qu’un client avec e-mail est lié, un e-mail « commande prête » est tenté (idempotent).
 */
export async function setDiningOrderLinePrepared(params: {
  restaurantId: string;
  lineId: string;
  isPrepared: boolean;
}): Promise<ActionResult<{ orderReadyEmail: "sent" | "already_sent" | "none" }>> {
  const { restaurantId, lineId, isPrepared } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;

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

  const { error: uErr } = await supabaseServer
    .from("dining_order_lines")
    .update({ is_prepared: isPrepared })
    .eq("id", lineId)
    .eq("restaurant_id", restaurantId);
  if (uErr) return { ok: false, error: uErr.message };

  if (!isPrepared) {
    return { ok: true, data: { orderReadyEmail: "none" } };
  }

  void trySendDiningOrderReadyEmail({ restaurantId, orderId, mode: "auto" }).catch(() => {
    /* e-mail en arrière-plan : ne bloque pas l’UI */
  });

  return { ok: true, data: { orderReadyEmail: "none" } };
}

/**
 * Envoie (ou tente) l’e-mail « commande prête » manuellement (sans exiger toutes les lignes prêtes),
 * dès qu’un client avec e-mail est lié. Idempotent avec l’envoi auto.
 */
export async function notifyDiningOrderReadyByEmail(params: {
  restaurantId: string;
  orderId: string;
}): Promise<ActionResult<{ alreadySent: boolean }>> {
  const { restaurantId, orderId } = params;
  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const r = await trySendDiningOrderReadyEmail({ restaurantId, orderId, mode: "manual" });
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);

  if (r.alreadySent) {
    return { ok: true, data: { alreadySent: true } };
  }
  if (r.sent) {
    return { ok: true, data: { alreadySent: false } };
  }
  return { ok: false, error: "L’e-mail n’a pas été envoyé (vérifiez la fiche client et le domaine d’envoi Resend)." };
}

/** Supprime une commande encore ouverte (client parti sans commander, ou annulation). Aucun service ni stock. */
export async function cancelOpenDiningOrder(params: {
  restaurantId: string;
  orderId: string;
}): Promise<ActionResult<{ diningTableId: string | null }>> {
  const { restaurantId, orderId } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;

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
  return { ok: true, data: { diningTableId: order.dining_table_id } };
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
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;

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
}): Promise<ActionResult<{ serviceId: string; totalTtc: number; diningTableId: string | null }>> {
  const { restaurantId, orderId, serviceType, paymentMethod } = params;
  const memberAuthz = await memberGate(restaurantId);
  if (!memberAuthz.ok) return memberAuthz;

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

  const merged = mergeSalesByDish(lines.map((l) => ({ dish_id: l.dish_id, qty: l.qty })));
  if (merged.length === 0) return { ok: false, error: "Aucune ligne valide." };

  // CA HT réel par plat (remises incluses) — alimente service_sales.line_total_ht
  // pour les marges réalisées et le bilan « Ma poche » (sinon repli prix carte).
  const netHtByDish = new Map<string, number>();
  for (const l of lines) {
    const netTtc = lineTtc(l);
    if (netTtc <= 0) continue;
    const vat = normalizeVatRatePct(dishFromJoin(l)?.selling_vat_rate_pct, 10);
    const ht = netTtc / (1 + vat / 100);
    netHtByDish.set(l.dish_id, (netHtByDish.get(l.dish_id) ?? 0) + ht);
  }
  const sales = merged.map((s) => ({
    ...s,
    line_total_ht: netHtByDish.get(s.dish_id) ?? null,
  }));

  let grossSum = 0;
  for (const l of lines) grossSum += lineGrossTtc(l);
  const totalTtc = orderTotalTtc(lines);

  if (grossSum <= 0) {
    return { ok: false, error: "Total TTC nul : renseignez les prix TTC sur les fiches plats." };
  }
  if (totalTtc < 0) {
    return { ok: false, error: "Total incohérent après remises." };
  }

  const payRes = await listDiningOrderPayments(orderId, restaurantId);
  if (payRes.error) return { ok: false, error: payRes.error.message };
  const alreadyPaid = sumDiningOrderPayments(payRes.data);
  const remainder = Math.round((totalTtc - alreadyPaid) * 100) / 100;
  if (remainder < -0.009) {
    return { ok: false, error: "Les paiements enregistrés dépassent le total." };
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

  const { error: payErr } =
    remainder > 0.009
      ? await supabaseServer.from("dining_order_payments").insert({
          restaurant_id: restaurantId,
          dining_order_id: orderId,
          payment_method: paymentMethod,
          amount_ttc: remainder,
        })
      : { error: null };
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

  const customerId = order.customer_id;
  if (customerId) {
    const lineSummaries = lines.map((l) => {
      const d = dishFromJoin(l as LineWithDish);
      return { dishName: d?.name ?? "Plat", qty: toNumber(l.qty) };
    });
    try {
      await recordOrderSettledForCustomer(
        restaurantId,
        customerId,
        orderId,
        totalTtc,
        lineSummaries
      );
    } catch {
      /* Ne bloque pas l’encaissement si l’historique client échoue */
    }
  }

  revalidatePath("/salle");
  revalidatePath(`/salle/commande/${orderId}`);
  revalidatePath("/caisse");
  revalidatePath("/dashboard");
  revalidatePath("/services");
  revalidatePath("/inventory");
  revalidatePath("/margins");
  revalidatePath("/clients");

  return { ok: true, data: { serviceId: service.id, totalTtc, diningTableId: order.dining_table_id } };
}

export async function setDiningOrderCustomerAction(params: {
  restaurantId: string;
  orderId: string;
  customerId: string | null;
}): Promise<ActionResult> {
  const { restaurantId, orderId, customerId } = params;
  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  if (!orderRes.data || orderRes.data.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }
  const { error } = await setDiningOrderCustomerId(restaurantId, orderId, customerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salle");
  revalidatePath(`/salle/commande/${orderId}`);
  revalidatePath("/caisse");
  revalidatePath("/clients");
  return { ok: true };
}

export async function setDiningOrderGuestLabelAction(params: {
  restaurantId: string;
  orderId: string;
  guestLabel: string | null;
}): Promise<ActionResult> {
  const { restaurantId, orderId, guestLabel } = params;
  const { error } = await setDiningOrderGuestLabel(restaurantId, orderId, guestLabel);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salle");
  revalidatePath(`/salle/commande/${orderId}`);
  revalidatePath("/caisse");
  return { ok: true };
}

export async function createCustomerFromDiningOrderAction(params: {
  restaurantId: string;
  orderId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
}): Promise<ActionResult<{ customerId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, params.restaurantId, "clients.mutate");
  if (!gate.ok) return gate;

  const orderRes = await getDiningOrder(params.orderId, params.restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const name = params.displayName.trim();
  if (!name) return { ok: false, error: "Indiquez un nom pour la fiche client." };

  const customer = await createCustomer(params.restaurantId, {
    display_name: name,
    email: params.email?.trim() || null,
    phone: params.phone?.trim() || null,
    source: "walk_in",
    created_by_user_id: user.id,
  });
  if (!customer) return { ok: false, error: "Impossible de créer la fiche client." };

  const linkErr = await setDiningOrderCustomerId(params.restaurantId, params.orderId, customer.id);
  if (linkErr.error) return { ok: false, error: linkErr.error.message };

  await setDiningOrderGuestLabel(params.restaurantId, params.orderId, null);

  revalidatePath("/salle");
  revalidatePath(`/salle/commande/${params.orderId}`);
  revalidatePath("/caisse");
  revalidatePath("/clients");
  revalidatePath(`/clients/${customer.id}`);
  return { ok: true, data: { customerId: customer.id } };
}

/** Vérifie que l’utilisateur est sur le bon restaurant (appels internes). */
export async function assertRestaurantContext(): Promise<
  ActionResult<{ restaurantId: string }>
> {
  const r = await getRestaurantForPage();
  if (!r) return { ok: false, error: "Restaurant non trouvé." };
  return { ok: true, data: { restaurantId: r.id } };
}
