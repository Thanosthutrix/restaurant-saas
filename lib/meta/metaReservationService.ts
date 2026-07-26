import "server-only";

import { createCustomer } from "@/lib/customers/customersDb";
import { createReservation, reservationStartsUtc } from "@/lib/reservations/reservationsDb";
import type { ReservationSource } from "@/lib/reservations/types";
import type { MetaMessagingPlatform } from "./messagingTypes";

const DEFAULT_DURATION_MINUTES = 90;

function reservationSourceForPlatform(platform: MetaMessagingPlatform): ReservationSource {
  return platform === "instagram_dm" ? "instagram_dm" : "facebook_messenger";
}

export async function createReservationFromMetaConversation(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  contactName: string | null;
  ymd: string;
  timeHm: string;
  partySize: number;
}): Promise<{ reservationId: string; startsAt: string } | { error: string }> {
  const n = params.partySize;
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    return { error: "Nombre de convives invalide." };
  }

  const { data: startsAt, error: startErr } = await reservationStartsUtc(params.ymd, params.timeHm);
  if (startErr || !startsAt) {
    return { error: startErr?.message ?? "Date ou heure invalide." };
  }

  const endIso = new Date(
    new Date(startsAt).getTime() + DEFAULT_DURATION_MINUTES * 60_000
  ).toISOString();

  const contactName = params.contactName?.trim() || "Client Meta";
  let customerId: string | null = null;

  const createdCustomer = await createCustomer(params.restaurantId, {
    display_name: contactName,
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    source: "social",
    marketing_opt_in: false,
    service_messages_opt_in: true,
    created_by_user_id: null,
  });
  if (createdCustomer) customerId = createdCustomer.id;

  const source = reservationSourceForPlatform(params.platform);
  const notes =
    params.platform === "instagram_dm"
      ? "Réservation via Instagram DM (Ubion)."
      : "Réservation via Facebook Messenger (Ubion).";

  const { data: reservation, error: resErr } = await createReservation({
    restaurant_id: params.restaurantId,
    customer_id: customerId,
    party_size: n,
    starts_at: startsAt,
    ends_at: endIso,
    contact_name: contactName,
    contact_phone: null,
    contact_email: null,
    notes,
    source,
    status: "pending",
    created_by_user_id: null,
  });

  if (resErr || !reservation) {
    return { error: resErr?.message ?? "Création de réservation impossible." };
  }

  return { reservationId: reservation.id, startsAt };
}

export function formatReservationConfirmationMessage(params: {
  partySize: number;
  ymd: string;
  timeHm: string;
  restaurantName?: string | null;
}): string {
  const when = new Date(`${params.ymd}T${params.timeHm}:00`).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const name = params.restaurantName?.trim();
  return [
    name ? `Parfait — votre demande est enregistrée chez ${name} :` : "Parfait — votre demande est enregistrée :",
    `• ${params.partySize} personne${params.partySize > 1 ? "s" : ""}`,
    `• ${when}`,
    "",
    "Nous vous confirmons la réservation très prochainement. À bientôt !",
  ].join("\n");
}
