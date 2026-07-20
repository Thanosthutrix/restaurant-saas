import { supabaseServer } from "@/lib/supabaseServer";
import {
  createDefaultKitchenFloorPlanDocument,
  parseStoredKitchenFloorPlanDocument,
  type StoredKitchenFloorPlanDocument,
} from "@/lib/cuisine/kitchenFloorPlanDocument";
import { getActiveLevel, updateLevelLayout } from "@/lib/salle/floorPlanDocument";
import type { StoredFloorPlanLayout } from "@/lib/salle/floorPlanLayout";

export async function getRestaurantKitchenFloorPlanDocument(
  restaurantId: string
): Promise<{ data: StoredKitchenFloorPlanDocument | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_kitchen_floor_plans")
    .select("layout")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data?.layout) return { data: null, error: null };

  return { data: parseStoredKitchenFloorPlanDocument(data.layout), error: null };
}

export async function upsertRestaurantKitchenFloorPlanDocument(
  restaurantId: string,
  document: StoredKitchenFloorPlanDocument
): Promise<{ error: Error | null }> {
  const parsed = parseStoredKitchenFloorPlanDocument(document);
  const { error } = await supabaseServer.from("restaurant_kitchen_floor_plans").upsert(
    {
      restaurant_id: restaurantId,
      layout: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" }
  );

  return { error: error ? new Error(error.message) : null };
}

export async function getRestaurantKitchenFloorPlanLayout(
  restaurantId: string
): Promise<{ data: StoredFloorPlanLayout | null; error: Error | null }> {
  const { data, error } = await getRestaurantKitchenFloorPlanDocument(restaurantId);
  if (error || !data) return { data: null, error };
  return { data: getActiveLevel(data)?.layout ?? null, error: null };
}

export async function upsertRestaurantKitchenFloorPlanLayout(
  restaurantId: string,
  layout: StoredFloorPlanLayout
): Promise<{ error: Error | null }> {
  const { data: existing } = await getRestaurantKitchenFloorPlanDocument(restaurantId);
  const document = existing ?? createDefaultKitchenFloorPlanDocument();
  const active = getActiveLevel(document);
  if (!active) return { error: new Error("Aucun espace de plan cuisine.") };

  return upsertRestaurantKitchenFloorPlanDocument(
    restaurantId,
    updateLevelLayout(document, active.id, layout)
  );
}
