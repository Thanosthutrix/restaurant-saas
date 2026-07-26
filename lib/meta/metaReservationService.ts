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
    status: "confirmed",
    created_by_user_id: null,
  });

  if (resErr || !reservation) {
    return { error: resErr?.message ?? "Création de réservation impossible." };
  }

  return { reservationId: reservation.id, startsAt };
}

export function formatReservationReference(reservationId: string): string {
  return reservationId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function formatReservationConfirmationMessage(params: {
  partySize: number;
  startsAtIso: string;
  reservationRef: string;
  restaurantName?: string | null;
  restaurantAddress?: string | null;
  restaurantPhone?: string | null;
}): string {
  const when = new Date(params.startsAtIso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = ["✅ Réservation confirmée", ""];

  if (params.restaurantName?.trim()) {
    lines.push(`📍 ${params.restaurantName.trim()}`);
  }
  lines.push(`👥 ${params.partySize} personne${params.partySize > 1 ? "s" : ""}`);
  lines.push(`🗓 ${when}`);
  lines.push(`🔖 Réf. ${params.reservationRef}`);

  if (params.restaurantAddress?.trim()) {
    lines.push(`📫 ${params.restaurantAddress.trim()}`);
  }
  if (params.restaurantPhone?.trim()) {
    lines.push(`📞 ${params.restaurantPhone.trim()}`);
  }

  lines.push("");
  lines.push(
    "Nous avons hâte de vous accueillir ! Pour modifier ou annuler, répondez à ce message."
  );

  return lines.join("\n");
}
