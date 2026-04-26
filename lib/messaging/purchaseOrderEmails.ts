import { getRestaurantById } from "@/lib/auth";
import { getPurchaseOrder, markPurchaseOrderSent } from "@/lib/db";
import {
  tryClaimOrRetryIdempotentDelivery,
  tryRecordSkippedDelivery,
  updateMessageDelivery,
} from "@/lib/messaging/messagingDb";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";

export async function sendPurchaseOrderToSupplierEmail(params: {
  restaurantId: string;
  orderId: string;
}): Promise<{ ok: true; sent: boolean; alreadySent: boolean } | { ok: false; error: string }> {
  const { restaurantId, orderId } = params;
  const orderRes = await getPurchaseOrder(orderId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.restaurant_id !== restaurantId) {
    return { ok: false, error: "Commande fournisseur introuvable." };
  }

  const supplier = order.supplier;
  if (!supplier) return { ok: false, error: "Fournisseur introuvable." };
  const to = supplier.email?.trim() ?? "";
  if (!to) return { ok: false, error: "Aucun e-mail renseigné sur la fiche fournisseur." };

  const rest = await getRestaurantById(restaurantId);
  const restaurantName = rest?.name?.trim() || "Restaurant";
  const fromDisplayName = rest?.messaging_sender_display_name?.trim() || restaurantName;
  const subject = `Commande ${restaurantName} - ${supplier.name}`;
  const text = order.generated_message?.trim() || buildPurchaseOrderFallbackText(restaurantName, supplier.name, order.lines);
  const idempotencyKey = `purchase_order:${order.id}:email:supplier`;

  if (!process.env.RESEND_API_KEY?.trim()) {
    try {
      await tryRecordSkippedDelivery({
        restaurantId,
        channel: "email",
        category: "purchase_order",
        action: "send_supplier",
        toAddress: to,
        subject,
        idempotencyKey,
        errorDetail: "RESEND_API_KEY non configuré (commande fournisseur non envoyée).",
      });
    } catch {
      // Journal optionnel : l'action doit surtout remonter une erreur claire à l'utilisateur.
    }
    return {
      ok: false,
      error:
        "E-mail non configuré : RESEND_API_KEY est absente côté serveur. Vérifiez `.env.local` (pas `.env.example` ni `.env.`) puis redémarrez `npm run dev`.",
    };
  }

  let deliveryId: string;
  try {
    const claim = await tryClaimOrRetryIdempotentDelivery({
      restaurantId,
      channel: "email",
      category: "purchase_order",
      action: "send_supplier",
      toAddress: to,
      subject,
      idempotencyKey,
    });
    if ("skip" in claim) {
      return { ok: true, sent: false, alreadySent: true };
    }
    deliveryId = claim.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Journal d’envoi indisponible." };
  }

  try {
    const { id: providerId } = await sendEmailViaResend({ to, subject, text, fromDisplayName });
    await updateMessageDelivery(deliveryId, {
      status: "sent",
      provider: "resend",
      provider_message_id: providerId,
    });
    const mark = await markPurchaseOrderSent({
      orderId: order.id,
      restaurantId,
      channel: "email",
      toEmail: to,
    });
    if (mark.error) return { ok: false, error: mark.error.message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await updateMessageDelivery(deliveryId, {
        status: "failed",
        provider: "resend",
        error_detail: msg,
      });
    } catch (err) {
      console.error("purchase order email: update failed delivery", err);
    }
    return { ok: false, error: msg };
  }

  return { ok: true, sent: true, alreadySent: false };
}

function buildPurchaseOrderFallbackText(
  restaurantName: string,
  supplierName: string,
  lines: { item_name_snapshot: string; ordered_qty_purchase_unit: number; purchase_unit: string; supplier_sku_snapshot: string | null }[]
): string {
  const parts = ["Bonjour,", "", `Merci de nous préparer la commande suivante pour ${restaurantName} :`, ""];
  for (const line of lines) {
    const ref = line.supplier_sku_snapshot ? ` (réf. ${line.supplier_sku_snapshot})` : "";
    parts.push(`- ${line.item_name_snapshot} : ${line.ordered_qty_purchase_unit} ${line.purchase_unit}${ref}`);
  }
  parts.push("", "Cordialement", restaurantName, "", `Fournisseur : ${supplierName}`);
  return parts.join("\n");
}
