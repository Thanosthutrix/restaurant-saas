import { supabaseServer } from "@/lib/supabaseServer";
import type { ReservationSource, ReservationStatus, RestaurantReservationRow } from "./types";

function mapRow(r: Record<string, unknown>): RestaurantReservationRow {
  return {
    id: String(r.id),
    restaurant_id: String(r.restaurant_id),
    customer_id: r.customer_id == null ? null : String(r.customer_id),
    party_size: Number(r.party_size),
    starts_at: String(r.starts_at),
    ends_at: String(r.ends_at),
    status: r.status as RestaurantReservationRow["status"],
    contact_name: r.contact_name == null ? null : String(r.contact_name),
    contact_phone: r.contact_phone == null ? null : String(r.contact_phone),
    contact_email: r.contact_email == null ? null : String(r.contact_email),
    notes: r.notes == null ? null : String(r.notes),
    source: r.source as RestaurantReservationRow["source"],
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    created_by_user_id: r.created_by_user_id == null ? null : String(r.created_by_user_id),
    dining_table_id: r.dining_table_id == null ? null : String(r.dining_table_id),
    dining_order_id: r.dining_order_id == null ? null : String(r.dining_order_id),
  };
}

export async function listReservationsForParisDay(
  restaurantId: string,
  ymd: string
): Promise<{ data: RestaurantReservationRow[]; error: Error | null }> {
  const { data, error } = await supabaseServer.rpc("list_reservations_paris_day", {
    p_restaurant_id: restaurantId,
    p_ymd: ymd,
  });
  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as Record<string, unknown>[];
  return { data: rows.map(mapRow), error: null };
}

export async function getReservation(
  id: string,
  restaurantId: string
): Promise<{ data: RestaurantReservationRow | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_reservations")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  return { data: mapRow(data as Record<string, unknown>), error: null };
}

export type CreateReservationInput = {
  restaurant_id: string;
  customer_id: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  source: ReservationSource;
  status: ReservationStatus;
  created_by_user_id: string | null;
};

export async function createReservation(
  row: CreateReservationInput
): Promise<{ data: RestaurantReservationRow | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_reservations")
    .insert({ ...row })
    .select("*")
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("Création impossible.") };
  return { data: mapRow(data as Record<string, unknown>), error: null };
}

export type UpdateReservationInput = {
  customer_id: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  source: ReservationSource;
  status: ReservationStatus;
};

export async function updateReservation(
  restaurantId: string,
  id: string,
  patch: UpdateReservationInput
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("restaurant_reservations")
    .update({ ...patch })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function updateReservationStatus(
  restaurantId: string,
  id: string,
  status: ReservationStatus
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("restaurant_reservations")
    .update({ status })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export type ReservationDiningSeatingPatch = {
  status: "seated";
  dining_table_id: string;
  dining_order_id: string;
};

export async function updateReservationDiningSeating(
  restaurantId: string,
  id: string,
  patch: ReservationDiningSeatingPatch
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("restaurant_reservations")
    .update({
      status: patch.status,
      dining_table_id: patch.dining_table_id,
      dining_order_id: patch.dining_order_id,
    })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Ouvre / rattache le ticket salle (table + fiche client) sans changer le statut (déjà assis, nouveau ticket). */
export async function updateReservationDiningOrderLink(
  restaurantId: string,
  id: string,
  patch: { dining_table_id: string; dining_order_id: string }
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("restaurant_reservations")
    .update({
      dining_table_id: patch.dining_table_id,
      dining_order_id: patch.dining_order_id,
    })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/**
 * Résout jour + heure (Europe/Paris) en timestamptz UTC.
 */
export async function reservationStartsUtc(
  ymd: string,
  timeHm: string
): Promise<{ data: string | null; error: Error | null }> {
  const t = timeHm.length === 5 ? `${timeHm}:00` : timeHm;
  const { data, error } = await supabaseServer.rpc("reservation_starts_utc", {
    p_ymd: ymd,
    p_t: t,
  });
  if (error) return { data: null, error: new Error(error.message) };
  if (data == null) return { data: null, error: new Error("Heure invalide.") };
  return { data: String(data), error: null };
}
