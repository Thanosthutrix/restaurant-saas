import "server-only";

import { formatReservationReference } from "@/lib/meta/metaReservationService";
import type { MetaMessagingPlatform } from "@/lib/meta/messagingTypes";
import { listPushTokensForRestaurant } from "./pushTokenDb";
import { isPushSendConfigured } from "./pushConfig";
import { sendPushToDevices } from "./pushSendService";

function platformLabel(platform: MetaMessagingPlatform): string {
  return platform === "instagram_dm" ? "Instagram" : "Messenger";
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

/** Notifie l'équipe (app native) qu'une réservation vient d'être créée via DM Meta. */
export async function notifyTeamMetaReservationCreated(params: {
  restaurantId: string;
  reservationId: string;
  partySize: number;
  startsAtIso: string;
  contactName: string | null;
  platform: MetaMessagingPlatform;
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
  const channel = platformLabel(params.platform);

  const title = `Nouvelle résa ${channel}`;
  const body = `${params.partySize} pers. · ${when} · ${guest} · Réf. ${ref}`;

  const result = await sendPushToDevices({
    tokens,
    title,
    body,
    data: {
      type: "meta_reservation",
      reservationId: params.reservationId,
      restaurantId: params.restaurantId,
      url: `/reservations?date=${reservationYmd(params.startsAtIso)}`,
    },
  });

  if (result.sent === 0 && result.failed > 0) {
    console.warn("[push] notifyTeamMetaReservationCreated: aucun envoi réussi", {
      restaurantId: params.restaurantId,
      failed: result.failed,
    });
  }

  return { ...result, skipped: false };
}
