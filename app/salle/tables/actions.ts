"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";

export type TableActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export async function addDiningTable(params: {
  restaurantId: string;
  label: string;
}): Promise<TableActionResult<{ id: string }>> {
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
