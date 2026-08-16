import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  DEFAULT_CAPACITY_SETTINGS,
  parseMergeGroup,
  parseReservationCapacitySettings,
  type DiningTableMergeGroup,
  type ReservationCapacitySettings,
} from "./capacitySettings";

export async function getReservationCapacitySettings(
  restaurantId: string
): Promise<ReservationCapacitySettings> {
  const { data, error } = await supabaseServer
    .from("reservation_capacity_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    console.warn("[capacitySettings] load", error.message);
    return { restaurant_id: restaurantId, ...DEFAULT_CAPACITY_SETTINGS };
  }

  return parseReservationCapacitySettings(data, restaurantId);
}

export async function upsertReservationCapacitySettings(
  restaurantId: string,
  patch: Partial<Omit<ReservationCapacitySettings, "restaurant_id">>
): Promise<{ error: string | null }> {
  const current = await getReservationCapacitySettings(restaurantId);
  const merged = { ...current, ...patch, restaurant_id: restaurantId };

  const { error } = await supabaseServer.from("reservation_capacity_settings").upsert(
    {
      restaurant_id: restaurantId,
      online_reservations_enabled: merged.online_reservations_enabled,
      default_duration_minutes: merged.default_duration_minutes,
      slot_step_minutes: merged.slot_step_minutes,
      min_lead_minutes: merged.min_lead_minutes,
      max_covers_per_slot: merged.max_covers_per_slot,
      max_online_covers_per_slot: merged.max_online_covers_per_slot,
      max_party_size_online: merged.max_party_size_online,
      max_party_size_staff: merged.max_party_size_staff,
      use_table_capacity: merged.use_table_capacity,
      online_share_pct: merged.online_share_pct,
      enforce_availability_online: merged.enforce_availability_online,
      enforce_availability_staff: merged.enforce_availability_staff,
      reservation_notify_email: merged.reservation_notify_email,
    },
    { onConflict: "restaurant_id" }
  );

  return { error: error?.message ?? null };
}

export async function listDiningTableMergeGroups(
  restaurantId: string,
  activeOnly = false
): Promise<DiningTableMergeGroup[]> {
  let q = supabaseServer
    .from("dining_table_merge_groups")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("label");

  if (activeOnly) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) {
    console.warn("[mergeGroups] list", error.message);
    return [];
  }

  return (data ?? []).map((row) => parseMergeGroup(row as Record<string, unknown>));
}

export async function upsertDiningTableMergeGroup(params: {
  restaurantId: string;
  id?: string;
  label: string;
  tableIds: string[];
  capacity: number;
  isActive?: boolean;
}): Promise<{ id: string | null; error: string | null }> {
  const tableIds = [...new Set(params.tableIds.filter(Boolean))];
  if (tableIds.length < 2) {
    return { id: null, error: "Sélectionnez au moins 2 tables." };
  }
  const capacity = Math.round(params.capacity);
  if (capacity < 2 || capacity > 50) {
    return { id: null, error: "Capacité fusion invalide (2–50)." };
  }

  const label = params.label.trim();
  if (!label) return { id: null, error: "Libellé requis." };

  const row = {
    restaurant_id: params.restaurantId,
    label,
    table_ids: tableIds,
    capacity,
    is_active: params.isActive !== false,
  };

  if (params.id) {
    const { error } = await supabaseServer
      .from("dining_table_merge_groups")
      .update(row)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId);
    return { id: params.id, error: error?.message ?? null };
  }

  const { data: existing } = await supabaseServer
    .from("dining_table_merge_groups")
    .select("sort_order")
    .eq("restaurant_id", params.restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sortOrder = ((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseServer
    .from("dining_table_merge_groups")
    .insert({ ...row, sort_order: sortOrder })
    .select("id")
    .single();

  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function deleteDiningTableMergeGroup(
  restaurantId: string,
  groupId: string
): Promise<{ error: string | null }> {
  const { error } = await supabaseServer
    .from("dining_table_merge_groups")
    .delete()
    .eq("id", groupId)
    .eq("restaurant_id", restaurantId);
  return { error: error?.message ?? null };
}
