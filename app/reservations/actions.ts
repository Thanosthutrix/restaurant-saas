"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { createCustomer } from "@/lib/customers/customersDb";
import type { CustomerSource } from "@/lib/customers/types";
import { validateDurationMinutes } from "@/lib/reservations/parisTime";
import {
  createReservation,
  getReservation,
  reservationStartsUtc,
  updateReservation,
  updateReservationDiningOrderLink,
  updateReservationDiningSeating,
  updateReservationStatus,
} from "@/lib/reservations/reservationsDb";
import {
  ensureOpenDiningOrder,
  getDiningOrder,
  getDiningTable,
  setDiningOrderCustomerId,
} from "@/lib/dining/diningDb";
import type { ActionResult } from "@/app/salle/actions";
import { sendReservationRequestEmailToGuest } from "@/lib/messaging/reservationTransactionEmails";
import type { ReservationSource, ReservationStatus } from "@/lib/reservations/types";

async function assertReservationsWrite(userId: string, restaurantId: string) {
  return assertRestaurantAction(userId, restaurantId, "reservations.mutate");
}

function reservationToCustomerSource(src: ReservationSource): CustomerSource {
  switch (src) {
    case "phone":
    case "walk_in":
    case "website":
    case "other":
      return src;
    default:
      return "other";
  }
}

export async function createReservationAction(params: {
  restaurantId: string;
  ymd: string;
  timeHm: string;
  partySize: number;
  durationMinutes: number;
  source: ReservationSource;
  customerId: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  /** Créer une fiche client (même infos contact) — ignoré si une fiche est déjà liée. */
  createFicheFromContact?: boolean;
}): Promise<
  ActionResult<{
    id: string;
    /** Fiche client créée : lien pour compléter le dossier. */
    newCustomerId?: string;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertReservationsWrite(user.id, params.restaurantId);
  if (!gate.ok) return gate;

  const n = params.partySize;
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    return { ok: false, error: "Nombre de couverts invalide (1–50)." };
  }
  const dur = params.durationMinutes;
  const durErr = validateDurationMinutes(dur);
  if (durErr) return { ok: false, error: durErr };
  if (!params.customerId) {
    const name = params.contactName.trim();
    if (!name) {
      return { ok: false, error: "Indiquez un nom ou choisissez un client de la base." };
    }
  }

  const { data: startIso, error: tErr } = await reservationStartsUtc(params.ymd, params.timeHm);
  if (tErr || !startIso) return { ok: false, error: tErr?.message ?? "Heure invalide." };

  const startMs = new Date(startIso).getTime();
  if (Number.isNaN(startMs)) return { ok: false, error: "Date ou heure invalide." };
  const endIso = new Date(startMs + dur * 60_000).toISOString();

  let customerId = params.customerId;
  if (!customerId && params.createFicheFromContact) {
    const clientsGate = await assertRestaurantAction(user.id, params.restaurantId, "clients.mutate");
    if (!clientsGate.ok) {
      return { ok: false, error: "Pas le droit de créer une fiche client. Décochez l’option ou demandez l’accès." };
    }
    const display = params.contactName.trim();
    if (!display) {
      return { ok: false, error: "Indiquez un nom pour créer la fiche client." };
    }
    const c = await createCustomer(params.restaurantId, {
      display_name: display,
      email: params.contactEmail?.trim() || null,
      phone: params.contactPhone?.trim() || null,
      source: reservationToCustomerSource(params.source),
      service_messages_opt_in: true,
      created_by_user_id: user.id,
    });
    if (!c) {
      return { ok: false, error: "La fiche client n’a pas pu être créée. Vérifiez les champs (ex. e-mail en doublon)." };
    }
    customerId = c.id;
    revalidatePath("/clients");
    revalidatePath(`/clients/${c.id}`);
  }

  const { data, error } = await createReservation({
    restaurant_id: params.restaurantId,
    customer_id: customerId,
    party_size: n,
    starts_at: startIso,
    ends_at: endIso,
    contact_name: params.contactName.trim() || null,
    contact_phone: params.contactPhone?.trim() || null,
    contact_email: params.contactEmail?.trim() || null,
    notes: params.notes?.trim() || null,
    source: params.source,
    status: "pending",
    created_by_user_id: user.id,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Enregistrement impossible." };

  revalidatePath("/reservations");
  if (data && params.contactEmail?.trim()) {
    void sendReservationRequestEmailToGuest({
      restaurantId: params.restaurantId,
      reservationId: data.id,
      contactEmail: params.contactEmail,
      contactName: params.contactName?.trim() || null,
      startsAtIso: startIso,
      partySize: n,
    });
  }
  const newCustomerIdOut =
    params.createFicheFromContact && !params.customerId && customerId ? customerId : undefined;
  return { ok: true, data: { id: data.id, newCustomerId: newCustomerIdOut } };
}

export async function updateReservationAction(params: {
  restaurantId: string;
  reservationId: string;
  ymd: string;
  timeHm: string;
  partySize: number;
  durationMinutes: number;
  source: ReservationSource;
  status: ReservationStatus;
  customerId: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertReservationsWrite(user.id, params.restaurantId);
  if (!gate.ok) return gate;

  const n = params.partySize;
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    return { ok: false, error: "Nombre de couverts invalide (1–50)." };
  }
  const durErr = validateDurationMinutes(params.durationMinutes);
  if (durErr) return { ok: false, error: durErr };
  if (!params.customerId) {
    if (!params.contactName.trim()) {
      return { ok: false, error: "Indiquez un nom ou liez une fiche client." };
    }
  }

  const { data: row } = await getReservation(params.reservationId, params.restaurantId);
  if (!row) return { ok: false, error: "Réservation introuvable." };

  const { data: startIso, error: tErr } = await reservationStartsUtc(params.ymd, params.timeHm);
  if (tErr || !startIso) return { ok: false, error: tErr?.message ?? "Heure invalide." };
  const startMs = new Date(startIso).getTime();
  if (Number.isNaN(startMs)) return { ok: false, error: "Date ou heure invalide." };
  const endIso = new Date(startMs + params.durationMinutes * 60_000).toISOString();

  const { error } = await updateReservation(params.restaurantId, params.reservationId, {
    customer_id: params.customerId,
    party_size: n,
    starts_at: startIso,
    ends_at: endIso,
    contact_name: params.contactName.trim() || null,
    contact_phone: params.contactPhone?.trim() || null,
    contact_email: params.contactEmail?.trim() || null,
    notes: params.notes?.trim() || null,
    source: params.source,
    status: params.status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reservations");
  revalidatePath(`/reservations/${params.reservationId}/modifier`);
  return { ok: true };
}

export async function setReservationStatusAction(params: {
  restaurantId: string;
  reservationId: string;
  status: ReservationStatus;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertReservationsWrite(user.id, params.restaurantId);
  if (!gate.ok) return gate;

  const { data: row } = await getReservation(params.reservationId, params.restaurantId);
  if (!row) return { ok: false, error: "Réservation introuvable." };

  const { error } = await updateReservationStatus(
    params.restaurantId,
    params.reservationId,
    params.status
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reservations");
  return { ok: true };
}

/**
 * Enregistre l’arrivée (statut assis), associe la table, ouvre ou réutilise le ticket salle
 * et rattache la fiche client sur la commande si présente. Rediriger ensuite vers /salle/commande/[id].
 * Sans table : uniquement si la résa est déjà « assis » avec un ticket encore ouvert — renvoie son id.
 */
export async function seatReservationAndOpenTicketAction(params: {
  restaurantId: string;
  reservationId: string;
  /** Obligatoire pour la première prise de table ou si le ticket précédent est clôturé. */
  diningTableId: string | null;
}): Promise<ActionResult<{ orderId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertReservationsWrite(user.id, params.restaurantId);
  if (!gate.ok) return gate;

  const { data: resv } = await getReservation(params.reservationId, params.restaurantId);
  if (!resv) return { ok: false, error: "Réservation introuvable." };
  if (resv.status === "cancelled" || resv.status === "completed" || resv.status === "no_show") {
    return { ok: false, error: "Cette réservation ne permet pas d’enregistrer une arrivée." };
  }

  if (resv.dining_order_id) {
    const { data: existingOrder } = await getDiningOrder(resv.dining_order_id, params.restaurantId);
    if (existingOrder?.status === "open") {
      if (resv.customer_id) {
        const cErr = await setDiningOrderCustomerId(
          params.restaurantId,
          resv.dining_order_id,
          resv.customer_id
        );
        if (cErr.error) return { ok: false, error: cErr.error.message };
      }
      revalidatePath("/reservations");
      revalidatePath("/salle");
      revalidatePath("/caisse");
      revalidatePath(`/salle/commande/${resv.dining_order_id}`);
      return { ok: true, data: { orderId: resv.dining_order_id } };
    }
  }

  const tableId = params.diningTableId?.trim() || null;
  if (!tableId) {
    return { ok: false, error: "Choisissez une table pour ouvrir le ticket." };
  }

  const { data: table } = await getDiningTable(tableId, params.restaurantId);
  if (!table) return { ok: false, error: "Table introuvable." };

  const { orderId, error: ordErr } = await ensureOpenDiningOrder(params.restaurantId, tableId);
  if (ordErr || !orderId) return { ok: false, error: ordErr?.message ?? "Impossible d’ouvrir le ticket." };

  if (resv.customer_id) {
    const cErr = await setDiningOrderCustomerId(params.restaurantId, orderId, resv.customer_id);
    if (cErr.error) return { ok: false, error: cErr.error.message };
  }

  if (resv.status === "pending" || resv.status === "confirmed") {
    const { error: uErr } = await updateReservationDiningSeating(params.restaurantId, params.reservationId, {
      status: "seated",
      dining_table_id: tableId,
      dining_order_id: orderId,
    });
    if (uErr) return { ok: false, error: uErr.message };
  } else {
    const { error: uErr } = await updateReservationDiningOrderLink(params.restaurantId, params.reservationId, {
      dining_table_id: tableId,
      dining_order_id: orderId,
    });
    if (uErr) return { ok: false, error: uErr.message };
  }

  revalidatePath("/reservations");
  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath(`/salle/commande/${orderId}`);
  return { ok: true, data: { orderId } };
}
