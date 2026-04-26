import { getRestaurantById } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/messaging/appUrl";
import {
  tryClaimIdempotentDelivery,
  tryRecordSkippedDelivery,
  updateMessageDelivery,
} from "@/lib/messaging/messagingDb";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";

/**
 * Après création d’une résa par l’équipe : e-mail à l’adresse de contact invité (si fournie).
 * Ne lève pas : log en base en cas d’échec.
 */
export async function sendReservationRequestEmailToGuest(params: {
  restaurantId: string;
  reservationId: string;
  contactEmail: string;
  contactName: string | null;
  /** ISO début (UTC), affichage Paris. */
  startsAtIso: string;
  partySize: number;
}): Promise<void> {
  const to = params.contactEmail.trim();
  if (!to) {
    return;
  }

  const idempotencyKey = `reservation:${params.reservationId}:email:guest_request`;
  const subject = "Demande de réservation enregistrée";

  let restName = "Restaurant";
  let fromDisplayName: string | null = null;
  try {
    const rest = await getRestaurantById(params.restaurantId);
    if (rest) {
      if (rest.name) restName = rest.name;
      fromDisplayName = rest.messaging_sender_display_name?.trim() || rest.name;
    }
  } catch {
    // ignore, fallback name
  }

  const when = new Date(params.startsAtIso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "long",
    timeStyle: "short",
  });

  const guest = params.contactName?.trim() || "Bonjour";
  const text = [
    `${guest},`,
    ``,
    `Votre demande de réservation a bien été enregistrée chez ${restName}.`,
    ``,
    `• Date / heure (Europe/Paris) : ${when}`,
    `• Nombre de couverts : ${params.partySize}`,
    `• Statut : en attente de confirmation par le restaurant`,
    ``,
    `L’équipe vous recontactera si nécessaire. Pour toute question, contactez le restaurant directement.`,
    ``,
    `— ${restName}`,
    `Message automatique. ${getAppBaseUrl()}`,
  ].join("\n");

  if (!process.env.RESEND_API_KEY?.trim()) {
    try {
      await tryRecordSkippedDelivery({
        restaurantId: params.restaurantId,
        channel: "email",
        category: "reservation",
        action: "guest_request",
        toAddress: to,
        subject,
        idempotencyKey,
        errorDetail: "RESEND_API_KEY non configuré (e-mail non envoyé).",
      });
    } catch {
      // journal optionnel
    }
    return;
  }

  let deliveryId: string;
  try {
    const claim = await tryClaimIdempotentDelivery({
      restaurantId: params.restaurantId,
      channel: "email",
      category: "reservation",
      action: "guest_request",
      toAddress: to,
      subject,
      idempotencyKey,
    });
    if ("skip" in claim) {
      return;
    }
    deliveryId = claim.id;
  } catch (e) {
    console.error("messagerie: claim idempotent", e);
    return;
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
      console.error("messagerie: update failed delivery", err);
    }
  }
}
