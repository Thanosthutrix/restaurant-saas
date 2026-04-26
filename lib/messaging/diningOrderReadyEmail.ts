import { getRestaurantById } from "@/lib/auth";
import { getCustomerById } from "@/lib/customers/customersDb";
import {
  dishFromJoin,
  getDiningOrder,
  getDiningOrderLines,
  getDiningTable,
  type LineWithDish,
} from "@/lib/dining/diningDb";
import { diningTableTicketTitle } from "@/lib/dining/ticketLabel";
import { getAppBaseUrl } from "@/lib/messaging/appUrl";
import {
  tryClaimIdempotentDelivery,
  tryRecordSkippedDelivery,
  updateMessageDelivery,
} from "@/lib/messaging/messagingDb";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import { toNumber } from "@/lib/utils/safeNumeric";

const IDEMPOTENCY_KEY_PREFIX = (orderId: string) => `dining_order:${orderId}:order_ready`;

export type OrderReadySendMode = "auto" | "manual";

/**
 * E-mail « commande prête » (idempotente par commande). Mode auto : sans e-mail client, ne fait rien.
 * Mode manuel : retour explicite si l’e-mail ne peut pas partir.
 */
export async function trySendDiningOrderReadyEmail(params: {
  restaurantId: string;
  orderId: string;
  mode: OrderReadySendMode;
}): Promise<
  { ok: true; sent: boolean; alreadySent: boolean; skippedNoEmail: boolean; error: null } | { ok: false; error: string }
> {
  const { restaurantId, orderId, mode } = params;
  const idempotencyKey = IDEMPOTENCY_KEY_PREFIX(orderId);
  const subject = "Votre commande est prête";

  const orderRes = await getDiningOrder(orderId, restaurantId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.status !== "open") {
    return { ok: false, error: "Commande introuvable ou déjà encaissée." };
  }

  const linesRes = await getDiningOrderLines(orderId, restaurantId);
  if (linesRes.error) return { ok: false, error: linesRes.error.message };
  const lines = linesRes.data ?? [];
  if (lines.length === 0) {
    return { ok: false, error: "Aucune ligne sur cette commande." };
  }

  if (mode === "auto") {
    const allPrepared = lines.every((l) => Boolean((l as LineWithDish).is_prepared));
    if (!allPrepared) {
      return { ok: true, sent: false, alreadySent: false, skippedNoEmail: false, error: null };
    }
  }

  if (!order.customer_id) {
    if (mode === "manual") {
      return { ok: false, error: "Associez d’abord un client sur la commande, avec un e-mail sur la fiche." };
    }
    return { ok: true, sent: false, alreadySent: false, skippedNoEmail: true, error: null };
  }

  const customer = await getCustomerById(restaurantId, order.customer_id);
  const to = customer?.email?.trim() ?? "";
  if (!to) {
    if (mode === "manual") {
      return { ok: false, error: "Aucun e-mail sur la fiche client. Ajoutez un e-mail pour envoyer l’annonce." };
    }
    return { ok: true, sent: false, alreadySent: false, skippedNoEmail: true, error: null };
  }

  let restName = "Restaurant";
  let fromDisplayName: string | null = null;
  try {
    const rest = await getRestaurantById(restaurantId);
    if (rest) {
      if (rest.name) restName = rest.name;
      fromDisplayName = rest.messaging_sender_display_name?.trim() || rest.name;
    }
  } catch {
    // fallback
  }

  const { data: table } =
    order.dining_table_id != null
      ? await getDiningTable(order.dining_table_id, restaurantId)
      : { data: null };
  const counterName = order.counter_ticket_label?.trim();
  const isCounterOrder = order.dining_table_id == null && Boolean(counterName);
  const displayName = customer?.display_name?.trim() || null;
  const placeDescription = isCounterOrder
    ? (displayName || counterName) ?? "Comptoir"
    : diningTableTicketTitle(table?.label ?? "—", displayName);

  const guest = displayName || "Bonjour";
  const lineParts = lines.map((l) => {
    const d = dishFromJoin(l);
    const n = d?.name?.trim() || "Plat";
    const q = toNumber((l as LineWithDish).qty);
    const head = !Number.isFinite(q) || q === 1 ? "•" : `• ${q}×`;
    return `${head} ${n}`;
  });

  const text = [
    `${guest},`,
    ``,
    `Votre commande est prête chez ${restName}.`,
    ``,
    `Détail : ${placeDescription}`,
    ``,
    ...lineParts,
    ``,
    `Bonne dégustation,`,
    `— ${restName}`,
    `Message automatique. ${getAppBaseUrl()}`,
  ].join("\n");

  if (!process.env.RESEND_API_KEY?.trim()) {
    try {
      await tryRecordSkippedDelivery({
        restaurantId,
        channel: "email",
        category: "dining",
        action: "order_ready",
        toAddress: to,
        subject,
        idempotencyKey,
        errorDetail: "RESEND_API_KEY non configuré (e-mail non envoyé).",
      });
    } catch {
      // ignore
    }
    if (mode === "manual") {
      return { ok: false, error: "E-mail non configuré (clé Resend manquante sur le serveur)." };
    }
    return { ok: true, sent: false, alreadySent: false, skippedNoEmail: true, error: null };
  }

  let deliveryId: string;
  try {
    const claim = await tryClaimIdempotentDelivery({
      restaurantId,
      channel: "email",
      category: "dining",
      action: "order_ready",
      toAddress: to,
      subject,
      idempotencyKey,
    });
    if ("skip" in claim) {
      return { ok: true, sent: false, alreadySent: true, skippedNoEmail: false, error: null };
    }
    deliveryId = claim.id;
  } catch (e) {
    console.error("messagerie dining order_ready: claim", e);
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement d’envoi impossible." };
  }

  try {
    const { id: providerId } = await sendEmailViaResend({ to, subject, text, fromDisplayName });
    await updateMessageDelivery(deliveryId, {
      status: "sent",
      provider: "resend",
      provider_message_id: providerId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await updateMessageDelivery(deliveryId, {
        status: "failed",
        provider: "resend",
        error_detail: msg,
      });
    } catch (err) {
      console.error("messagerie dining order_ready: update failed", err);
    }
    return { ok: false, error: msg };
  }

  return { ok: true, sent: true, alreadySent: false, skippedNoEmail: false, error: null };
}
