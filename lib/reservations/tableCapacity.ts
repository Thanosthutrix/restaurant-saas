import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { parseStoredFloorPlanDocument } from "@/lib/salle/floorPlanDocument";
import { listDiningTableMergeGroups } from "./capacitySettingsDb";
import type { ReservationCapacitySettings } from "./capacitySettings";

const DEFAULT_TABLE_CAPACITY = 4;
const FALLBACK_MAX_COVERS = 60;

export type RestaurantSeatingCapacity = {
  tableCount: number;
  sumTableCapacity: number;
  maxSingleParty: number;
  mergeGroupCount: number;
  computedMaxCovers: number;
};

/** Capacités par table depuis le plan de salle (tous niveaux). */
function capacitiesFromFloorPlan(
  layoutRaw: unknown,
  activeTableIds: Set<string>
): Map<string, number> {
  const doc = parseStoredFloorPlanDocument(layoutRaw);
  const out = new Map<string, number>();

  for (const level of doc.levels) {
    const removed = new Set(level.layout.removedFromPlan ?? []);
    for (const [tableId, cfg] of Object.entries(level.layout.baseTables)) {
      if (removed.has(tableId) || !activeTableIds.has(tableId)) continue;
      const cap =
        typeof cfg.capacity === "number" && cfg.capacity >= 2 ? Math.round(cfg.capacity) : DEFAULT_TABLE_CAPACITY;
      out.set(tableId, cap);
    }
  }

  for (const id of activeTableIds) {
    if (!out.has(id)) out.set(id, DEFAULT_TABLE_CAPACITY);
  }

  return out;
}

export async function computeRestaurantSeatingCapacity(
  restaurantId: string
): Promise<RestaurantSeatingCapacity> {
  const [{ data: tables }, { data: floorRow }, mergeGroups] = await Promise.all([
    supabaseServer
      .from("dining_tables")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
    supabaseServer
      .from("restaurant_floor_plans")
      .select("layout")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    listDiningTableMergeGroups(restaurantId, true),
  ]);

  const activeTableIds = new Set((tables ?? []).map((t) => String(t.id)));
  const capByTable = capacitiesFromFloorPlan(floorRow?.layout, activeTableIds);

  let sumTableCapacity = 0;
  let maxSingleParty = 0;
  for (const cap of capByTable.values()) {
    sumTableCapacity += cap;
    maxSingleParty = Math.max(maxSingleParty, cap);
  }

  for (const group of mergeGroups) {
    maxSingleParty = Math.max(maxSingleParty, group.capacity);
  }

  const tableCount = capByTable.size;
  const computedMaxCovers =
    tableCount > 0 ? sumTableCapacity : FALLBACK_MAX_COVERS;

  return {
    tableCount,
    sumTableCapacity,
    maxSingleParty: maxSingleParty || DEFAULT_TABLE_CAPACITY,
    mergeGroupCount: mergeGroups.length,
    computedMaxCovers,
  };
}

export type ResolvedCapacityLimits = {
  maxCoversPerSlot: number;
  maxOnlineCoversPerSlot: number;
  maxPartySizeOnline: number;
  maxPartySizeStaff: number;
  seating: RestaurantSeatingCapacity;
};

export async function resolveCapacityLimits(
  restaurantId: string,
  settings: ReservationCapacitySettings
): Promise<ResolvedCapacityLimits> {
  const seating = settings.use_table_capacity
    ? await computeRestaurantSeatingCapacity(restaurantId)
    : {
        tableCount: 0,
        sumTableCapacity: 0,
        maxSingleParty: settings.max_party_size_online,
        mergeGroupCount: 0,
        computedMaxCovers: FALLBACK_MAX_COVERS,
      };

  const maxCoversPerSlot =
    settings.max_covers_per_slot ??
    (settings.use_table_capacity ? seating.computedMaxCovers : FALLBACK_MAX_COVERS);

  const onlineFromShare = Math.floor((maxCoversPerSlot * settings.online_share_pct) / 100);
  const maxOnlineCoversPerSlot =
    settings.max_online_covers_per_slot ?? onlineFromShare;

  const maxPartyOnline = Math.min(
    settings.max_party_size_online,
    seating.maxSingleParty || settings.max_party_size_online
  );

  return {
    maxCoversPerSlot,
    maxOnlineCoversPerSlot,
    maxPartySizeOnline: maxPartyOnline,
    maxPartySizeStaff: settings.max_party_size_staff,
    seating,
  };
}
