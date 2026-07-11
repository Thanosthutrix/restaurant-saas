"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";

export type TableActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

/**
 * Vérifie que l'utilisateur connecté a le droit d'agir sur ce restaurant (propriétaire
 * ou personnel autorisé). Sans ce garde-fou, un `restaurantId` fourni par le client
 * permettrait d'altérer les tables de n'importe quel établissement (IDOR).
 */
async function gateTables(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  return assertRestaurantAction(user.id, restaurantId, "reservations.mutate");
}

export async function addDiningTable(params: {
  restaurantId: string;
  label: string;
}): Promise<TableActionResult<{ id: string }>> {
  const authz = await gateTables(params.restaurantId);
  if (!authz.ok) return authz;

  const label = normalizeLabel(params.label);
  if (!label) return { ok: false, error: "Indiquez un libellé pour la table." };
  if (label.length > 80) return { ok: false, error: "Libellé trop long (max. 80 caractères)." };

  const { data: maxRow } = await supabaseServer
    .from("dining_tables")
    .select("sort_order")
    .eq("restaurant_id", params.restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder =
    maxRow && typeof (maxRow as { sort_order: unknown }).sort_order === "number"
      ? (maxRow as { sort_order: number }).sort_order + 1
      : 0;

  const { data, error } = await supabaseServer
    .from("dining_tables")
    .insert({
      restaurant_id: params.restaurantId,
      label,
      sort_order: nextOrder,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Une table avec ce libellé existe déjà." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/salle");
  revalidatePath("/salle/tables");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateDiningTableLabel(params: {
  restaurantId: string;
  tableId: string;
  label: string;
}): Promise<TableActionResult> {
  const authz = await gateTables(params.restaurantId);
  if (!authz.ok) return authz;

  const label = normalizeLabel(params.label);
  if (!label) return { ok: false, error: "Indiquez un libellé pour la table." };
  if (label.length > 80) return { ok: false, error: "Libellé trop long (max. 80 caractères)." };

  const { error } = await supabaseServer
    .from("dining_tables")
    .update({ label })
    .eq("id", params.tableId)
    .eq("restaurant_id", params.restaurantId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Une table avec ce libellé existe déjà." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/salle");
  revalidatePath("/salle/tables");
  return { ok: true };
}

export async function setDiningTableActive(params: {
  restaurantId: string;
  tableId: string;
  isActive: boolean;
}): Promise<TableActionResult> {
  const authz = await gateTables(params.restaurantId);
  if (!authz.ok) return authz;

  const { error } = await supabaseServer
    .from("dining_tables")
    .update({ is_active: params.isActive })
    .eq("id", params.tableId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/salle");
  revalidatePath("/salle/tables");
  return { ok: true };
}
