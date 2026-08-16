"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  canReparentCategory,
  filterTopLevelSelectedIds,
  getCategoryById,
  inferGroupAppliesTo,
  inferGroupParentId,
  listRestaurantCategories,
  type CategoryAppliesTo,
} from "@/lib/catalog/restaurantCategories";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const APPLIES: CategoryAppliesTo[] = ["dish", "inventory", "both"];

function isAppliesTo(x: string): x is CategoryAppliesTo {
  return APPLIES.includes(x as CategoryAppliesTo);
}

/**
 * Vérifie que l'utilisateur connecté a le droit d'agir sur ce restaurant (propriétaire
 * ou personnel autorisé). Sans ce garde-fou, un `restaurantId` fourni par le client
 * permettrait de créer/renommer/supprimer les rubriques de n'importe quel établissement (IDOR).
 */
async function gateCategories(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantAction(user.id, restaurantId, "dishes.mutate");
}

export async function createRestaurantCategory(params: {
  restaurantId: string;
  parentId: string | null;
  name: string;
  appliesTo: CategoryAppliesTo;
}): Promise<ActionResult<{ id: string }>> {
  const { restaurantId, parentId, name, appliesTo } = params;
  const authz = await gateCategories(restaurantId);
  if (!authz.ok) return authz;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nom requis." };
  if (!isAppliesTo(appliesTo)) return { ok: false, error: "Portée invalide." };

  if (parentId) {
    const p = await getCategoryById(parentId, restaurantId);
    if (p.error || !p.data) return { ok: false, error: "Rubrique parente introuvable." };
  }

  const { data, error } = await supabaseServer
    .from("restaurant_categories")
    .insert({
      restaurant_id: restaurantId,
      parent_id: parentId,
      name: trimmed,
      applies_to: appliesTo,
      sort_order: 0,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  const id = (data as { id: string }).id;
  revalidateCategories();
  return { ok: true, data: { id } };
}

export async function renameRestaurantCategory(params: {
  restaurantId: string;
  categoryId: string;
  name: string;
}): Promise<ActionResult> {
  const { restaurantId, categoryId, name } = params;
  const authz = await gateCategories(restaurantId);
  if (!authz.ok) return authz;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nom requis." };

  const { error } = await supabaseServer
    .from("restaurant_categories")
    .update({ name: trimmed })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidateCategories();
  return { ok: true };
}

export async function updateRestaurantCategoryAppliesTo(params: {
  restaurantId: string;
  categoryId: string;
  appliesTo: CategoryAppliesTo;
}): Promise<ActionResult> {
  const { restaurantId, categoryId, appliesTo } = params;
  const authz = await gateCategories(restaurantId);
  if (!authz.ok) return authz;
  if (!isAppliesTo(appliesTo)) return { ok: false, error: "Portée invalide." };

  const { error } = await supabaseServer
    .from("restaurant_categories")
    .update({ applies_to: appliesTo })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidateCategories();
  return { ok: true };
}

export async function deleteRestaurantCategory(params: {
  restaurantId: string;
  categoryId: string;
}): Promise<ActionResult> {
  const { restaurantId, categoryId } = params;
  const authz = await gateCategories(restaurantId);
  if (!authz.ok) return authz;

  const { error } = await supabaseServer
    .from("restaurant_categories")
    .delete()
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidateCategories();
  return { ok: true };
}

/** Crée une rubrique parente et y déplace les rubriques sélectionnées (sous-rubriques). */
export async function groupRestaurantCategoriesUnderNewParent(params: {
  restaurantId: string;
  categoryIds: string[];
  name: string;
  appliesTo?: CategoryAppliesTo;
}): Promise<ActionResult<{ id: string }>> {
  const { restaurantId, categoryIds, name, appliesTo: appliesToParam } = params;
  const authz = await gateCategories(restaurantId);
  if (!authz.ok) return authz;

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nom requis." };

  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length < 2) {
    return { ok: false, error: "Sélectionnez au moins deux rubriques à regrouper." };
  }

  const { data: flat, error: listError } = await listRestaurantCategories(restaurantId);
  if (listError) return { ok: false, error: listError.message };

  const byId = new Map(flat.map((c) => [c.id, c]));
  const selected = uniqueIds.map((id) => byId.get(id)).filter(Boolean) as typeof flat;
  if (selected.length !== uniqueIds.length) {
    return { ok: false, error: "Une ou plusieurs rubriques sont introuvables." };
  }

  const toReparent = filterTopLevelSelectedIds(uniqueIds, flat);
  if (toReparent.length < 2) {
    return {
      ok: false,
      error: "Sélectionnez au moins deux rubriques distinctes (pas une rubrique et sa sous-rubrique).",
    };
  }

  const reparentRows = toReparent.map((id) => byId.get(id)!);
  const newParentId = inferGroupParentId(reparentRows);
  const appliesTo = appliesToParam ?? inferGroupAppliesTo(reparentRows);
  if (!isAppliesTo(appliesTo)) return { ok: false, error: "Portée invalide." };

  if (newParentId) {
    const parentRow = byId.get(newParentId);
    if (!parentRow) return { ok: false, error: "Rubrique parente introuvable." };
  }

  const { data: created, error: createError } = await supabaseServer
    .from("restaurant_categories")
    .insert({
      restaurant_id: restaurantId,
      parent_id: newParentId,
      name: trimmed,
      applies_to: appliesTo,
      sort_order: 0,
    })
    .select("id")
    .single();

  if (createError) return { ok: false, error: createError.message };
  const groupId = (created as { id: string }).id;

  const { error: updateError } = await supabaseServer
    .from("restaurant_categories")
    .update({ parent_id: groupId })
    .in("id", toReparent)
    .eq("restaurant_id", restaurantId);

  if (updateError) {
    await supabaseServer.from("restaurant_categories").delete().eq("id", groupId);
    return { ok: false, error: updateError.message };
  }

  revalidateCategories();
  return { ok: true, data: { id: groupId } };
}

/** Déplace une rubrique sous une autre (ou à la racine si parentId null). */
export async function reparentRestaurantCategory(params: {
  restaurantId: string;
  categoryId: string;
  newParentId: string | null;
}): Promise<ActionResult> {
  const { restaurantId, categoryId, newParentId } = params;
  const authz = await gateCategories(restaurantId);
  if (!authz.ok) return authz;

  const { data: flat, error: listError } = await listRestaurantCategories(restaurantId);
  if (listError) return { ok: false, error: listError.message };

  const check = canReparentCategory(categoryId, newParentId, flat);
  if (!check.ok) return { ok: false, error: check.reason };

  if (newParentId) {
    const parent = await getCategoryById(newParentId, restaurantId);
    if (parent.error || !parent.data) return { ok: false, error: "Rubrique cible introuvable." };
  }

  const { error } = await supabaseServer
    .from("restaurant_categories")
    .update({ parent_id: newParentId })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidateCategories();
  return { ok: true };
}

function revalidateCategories() {
  revalidatePath("/account");
  revalidatePath("/dishes");
  revalidatePath("/inventory");
}

/** Vérifie qu’une catégorie peut être liée à un plat ou un composant (même restaurant + portée). */
export async function assertCategoryAssignable(
  categoryId: string | null,
  restaurantId: string,
  mode: "dish" | "inventory"
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!categoryId) return { ok: true };
  const row = await getCategoryById(categoryId, restaurantId);
  if (row.error || !row.data) return { ok: false, error: "Rubrique introuvable." };
  const c = row.data;
  if (mode === "dish" && c.applies_to === "inventory") {
    return { ok: false, error: "Cette rubrique est réservée au stock." };
  }
  if (mode === "inventory" && c.applies_to === "dish") {
    return { ok: false, error: "Cette rubrique est réservée à la carte." };
  }
  return { ok: true };
}
