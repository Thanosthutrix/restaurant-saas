import { supabaseServer } from "@/lib/supabaseServer";

/** PostgREST quand la table n’existe pas ou n’est pas dans le cache API (migrations non appliquées). */
function isMissingRelationSchemaError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    msg.includes("schema cache") ||
    (msg.includes("could not find") && (msg.includes("table") || msg.includes("relation")))
  );
}

/**
 * Supprime toutes les données métier liées à un restaurant, puis la ligne `restaurants`.
 * Les lignes liées par ON DELETE CASCADE (commandes, BL, fournisseurs, factures, brouillons…) partent avec le restaurant.
 */
export async function purgeRestaurantData(
  restaurantId: string,
  ownerId: string
): Promise<{ error: string | null }> {
  const { data: row, error: rowErr } = await supabaseServer
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (rowErr) return { error: rowErr.message };
  if (!row) return { error: "Restaurant introuvable ou accès refusé." };

  const { data: lots, error: lotsErr } = await supabaseServer
    .from("inventory_stock_lots")
    .select("id")
    .eq("restaurant_id", restaurantId);
  if (lotsErr) return { error: lotsErr.message };
  const lotIds = (lots ?? []).map((l: { id: string }) => l.id);
  if (lotIds.length > 0) {
    const { error: a1 } = await supabaseServer.from("stock_lot_allocations").delete().in("lot_id", lotIds);
    if (a1) return { error: a1.message };
  }
  const { error: dl } = await supabaseServer.from("inventory_stock_lots").delete().eq("restaurant_id", restaurantId);
  if (dl) return { error: dl.message };

  const { error: dm } = await supabaseServer.from("stock_movements").delete().eq("restaurant_id", restaurantId);
  if (dm) return { error: dm.message };

  const { error: tiErr } = await supabaseServer.from("ticket_imports").delete().eq("restaurant_id", restaurantId);
  if (tiErr) return { error: tiErr.message };

  const { error: ssErr } = await supabaseServer.from("service_sales").delete().eq("restaurant_id", restaurantId);
  if (ssErr) return { error: ssErr.message };
  const { error: silErr } = await supabaseServer.from("service_import_lines").delete().eq("restaurant_id", restaurantId);
  if (silErr && !isMissingRelationSchemaError(silErr)) return { error: silErr.message };
  const { error: sDel } = await supabaseServer.from("services").delete().eq("restaurant_id", restaurantId);
  if (sDel) return { error: sDel.message };

  const { error: dcErr } = await supabaseServer.from("dish_components").delete().eq("restaurant_id", restaurantId);
  if (dcErr) return { error: dcErr.message };
  const { error: daErr } = await supabaseServer.from("dish_aliases").delete().eq("restaurant_id", restaurantId);
  if (daErr) return { error: daErr.message };
  const { error: dErr } = await supabaseServer.from("dishes").delete().eq("restaurant_id", restaurantId);
  if (dErr) return { error: dErr.message };

  const { error: iicErr } = await supabaseServer
    .from("inventory_item_components")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (iicErr) return { error: iicErr.message };
  const { error: invErr } = await supabaseServer.from("inventory_items").delete().eq("restaurant_id", restaurantId);
  if (invErr) return { error: invErr.message };

  const { error: rErr } = await supabaseServer
    .from("restaurants")
    .delete()
    .eq("id", restaurantId)
    .eq("owner_id", ownerId);
  if (rErr) return { error: rErr.message };

  return { error: null };
}
