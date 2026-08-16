import { getRestaurantById } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/messaging/appUrl";
import {
  tryClaimIdempotentDelivery,
  tryRecordSkippedDelivery,
  updateMessageDelivery,
} from "@/lib/messaging/messagingDb";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import { getRestaurantReservationNotifyEmail } from "@/lib/reservations/restaurantNotifyEmail";
import type { ReservationSource } from "@/lib/reservations/types";

function formatWhenParis(startsAtIso: string): string {
  return new Date(startsAtIso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "long",
    timeStyle: "short",
  });
}

function sourceLabelFr(source: ReservationSource): string {
  switch (source) {
    case "website":
      return "site ubion";
    case "instagram_dm":
      return "Instagram";
    case "facebook_messenger":
      return "Messenger";
    case "phone":
      return "téléphone";
    case "walk_in":
      return "comptoir";
    default:
      return "autre canal";
  }
}

/**
 * Après création d’une résa : e-mail à l’adresse de contact invité (si fournie).
 */
export async function sendReservationRequestEmailToGuest(params: {
  restaurantId: string;
  reservationId: string;
  contactEmail: string;
  contactName: string | null;
  startsAtIso: string;
  partySize: number;
}): Promise<void> {
  const to = params.contactEmail.trim();
  if (!to) return;

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
    // ignore
  }

  const when = formatWhenParis(params.startsAtIso);
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

  await sendReservationEmail({
    restaurantId: params.restaurantId,
    to,
    subject,
    text,
    fromDisplayName,
    idempotencyKey,
    action: "guest_request",
  });
}

/** E-mail à l'équipe lors d'une nouvelle réservation. */
export async function sendReservationNotifyEmailToRestaurant(params: {
  restaurantId: string;
  reservationId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  startsAtIso: string;
  partySize: number;
  notes: string | null;
  source: ReservationSource;
}): Promise<void> {
  const to = await getRestaurantReservationNotifyEmail(params.restaurantId);
  if (!to) return;

  let restName = "Restaurant";
  try {
    const rest = await getRestaurantById(params.restaurantId);
    if (rest?.name) restName = rest.name;
  } catch {
    // ignore
  }

  const when = formatWhenParis(params.startsAtIso);
  const guest = params.contactName?.trim() || "Client";
  const channel = sourceLabelFr(params.source);
  const idempotencyKey = `reservation:${params.reservationId}:email:team_notify`;
  const subject = `Nouvelle réservation · ${guest} · ${params.partySize} pers.`;

  const contactLines = [
    params.contactPhone ? `Tél. : ${params.contactPhone}` : null,
    params.contactEmail ? `E-mail : ${params.contactEmail}` : null,
  ].filter(Boolean);

  const text = [
    `Bonjour,`,
    ``,
    `Une nouvelle réservation vient d'être enregistrée sur ${restName} (via ${channel}).`,
    ``,
    `• Date / heure (Europe/Paris) : ${when}`,
    `• Couverts : ${params.partySize}`,
    `• Client : ${guest}`,
    ...contactLines.map((l) => `• ${l}`),
    params.notes?.trim() ? `• Notes : ${params.notes.trim()}` : null,
    ``,
    `Consultez le livre de réservations dans Ubion pour confirmer ou modifier.`,
    ``,
    `${getAppBaseUrl()}/reservations`,
    ``,
    `— Ubion`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendReservationEmail({
    restaurantId: params.restaurantId,
    to,
    subject,
    text,
    fromDisplayName: "Ubion",
    idempotencyKey,
    action: "team_notify",
  });
}

/** E-mail client après annulation par le consommateur. */
export async function sendReservationCancelledEmailToGuest(params: {
  restaurantId: string;
  reservationId: string;
  contactEmail: string;
  contactName: string | null;
  startsAtIso: string;
  partySize: number;
}): Promise<void> {
  const to = params.contactEmail.trim();
  if (!to) return;

  let restName = "Restaurant";
  let fromDisplayName: string | null = null;
  try {
    const rest = await getRestaurantById(params.restaurantId);
    if (rest) {
      if (rest.name) restName = rest.name;
      fromDisplayName = rest.messaging_sender_display_name?.trim() || rest.name;
    }
  } catch {
    // ignore
  }

  const when = formatWhenParis(params.startsAtIso);
  const guest = params.contactName?.trim() || "Bonjour";
  const idempotencyKey = `reservation:${params.reservationId}:email:guest_cancelled`;
  const subject = "Réservation annulée";

  const text = [
    `${guest},`,
    ``,
    `Votre réservation chez ${restName} a bien été annulée.`,
    ``,
    `• Date / heure (Europe/Paris) : ${when}`,
    `• Nombre de couverts : ${params.partySize}`,
    ``,
    `Pour réserver à nouveau, rendez-vous sur la fiche du restaurant.`,
    ``,
    `— ${restName}`,
    `Message automatique. ${getAppBaseUrl()}`,
  ].join("\n");

  await sendReservationEmail({
    restaurantId: params.restaurantId,
    to,
    subject,
    text,
    fromDisplayName,
    idempotencyKey,
    action: "guest_cancelled",
  });
}

/** E-mail équipe après annulation client. */
export async function sendReservationCancelledEmailToRestaurant(params: {
  restaurantId: string;
  reservationId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  startsAtIso: string;
  partySize: number;
  source: ReservationSource;
}): Promise<void> {
  const to = await getRestaurantReservationNotifyEmail(params.restaurantId);
  if (!to) return;

  let restName = "Restaurant";
  try {
    const rest = await getRestaurantById(params.restaurantId);
    if (rest?.name) restName = rest.name;
  } catch {
    // ignore
  }

  const when = formatWhenParis(params.startsAtIso);
  const guest = params.contactName?.trim() || "Client";
  const idempotencyKey = `reservation:${params.reservationId}:email:team_cancelled`;
  const subject = `Réservation annulée · ${guest} · ${params.partySize} pers.`;

  const text = [
    `Bonjour,`,
    ``,
    `Une réservation a été annulée par le client sur ${restName} (via ${sourceLabelFr(params.source)}).`,
    ``,
    `• Date / heure (Europe/Paris) : ${when}`,
    `• Couverts : ${params.partySize}`,
    `• Client : ${guest}`,
    params.contactPhone ? `• Tél. : ${params.contactPhone}` : null,
    params.contactEmail ? `• E-mail : ${params.contactEmail}` : null,
    ``,
    `${getAppBaseUrl()}/reservations`,
    ``,
    `— Ubion`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendReservationEmail({
    restaurantId: params.restaurantId,
    to,
    subject,
    text,
    fromDisplayName: "Ubion",
    idempotencyKey,
    action: "team_cancelled",
  });
}

async function sendReservationEmail(params: {
  restaurantId: string;
  to: string;
  subject: string;
  text: string;
  fromDisplayName: string | null;
  idempotencyKey: string;
  action: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY?.trim()) {
    try {
      await tryRecordSkippedDelivery({
        restaurantId: params.restaurantId,
        channel: "email",
        category: "reservation",
        action: params.action,
        toAddress: params.to,
        subject: params.subject,
        idempotencyKey: params.idempotencyKey,
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
      action: params.action,
      toAddress: params.to,
      subject: params.subject,
      idempotencyKey: params.idempotencyKey,
    });
    if ("skip" in claim) return;
    deliveryId = claim.id;
  } catch (e) {
    console.error("messagerie: claim idempotent", e);
    return;
  }

  try {
    const { id: providerId } = await sendEmailViaResend({
      to: params.to,
      subject: params.subject,
      text: params.text,
      fromDisplayName: params.fromDisplayName,
    });
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
