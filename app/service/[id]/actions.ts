"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getService,
  getServiceSalesWithDishes,
  updateServiceAnalysis,
  createServiceSales,
  createDish,
  createDishAlias,
  deleteService,
} from "@/lib/db";
import { getCurrentRestaurant } from "@/lib/auth";
import { computeSalesConsumption } from "@/lib/recipes/computeSalesConsumption";
import { revertConsumptionFromStock } from "@/lib/recipes/applyConsumptionToStock";
import {
  updateServiceImportLine,
  updateServiceImportLines,
  addServiceImportLine,
  createServiceSalesFromImportLines,
} from "@/lib/serviceLines";
import { normalizeDishLabel, ALIAS_FORBIDDEN_NORMALIZED } from "@/lib/normalizeDishLabel";
import { supabaseServer } from "@/lib/supabaseServer";

export type ResolveResult = { ok: true } | { ok: false; error: string };

/** Associe une ligne inconnue à un plat existant : alias si besoin + vente. Pas d'alias si normalized interdit. */
export async function resolveUnknownLineToExistingDish(params: {
  serviceId: string;
  restaurantId: string;
  rawLabel: string;
  qty: number;
  dishId: string;
}): Promise<ResolveResult> {
  const { serviceId, restaurantId, rawLabel, qty, dishId } = params;
  if (!serviceId || !restaurantId || !rawLabel.trim() || qty < 1 || !dishId) {
    return { ok: false, error: "Paramètres manquants ou invalides." };
  }

  const normalizedLabel = normalizeDishLabel(rawLabel);

  const { data: existingAlias } = await supabaseServer
    .from("dish_aliases")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("alias_normalized", normalizedLabel)
    .maybeSingle();

  if (!existingAlias && normalizedLabel && !ALIAS_FORBIDDEN_NORMALIZED.has(normalizedLabel)) {
    const { error: aliasError } = await createDishAlias(restaurantId, dishId, rawLabel.trim());
    if (aliasError) return { ok: false, error: aliasError.message };
  }

  const { error: salesError } = await createServiceSales(serviceId, restaurantId, [
    { dish_id: dishId, qty },
  ]);
  if (salesError) return { ok: false, error: salesError.message };

  revalidatePath(`/service/${serviceId}`);
  return { ok: true };
}

/** Crée un nouveau plat, alias (si pas interdit), et une vente. */
export async function resolveUnknownLineToNewDish(params: {
  serviceId: string;
  restaurantId: string;
  rawLabel: string;
  qty: number;
  newDishName: string;
}): Promise<ResolveResult> {
  const { serviceId, restaurantId, rawLabel, qty, newDishName } = params;
  if (!serviceId || !restaurantId || !rawLabel.trim() || qty < 1 || !newDishName.trim()) {
    return { ok: false, error: "Paramètres manquants ou invalides." };
  }

  const { data: dish, error: dishError } = await createDish(restaurantId, newDishName.trim());
  if (dishError || !dish) return { ok: false, error: dishError?.message ?? "Création plat impossible." };

  const normalizedLabel = normalizeDishLabel(rawLabel);
  if (normalizedLabel && !ALIAS_FORBIDDEN_NORMALIZED.has(normalizedLabel)) {
    await createDishAlias(restaurantId, dish.id, rawLabel.trim());
  }

  const { error: salesError } = await createServiceSales(serviceId, restaurantId, [
    { dish_id: dish.id, qty },
  ]);
  if (salesError) return { ok: false, error: salesError.message };

  revalidatePath(`/service/${serviceId}`);
  return { ok: true };
}

/** Enregistre la ligne comme ignorée dans analysis_result_json et masque en UI. */
export async function ignoreUnknownLine(params: {
  serviceId: string;
  rawLabel: string;
  qty: number;
}): Promise<ResolveResult> {
  const { serviceId, rawLabel, qty } = params;
  if (!serviceId || !rawLabel.trim()) return { ok: false, error: "Paramètres manquants." };

  const { data: service, error: fetchError } = await getService(serviceId);
  if (fetchError || !service) return { ok: false, error: fetchError?.message ?? "Service introuvable." };

  const raw = service.analysis_result_json;
  const current: { items: { name: string; qty: number }[]; ignored?: { rawLabel: string; qty: number }[] } =
    raw == null
      ? { items: [] }
      : typeof raw === "string"
        ? (() => {
            try {
              return JSON.parse(raw) as { items: { name: string; qty: number }[]; ignored?: { rawLabel: string; qty: number }[] };
            } catch {
              return { items: [] };
            }
          })()
        : { items: (raw as { items?: { name: string; qty: number }[] }).items ?? [], ignored: (raw as { ignored?: { rawLabel: string; qty: number }[] }).ignored };

  const ignored = current.ignored ?? [];
  if (!ignored.some((i) => i.rawLabel === rawLabel.trim() && i.qty === qty)) {
    ignored.push({ rawLabel: rawLabel.trim(), qty });
  }

  const update: Parameters<typeof updateServiceAnalysis>[1] = {
    analysis_status: (service as { analysis_status?: string }).analysis_status ?? "done",
    analysis_result_json: { ...current, ignored },
    analysis_error: null,
    analysis_version: (service as { analysis_version?: string }).analysis_version ?? null,
  };

  const { error: updateError } = await updateServiceAnalysis(serviceId, update);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath(`/service/${serviceId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Révision basée sur service_import_lines (lignes persistées)
// ---------------------------------------------------------------------------

export type ServiceLineActionResult = { ok: true } | { ok: false; error: string };

export async function updateServiceLine(
  lineId: string,
  restaurantId: string,
  payload: { qty?: number; dish_id?: string | null; ignored?: boolean }
): Promise<ServiceLineActionResult> {
  const { error } = await updateServiceImportLine(lineId, restaurantId, payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/service/[id]`, "page");
  return { ok: true };
}

/** Met à jour plusieurs lignes (ex. groupe affiché). */
export async function updateServiceLines(
  lineIds: string[],
  restaurantId: string,
  payload: { qty?: number; dish_id?: string | null; ignored?: boolean }
): Promise<ServiceLineActionResult> {
  if (lineIds.length === 0) return { ok: true };
  const { error } = await updateServiceImportLines(lineIds, restaurantId, payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/service/[id]`, "page");
  return { ok: true };
}

export async function addServiceLine(
  serviceId: string,
  restaurantId: string,
  payload: { raw_label: string; qty: number; dish_id?: string | null }
): Promise<ServiceLineActionResult> {
  const { error } = await addServiceImportLine(serviceId, restaurantId, payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/service/[id]`, "page");
  return { ok: true };
}

export async function associateServiceLineToDish(
  lineId: string,
  restaurantId: string,
  dishId: string
): Promise<ServiceLineActionResult> {
  return updateServiceLine(lineId, restaurantId, { dish_id: dishId, ignored: false });
}

/** Associe plusieurs lignes (groupe) à un plat. */
export async function associateServiceLinesToDish(
  lineIds: string[],
  restaurantId: string,
  dishId: string
): Promise<ServiceLineActionResult> {
  return updateServiceLines(lineIds, restaurantId, { dish_id: dishId, ignored: false });
}

export async function ignoreServiceLine(lineId: string, restaurantId: string): Promise<ServiceLineActionResult> {
  return updateServiceLine(lineId, restaurantId, { ignored: true });
}

/** Ignore toutes les lignes du groupe. */
export async function ignoreServiceLines(lineIds: string[], restaurantId: string): Promise<ServiceLineActionResult> {
  return updateServiceLines(lineIds, restaurantId, { ignored: true });
}

export async function unignoreServiceLine(lineId: string, restaurantId: string): Promise<ServiceLineActionResult> {
  return updateServiceLine(lineId, restaurantId, { ignored: false });
}

/** Réactive toutes les lignes du groupe. */
export async function unignoreServiceLines(lineIds: string[], restaurantId: string): Promise<ServiceLineActionResult> {
  return updateServiceLines(lineIds, restaurantId, { ignored: false });
}

export async function createDishAndAssociateServiceLine(
  restaurantId: string,
  lineId: string,
  dishName: string
): Promise<ServiceLineActionResult> {
  const { data: dish, error: dishError } = await createDish(restaurantId, dishName.trim());
  if (dishError || !dish) return { ok: false, error: dishError?.message ?? "Impossible de créer le plat." };
  return updateServiceLine(lineId, restaurantId, { dish_id: dish.id, ignored: false });
}

/** Crée un plat et associe toutes les lignes du groupe. */
export async function createDishAndAssociateServiceLines(
  restaurantId: string,
  lineIds: string[],
  dishName: string
): Promise<ServiceLineActionResult> {
  const { data: dish, error: dishError } = await createDish(restaurantId, dishName.trim());
  if (dishError || !dish) return { ok: false, error: dishError?.message ?? "Impossible de créer le plat." };
  return updateServiceLines(lineIds, restaurantId, { dish_id: dish.id, ignored: false });
}

/** Valide et enregistre les ventes à partir des lignes, puis redirige vers la page état théorique. */
export async function validateAndSaveServiceSales(
  serviceId: string,
  restaurantId: string
): Promise<ServiceLineActionResult> {
  const { error } = await createServiceSalesFromImportLines(serviceId, restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/service/[id]`, "page");
  redirect(`/service/${serviceId}/stock`);
}

/** Supprime le service (si le restaurant courant en est propriétaire), remet le stock à jour, puis redirige vers /services. */
export async function deleteServiceAction(serviceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { ok: false, error: "Restaurant non reconnu." };

  const { data: service, error: fetchErr } = await getService(serviceId);
  if (fetchErr || !service) return { ok: false, error: fetchErr?.message ?? "Service introuvable." };
  if (service.restaurant_id !== restaurant.id) return { ok: false, error: "Ce service n'appartient pas au restaurant actif." };

  const { data: sales } = await getServiceSalesWithDishes(serviceId);
  const saleInputs = (sales ?? []).map((s) => ({ dish_id: s.dish_id, qty: s.qty }));
  if (saleInputs.length > 0) {
    const consumptionResult = await computeSalesConsumption(restaurant.id, saleInputs);
    if (consumptionResult.consumption.length > 0) {
      const revertResult = await revertConsumptionFromStock(restaurant.id, consumptionResult.consumption, {
        serviceId,
      });
      if (revertResult.error) return { ok: false, error: `Impossible de remettre le stock à jour : ${revertResult.error.message}` };
    }
  }

  const { error: deleteErr } = await deleteService(serviceId);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  revalidatePath("/services");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  redirect("/services");
}
