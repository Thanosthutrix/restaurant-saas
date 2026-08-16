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
import {
  getConsumerSearchPreferences,
  upsertConsumerSearchPreferences,
} from "@/lib/b2c/experience/consumerPreferencesDb";
import type { ClientIntent, EstablishmentType, NoiseLevel, OccasionTag, PriceTier } from "@/lib/b2c/experience/taxonomy";
import { CLIENT_INTENTS, isEstablishmentType, isNoiseLevel, isPriceTier, OCCASION_TAGS } from "@/lib/b2c/experience/taxonomy";
import { supabaseServer } from "@/lib/supabaseServer";
import { cancelConsumerReservation, createReservation, getConsumerReservation, reservationStartsUtc } from "@/lib/reservations/reservationsDb";
import {
  sendReservationCancelledEmailToGuest,
  sendReservationCancelledEmailToRestaurant,
  sendReservationNotifyEmailToRestaurant,
  sendReservationRequestEmailToGuest,
} from "@/lib/messaging/reservationTransactionEmails";
import { checkReservationSlotAvailable } from "@/lib/reservations/availability";
import { getReservationCapacitySettings } from "@/lib/reservations/capacitySettingsDb";
import { notifyTeamReservationCancelled, notifyTeamReservationCreated } from "@/lib/push/notifyTeamReservation";
import type { ReservationStatus } from "@/lib/reservations/types";

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

export async function saveConsumerSearchPreferencesAction(input: {
  excludedEstablishmentTypes: string[];
  defaultIntent: string | null;
  preferredNoiseLevel: string | null;
  minPriceTier: string | null;
  maxPriceTier: string | null;
  preferredOccasions: string[];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };

  const excluded = input.excludedEstablishmentTypes.filter(isEstablishmentType);
  const defaultIntent = input.defaultIntent && CLIENT_INTENTS.includes(input.defaultIntent as ClientIntent)
    ? (input.defaultIntent as ClientIntent)
    : null;
  const noise =
    input.preferredNoiseLevel && isNoiseLevel(input.preferredNoiseLevel)
      ? (input.preferredNoiseLevel as NoiseLevel)
      : null;
  const minPrice =
    input.minPriceTier && isPriceTier(input.minPriceTier) ? (input.minPriceTier as PriceTier) : null;
  const maxPrice =
    input.maxPriceTier && isPriceTier(input.maxPriceTier) ? (input.maxPriceTier as PriceTier) : null;
  const occasions = input.preferredOccasions.filter((o): o is OccasionTag =>
    (OCCASION_TAGS as readonly string[]).includes(o)
  );

  const saved = await upsertConsumerSearchPreferences({
    userId: user.id,
    excludedEstablishmentTypes: excluded as EstablishmentType[],
    defaultIntent,
    preferredNoiseLevel: noise,
    minPriceTier: minPrice,
    maxPriceTier: maxPrice,
    preferredOccasions: occasions,
    markOnboardingComplete: true,
  });

  if (!saved) {
    return { ok: false, error: "Migration préférences recherche requise (npm run db:apply)." };
  }

  revalidatePath("/compte");
  revalidatePath("/");
  return { ok: true };
}

export async function fetchConsumerSearchPreferencesAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getConsumerSearchPreferences>>>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const prefs = await getConsumerSearchPreferences(user.id);
  return { ok: true, data: prefs };
}

export async function checkPublicReservationSlotAction(input: {
  restaurantId: string;
  ymd: string;
  timeHm: string;
  partySize: number;
}): Promise<ActionResult<{ available: boolean }>> {
  const listed = await isRestaurantPublicListed(input.restaurantId);
  if (!listed) return { ok: false, error: "Ce restaurant n'accepte pas les réservations en ligne." };

  const settings = await getReservationCapacitySettings(input.restaurantId);
  if (!settings.online_reservations_enabled) {
    return { ok: false, error: "Les réservations en ligne sont désactivées." };
  }

  const n = input.partySize;
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: "Nombre de convives invalide." };
  }

  const slot = await checkReservationSlotAvailable({
    restaurantId: input.restaurantId,
    ymd: input.ymd,
    timeHm: input.timeHm,
    partySize: n,
    channel: "online",
  });

  if (slot.error && !slot.available) {
    return { ok: false, error: slot.error };
  }

  return { ok: true, data: { available: slot.available } };
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

  const settings = await getReservationCapacitySettings(input.restaurantId);
  if (!settings.online_reservations_enabled) {
    return { ok: false, error: "Les réservations en ligne sont désactivées pour cet établissement." };
  }

  const n = input.partySize;
  if (!Number.isInteger(n) || n < 1 || n > settings.max_party_size_online) {
    return {
      ok: false,
      error: `Nombre de convives invalide (1–${settings.max_party_size_online}).`,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ymd)) {
    return { ok: false, error: "Date invalide." };
  }

  const { data: startsAt, error: startErr } = await reservationStartsUtc(input.ymd, input.timeHm);
  if (startErr || !startsAt) {
    return { ok: false, error: startErr?.message ?? "Heure invalide." };
  }

  const slot = await checkReservationSlotAvailable({
    restaurantId: input.restaurantId,
    ymd: input.ymd,
    timeHm: input.timeHm,
    partySize: n,
    channel: "online",
  });
  if (!slot.available) {
    return {
      ok: false,
      error: slot.error ?? "Ce créneau n'est plus disponible. Choisissez une autre heure.",
    };
  }

  const durationMinutes = settings.default_duration_minutes;
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

  await sendReservationNotifyEmailToRestaurant({
    restaurantId: input.restaurantId,
    reservationId: reservation.id,
    contactName,
    contactPhone: profile.phone,
    contactEmail: profile.email,
    startsAtIso: startsAt,
    partySize: n,
    notes: input.comments?.trim() || null,
    source: "website",
  }).catch(() => undefined);

  void notifyTeamReservationCreated({
    restaurantId: input.restaurantId,
    reservationId: reservation.id,
    partySize: n,
    startsAtIso: startsAt,
    contactName,
    source: "website",
  }).catch(() => undefined);

  revalidatePath("/compte");
  revalidatePath("/reservations");

  return { ok: true, data: { reservationId: reservation.id } };
}

const CONSUMER_CANCELLABLE_STATUSES: ReservationStatus[] = ["pending", "confirmed"];

export async function cancelPublicReservationAction(
  reservationId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour annuler." };

  const { data: reservation, error: loadErr } = await getConsumerReservation(
    reservationId,
    user.id
  );
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!reservation) return { ok: false, error: "Réservation introuvable." };

  if (!CONSUMER_CANCELLABLE_STATUSES.includes(reservation.status)) {
    return { ok: false, error: "Cette réservation ne peut plus être annulée en ligne." };
  }

  if (new Date(reservation.starts_at).getTime() <= Date.now()) {
    return { ok: false, error: "Impossible d'annuler une réservation passée ou en cours." };
  }

  const { data: cancelled, error: cancelErr } = await cancelConsumerReservation(
    reservationId,
    user.id
  );
  if (cancelErr || !cancelled) {
    return { ok: false, error: cancelErr?.message ?? "Annulation impossible." };
  }

  if (cancelled.contact_email) {
    await sendReservationCancelledEmailToGuest({
      restaurantId: cancelled.restaurant_id,
      reservationId: cancelled.id,
      contactEmail: cancelled.contact_email,
      contactName: cancelled.contact_name,
      startsAtIso: cancelled.starts_at,
      partySize: cancelled.party_size,
    }).catch(() => undefined);
  }

  await sendReservationCancelledEmailToRestaurant({
    restaurantId: cancelled.restaurant_id,
    reservationId: cancelled.id,
    contactName: cancelled.contact_name,
    contactPhone: cancelled.contact_phone,
    contactEmail: cancelled.contact_email,
    startsAtIso: cancelled.starts_at,
    partySize: cancelled.party_size,
    source: cancelled.source,
  }).catch(() => undefined);

  void notifyTeamReservationCancelled({
    restaurantId: cancelled.restaurant_id,
    reservationId: cancelled.id,
    partySize: cancelled.party_size,
    startsAtIso: cancelled.starts_at,
    contactName: cancelled.contact_name,
    source: cancelled.source,
  }).catch(() => undefined);

  revalidatePath("/compte");
  revalidatePath("/reservations");

  return { ok: true };
}
