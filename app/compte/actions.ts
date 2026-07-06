"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createCustomer } from "@/lib/customers/customersDb";
import {
  findRestaurantCustomerForConsumer,
  getConsumerProfileByUserId,
  isRestaurantPublicListed,
  upsertConsumerProfile,
} from "@/lib/public/consumer/consumerDb";
import { supabaseServer } from "@/lib/supabaseServer";
import { createReservation, reservationStartsUtc } from "@/lib/reservations/reservationsDb";
import { sendReservationRequestEmailToGuest } from "@/lib/messaging/reservationTransactionEmails";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function saveConsumerProfileAction(input: {
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };

  const profile = await upsertConsumerProfile({
    userId: user.id,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    marketingOptIn: input.marketingOptIn,
  });

  if (!profile) {
    return {
      ok: false,
      error: "Migration comptes clients requise (npm run db:apply).",
    };
  }

  revalidatePath("/compte");
  return { ok: true };
}

export async function createPublicReservationAction(input: {
  restaurantId: string;
  ymd: string;
  timeHm: string;
  partySize: number;
  comments: string | null;
}): Promise<ActionResult<{ reservationId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour réserver." };

  const profile = await getConsumerProfileByUserId(user.id, user.email ?? null);
  if (!profile) {
    return { ok: false, error: "Complétez votre profil client avant de réserver." };
  }

  const listed = await isRestaurantPublicListed(input.restaurantId);
  if (!listed) return { ok: false, error: "Ce restaurant n'accepte pas les réservations en ligne." };

  const n = input.partySize;
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    return { ok: false, error: "Nombre de convives invalide (1–12)." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ymd)) {
    return { ok: false, error: "Date invalide." };
  }

  const { data: startsAt, error: startErr } = await reservationStartsUtc(input.ymd, input.timeHm);
  if (startErr || !startsAt) {
    return { ok: false, error: startErr?.message ?? "Heure invalide." };
  }

  const durationMinutes = 90;
  const startMs = new Date(startsAt).getTime();
  const endsAt = new Date(startMs + durationMinutes * 60_000).toISOString();

  let customerId = await findRestaurantCustomerForConsumer(input.restaurantId, profile);

  if (!customerId) {
    const created = await createCustomer(input.restaurantId, {
      display_name: `${profile.first_name} ${profile.last_name}`.trim(),
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      source: "app",
      marketing_opt_in: profile.marketing_opt_in,
      service_messages_opt_in: true,
      created_by_user_id: null,
    });

    if (!created) return { ok: false, error: "Impossible de créer la fiche client." };
    customerId = created.id;

    await supabaseServer
      .from("restaurant_customers")
      .update({ consumer_user_id: user.id })
      .eq("id", customerId);
  }

  const contactName = `${profile.first_name} ${profile.last_name}`.trim();

  const { data: reservation, error: resErr } = await createReservation({
    restaurant_id: input.restaurantId,
    customer_id: customerId,
    party_size: n,
    starts_at: startsAt,
    ends_at: endsAt,
    contact_name: contactName,
    contact_phone: profile.phone,
    contact_email: profile.email,
    notes: input.comments?.trim() || null,
    source: "website",
    status: "pending",
    created_by_user_id: null,
    consumer_user_id: user.id,
  });

  if (resErr || !reservation) {
    return { ok: false, error: resErr?.message ?? "Réservation impossible." };
  }

  if (profile.email) {
    await sendReservationRequestEmailToGuest({
      restaurantId: input.restaurantId,
      reservationId: reservation.id,
      contactEmail: profile.email,
      contactName,
      partySize: n,
      startsAtIso: startsAt,
    }).catch(() => undefined);
  }

  revalidatePath("/compte");
  revalidatePath("/reservations");

  return { ok: true, data: { reservationId: reservation.id } };
}
