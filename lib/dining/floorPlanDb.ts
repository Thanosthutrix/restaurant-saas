import { supabaseServer } from "@/lib/supabaseServer";
import {
  createDefaultFloorPlanDocument,
  getActiveLevel,
  parseStoredFloorPlanDocument,
  updateLevelLayout,
  type StoredFloorPlanDocument,
} from "@/lib/salle/floorPlanDocument";
import type { StoredFloorPlanLayout } from "@/lib/salle/floorPlanLayout";

export async function getRestaurantFloorPlanDocument(
  restaurantId: string
): Promise<{ data: StoredFloorPlanDocument | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_floor_plans")
    .select("layout")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data?.layout) return { data: null, error: null };

  return { data: parseStoredFloorPlanDocument(data.layout), error: null };
}

export async function upsertRestaurantFloorPlanDocument(
  restaurantId: string,
  document: StoredFloorPlanDocument
): Promise<{ error: Error | null }> {
  const parsed = parseStoredFloorPlanDocument(document);
  const { error } = await supabaseServer.from("restaurant_floor_plans").upsert(
    {
      restaurant_id: restaurantId,
      layout: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" }
  );

  return { error: error ? new Error(error.message) : null };
}

/** Compat ascendante (premier niveau actif). */
export async function getRestaurantFloorPlanLayout(
  restaurantId: string
): Promise<{ data: StoredFloorPlanLayout | null; error: Error | null }> {
  const { data, error } = await getRestaurantFloorPlanDocument(restaurantId);
  if (error || !data) return { data: null, error };
  return { data: getActiveLevel(data)?.layout ?? null, error: null };
}

/** Compat ascendante (met à jour le niveau actif). */
export async function upsertRestaurantFloorPlanLayout(
  restaurantId: string,
  layout: StoredFloorPlanLayout
): Promise<{ error: Error | null }> {
  const { data: existing } = await getRestaurantFloorPlanDocument(restaurantId);
  const document = existing ?? createDefaultFloorPlanDocument();
  const active = getActiveLevel(document);
  if (!active) return { error: new Error("Aucun espace de plan.") };

  return upsertRestaurantFloorPlanDocument(
    restaurantId,
    updateLevelLayout(document, active.id, layout)
  );
}
