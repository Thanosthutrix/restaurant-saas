import { supabaseServer } from "@/lib/supabaseServer";

export type CategoryAppliesTo = "dish" | "inventory" | "both";

export type RestaurantCategory = {
  id: string;
  restaurant_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  applies_to: CategoryAppliesTo;
};

export type CategoryTreeNode = RestaurantCategory & {
  children: CategoryTreeNode[];
};

export function parseCategoryAppliesTo(raw: unknown): CategoryAppliesTo {
  if (raw === "dish" || raw === "inventory" || raw === "both") return raw;
  return "both";
}

export function categoryAppliesToDish(c: { applies_to: CategoryAppliesTo }): boolean {
  return c.applies_to === "dish" || c.applies_to === "both";
}

export function categoryAppliesToInventory(c: { applies_to: CategoryAppliesTo }): boolean {
  return c.applies_to === "inventory" || c.applies_to === "both";
}

/** Liste plate, triée parent puis ordre puis nom. */
export async function listRestaurantCategories(
  restaurantId: string
): Promise<{ data: RestaurantCategory[]; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_categories")
    .select("id, restaurant_id, parent_id, name, sort_order, applies_to")
    .eq("restaurant_id", restaurantId)
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as RestaurantCategory[], error: null };
}

export function buildCategoryTree(flat: RestaurantCategory[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();
  for (const row of flat) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const row of flat) {
    const node = byId.get(row.id)!;
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  function sortChildren(n: CategoryTreeNode) {
    n.children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "fr"));
    n.children.forEach(sortChildren);
  }
  roots.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "fr"));
  roots.forEach(sortChildren);
  return roots;
}

/** Chemin « A › B › C » pour affichage. */
export function categoryPathLabel(
  categoryId: string | null | undefined,
  flat: RestaurantCategory[]
): string | null {
  if (!categoryId) return null;
  const byId = new Map(flat.map((c) => [c.id, c]));
  const parts: string[] = [];
  let cur: RestaurantCategory | undefined = byId.get(categoryId);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    parts.unshift(cur.name.trim());
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.length ? parts.join(" › ") : null;
}

/** Dernier segment du chemin « A › B › C » (rubrique la plus précise), pour pictogrammes ou libellé court. */
export function leafSegmentFromCategoryPath(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const parts = path
    .split(/\s*›\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : null;
}

/** Options pour <select> : indentation selon la profondeur dans l’arbre complet (rubriques non assignables masquées mais enfants conservés). */
export function flattenCategoryOptionsForSelect(
  tree: CategoryTreeNode[],
  mode: "dish" | "inventory"
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (nodes: CategoryTreeNode[], depth: number) => {
    for (const n of nodes) {
      const ok = mode === "dish" ? categoryAppliesToDish(n) : categoryAppliesToInventory(n);
      if (ok) {
        const prefix = depth > 0 ? `${"—".repeat(Math.min(depth, 8))} ` : "";
        out.push({ id: n.id, label: `${prefix}${n.name}` });
      }
      walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

export async function getCategoryById(
  id: string,
  restaurantId: string
): Promise<{ data: RestaurantCategory | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_categories")
    .select("id, restaurant_id, parent_id, name, sort_order, applies_to")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as RestaurantCategory | null, error: null };
}

/** Tous les ids descendants (enfants, petits-enfants…) pour détecter les cycles. */
export function collectDescendantIds(
  rootId: string,
  flat: RestaurantCategory[]
): Set<string> {
  const childrenMap = new Map<string | null, string[]>();
  for (const c of flat) {
    const p = c.parent_id;
    if (!childrenMap.has(p)) childrenMap.set(p, []);
    childrenMap.get(p)!.push(c.id);
  }
  const out = new Set<string>();
  const stack = [...(childrenMap.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const ch of childrenMap.get(id) ?? []) stack.push(ch);
  }
  return out;
}

export type CategoryGroup<T> = {
  categoryId: string | null;
  /** Titre de section (chemin complet ou « Sans rubrique »). */
  sectionTitle: string;
  items: T[];
};

/** Regroupe les lignes par `category_id`, trie les rubriques par chemin affiché, puis les noms dans chaque groupe. */
export function groupByCategory<T extends { category_id?: string | null; name: string }>(
  items: T[],
  flatCats: RestaurantCategory[]
): CategoryGroup<T>[] {
  const map = new Map<string | null, T[]>();
  for (const item of items) {
    const cid = item.category_id ?? null;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(item);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }
  const keys = [...map.keys()];
  keys.sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const pa = categoryPathLabel(a, flatCats) ?? "";
    const pb = categoryPathLabel(b, flatCats) ?? "";
    return pa.localeCompare(pb, "fr", { sensitivity: "base" });
  });
  return keys.map((categoryId) => ({
    categoryId,
    sectionTitle: categoryId
      ? categoryPathLabel(categoryId, flatCats) ?? "—"
      : "Sans rubrique",
    items: map.get(categoryId)!,
  }));
}

/** Tous les ids sur la chaîne parent → … → catégorie assignée (pour afficher l’arbre complet). */
export function visibleCategoryIdsWithAncestors(
  flat: RestaurantCategory[],
  assignedCategoryIds: string[]
): Set<string> {
  const byId = new Map(flat.map((c) => [c.id, c]));
  const out = new Set<string>();
  for (const cid of assignedCategoryIds) {
    let cur: RestaurantCategory | undefined = byId.get(cid);
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      out.add(cur.id);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
  }
  return out;
}

export function filterCategoryTreeByIds(
  nodes: CategoryTreeNode[],
  visible: Set<string>
): CategoryTreeNode[] {
  const out: CategoryTreeNode[] = [];
  for (const n of nodes) {
    if (!visible.has(n.id)) continue;
    out.push({
      ...n,
      children: filterCategoryTreeByIds(n.children, visible),
    });
  }
  return out;
}

/** Nombre d’éléments assignés exactement à ce nœud (pas aux descendants). */
export function countDirectInMap<T>(categoryId: string, directMap: Map<string, T[]>): number {
  return (directMap.get(categoryId) ?? []).length;
}

/** Total des éléments dans ce nœud et toute la sous-arborescence. */
export function countInSubtree<T>(
  node: CategoryTreeNode,
  directMap: Map<string, T[]>
): number {
  let n = (directMap.get(node.id) ?? []).length;
  for (const ch of node.children) n += countInSubtree(ch, directMap);
  return n;
}

/** Supprime les branches sans aucun élément (direct ou dans un descendant). */
export function pruneCategoryTreeWithItems<T>(
  nodes: CategoryTreeNode[],
  directMap: Map<string, T[]>
): CategoryTreeNode[] {
  const out: CategoryTreeNode[] = [];
  for (const n of nodes) {
    const children = pruneCategoryTreeWithItems(n.children, directMap);
    const nodeWithChildren: CategoryTreeNode = { ...n, children };
    const total = countInSubtree(nodeWithChildren, directMap);
    if (total === 0) continue;
    out.push({ ...n, children });
  }
  return out;
}

export function buildDirectItemsByCategoryId<T extends { category_id?: string | null; name: string }>(
  items: T[]
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const cid = item.category_id;
    if (!cid) continue;
    if (!m.has(cid)) m.set(cid, []);
    m.get(cid)!.push(item);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }
  return m;
}
