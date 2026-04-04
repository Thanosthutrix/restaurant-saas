import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Vérifie qu'ajouter l'arête (parentItemId -> componentItemId) ne crée pas de cycle
 * dans le graphe de composition des inventory_items.
 *
 * Logique : on s'apprête à ajouter parentItemId -> componentItemId. Un cycle apparaîtrait
 * si parentItemId est déjà atteignable à partir de componentItemId dans le graphe actuel
 * (car on aurait alors componentItemId -> ... -> parentItemId, et la nouvelle arête donnerait
 * parentItemId -> componentItemId -> ... -> parentItemId). On parcourt donc le graphe à partir
 * de componentItemId ; si on atteint parentItemId, on lève une erreur.
 */
export async function assertNoInventoryCycle(params: {
  restaurantId: string;
  parentItemId: string;
  componentItemId: string;
}): Promise<void> {
  const { restaurantId, parentItemId, componentItemId } = params;

  if (parentItemId === componentItemId) {
    throw new Error("Un composant ne peut pas être son propre parent (auto-référence).");
  }

  const { data: rows, error } = await supabaseServer
    .from("inventory_item_components")
    .select("parent_item_id, component_item_id")
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(`Impossible de charger la composition: ${error.message}`);

  const edges = (rows ?? []) as { parent_item_id: string; component_item_id: string }[];
  const outEdges = new Map<string, string[]>();
  for (const e of edges) {
    const list = outEdges.get(e.parent_item_id) ?? [];
    list.push(e.component_item_id);
    outEdges.set(e.parent_item_id, list);
  }

  // À partir de componentItemId, peut-on atteindre parentItemId ?
  const visited = new Set<string>();
  const stack: string[] = [componentItemId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === parentItemId) {
      throw new Error(
        "Cette composition créerait une boucle (le composant dépend déjà du parent, directement ou indirectement)."
      );
    }
    if (visited.has(cur)) continue;
    visited.add(cur);
    const nexts = outEdges.get(cur) ?? [];
    for (const n of nexts) stack.push(n);
  }
}
