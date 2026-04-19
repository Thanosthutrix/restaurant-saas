import { supabaseServer } from "@/lib/supabaseServer";
import type {
  PreparationCandidateDish,
  PreparationCandidatePrep,
  PreparationRecord,
} from "./types";

function mapRecord(row: Record<string, unknown>): PreparationRecord {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    inventory_item_id: row.inventory_item_id == null ? null : String(row.inventory_item_id),
    dish_id: row.dish_id == null ? null : String(row.dish_id),
    label: String(row.label ?? ""),
    lot_reference: row.lot_reference == null || row.lot_reference === "" ? null : String(row.lot_reference),
    started_at: String(row.started_at ?? ""),
    temp_end_celsius: row.temp_end_celsius == null ? null : Number(row.temp_end_celsius),
    temp_end_recorded_at: row.temp_end_recorded_at == null ? null : String(row.temp_end_recorded_at),
    temp_2h_celsius: row.temp_2h_celsius == null ? null : Number(row.temp_2h_celsius),
    temp_2h_due_at: row.temp_2h_due_at == null ? null : String(row.temp_2h_due_at),
    temp_2h_recorded_at: row.temp_2h_recorded_at == null ? null : String(row.temp_2h_recorded_at),
    dlc_date: row.dlc_date == null ? null : String(row.dlc_date).slice(0, 10),
    recorded_by_user_id: row.recorded_by_user_id == null ? null : String(row.recorded_by_user_id),
    recorded_by_display: row.recorded_by_display == null ? null : String(row.recorded_by_display),
    comment: row.comment == null ? null : String(row.comment),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Préparations stock (type prep). */
export async function listPreparationInventoryItems(
  restaurantId: string
): Promise<PreparationCandidatePrep[]> {
  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select("id, name, unit")
    .eq("restaurant_id", restaurantId)
    .eq("item_type", "prep")
    .order("name");
  if (error || !data) return [];
  return (data as { id: string; name: string; unit: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
  }));
}

/** Plats (carte) pour rattachement facultatif. */
export async function listPreparationDishes(restaurantId: string): Promise<PreparationCandidateDish[]> {
  const { data, error } = await supabaseServer
    .from("dishes")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error || !data) return [];
  return (data as { id: string; name: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

export async function getPreparationRecord(
  restaurantId: string,
  recordId: string
): Promise<PreparationRecord | null> {
  const { data, error } = await supabaseServer
    .from("preparation_records")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", recordId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRecord(data as Record<string, unknown>);
}

/** Lots récents pour filtrage instantané côté client (comme la recherche de composants dans les plats). */
export async function listPreparationRecordsWithLotForLookup(
  restaurantId: string,
  limit = 400
): Promise<PreparationRecord[]> {
  const { data, error } = await supabaseServer
    .from("preparation_records")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .not("lot_reference", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRecord);
}

/** Recherche par numéro de lot exact (insensible à la casse, espaces ignorés). */
export async function getPreparationRecordByLotReference(
  restaurantId: string,
  rawLot: string
): Promise<PreparationRecord | null> {
  const q = rawLot.trim().replace(/\s+/g, "").toUpperCase();
  if (q.length < 4) return null;

  const { data, error } = await supabaseServer
    .from("preparation_records")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("lot_reference", q)
    .maybeSingle();

  if (error || !data) return null;
  return mapRecord(data as Record<string, unknown>);
}

/** Sans T° de fin (saisie immédiate attendue). */
export async function listPreparationRecordsAwaitingTempEnd(
  restaurantId: string
): Promise<PreparationRecord[]> {
  const { data, error } = await supabaseServer
    .from("preparation_records")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("temp_end_recorded_at", null)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRecord);
}

/** T° fin saisie, contrôle +2 h non fait. */
export async function listPreparationRecordsAwaiting2hCheck(
  restaurantId: string
): Promise<PreparationRecord[]> {
  const { data, error } = await supabaseServer
    .from("preparation_records")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .not("temp_end_recorded_at", "is", null)
    .is("temp_2h_recorded_at", null)
    .order("temp_2h_due_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRecord);
}

export async function listPreparationRegister(
  restaurantId: string,
  limit = 200
): Promise<PreparationRecord[]> {
  const { data, error } = await supabaseServer
    .from("preparation_records")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRecord);
}
