import "server-only";

import { formatReservationReference } from "@/lib/meta/metaReservationService";
import { listPushTokensForRestaurant } from "./pushTokenDb";
import { isPushSendConfigured } from "./pushConfig";
import { sendPushToDevices } from "./pushSendService";
import type { ReservationSource } from "@/lib/reservations/types";

function sourceLabel(source: ReservationSource): string {
  switch (source) {
    case "website":
      return "Site ubion";
    case "instagram_dm":
      return "Instagram";
    case "facebook_messenger":
      return "Messenger";
    case "phone":
      return "Téléphone";
    case "walk_in":
      return "Comptoir";
    default:
      return "Réservation";
  }
}

function formatReservationWhen(startsAtIso: string): string {
  return new Date(startsAtIso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reservationYmd(startsAtIso: string): string {
  return new Date(startsAtIso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/** Notifie l'équipe (app native) d'une nouvelle réservation. */
export async function notifyTeamReservationCreated(params: {
  restaurantId: string;
  reservationId: string;
  partySize: number;
  startsAtIso: string;
  contactName: string | null;
  source: ReservationSource;
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const when = formatReservationWhen(params.startsAtIso);
  const ref = formatReservationReference(params.reservationId);
  const guest = params.contactName?.trim() || "Client";
  const channel = sourceLabel(params.source);

  const title = `Nouvelle résa · ${channel}`;
  const body = `${params.partySize} pers. · ${when} · ${guest} · Réf. ${ref}`;

  const result = await sendPushToDevices({
    tokens,
    title,
    body,
    data: {
      type: "reservation_created",
      reservationId: params.reservationId,
      restaurantId: params.restaurantId,
      url: `/reservations?date=${reservationYmd(params.startsAtIso)}`,
    },
  });

  if (result.sent === 0 && result.failed > 0) {
    console.warn("[push] notifyTeamReservationCreated: aucun envoi réussi", {
      restaurantId: params.restaurantId,
      failed: result.failed,
    });
  }

  return { ...result, skipped: false };
}

/** Notifie l'équipe d'une annulation client. */
export async function notifyTeamReservationCancelled(params: {
  restaurantId: string;
  reservationId: string;
  partySize: number;
  startsAtIso: string;
  contactName: string | null;
  source: ReservationSource;
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const when = formatReservationWhen(params.startsAtIso);
  const ref = formatReservationReference(params.reservationId);
  const guest = params.contactName?.trim() || "Client";

  const title = "Réservation annulée";
  const body = `${params.partySize} pers. · ${when} · ${guest} · Réf. ${ref}`;

  const result = await sendPushToDevices({
    tokens,
    title,
    body,
    data: {
      type: "reservation_cancelled",
      reservationId: params.reservationId,
      restaurantId: params.restaurantId,
      url: `/reservations?date=${reservationYmd(params.startsAtIso)}`,
    },
  });

  return { ...result, skipped: false };
}
