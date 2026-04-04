/**
 * Lignes de ticket persistées : source de vérité = ticket_import_lines.
 * Un service utilise le ticket_import dont l'id = service.id (créé à la volée si besoin).
 * Lecture, mise à jour, hydratation depuis analysis_result_json, création des ventes (service_sales).
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { getService, createServiceSales } from "@/lib/db";
import type { AnalysisResultJson, Service } from "@/lib/db";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { toNumber } from "@/lib/utils/safeNumeric";

export type ServiceImportLine = {
  id: string;
  service_id: string;
  restaurant_id: string;
  line_index: number;
  raw_label: string;
  qty: number;
  dish_id: string | null;
  ignored: boolean;
  created_at: string;
};

export type ServiceImportLineWithDish = ServiceImportLine & {
  normalized_label: string;
  dish?: { name: string } | null;
};

/**
 * Parse les items depuis analysis_result_json.
 * Accepte : json string ou objet ; items = tableau ; name string (trim) ; qty number ou string numérique.
 * Exclut les lignes invalides (pas de name, qty non numérique ou <= 0).
 */
function parseAnalysisItems(json: string | AnalysisResultJson | null): { name: string; qty: number }[] {
  if (json == null) return [];
  let parsed: { items?: unknown[] } | null = null;
  if (typeof json === "string") {
    try {
      parsed = JSON.parse(json) as { items?: unknown[] };
    } catch {
      return [];
    }
  } else {
    parsed = json as { items?: unknown[] };
  }
  if (!parsed || !Array.isArray(parsed.items)) return [];
  const result: { name: string; qty: number }[] = [];
  for (const x of parsed.items) {
    if (!x || typeof x !== "object") continue;
    const name = typeof (x as { name?: unknown }).name === "string" ? String((x as { name: string }).name).trim() : "";
    if (!name) continue;
    const qtyRaw = (x as { qty?: unknown }).qty;
    const qty = toNumber(qtyRaw);
    if (qty <= 0) continue;
    result.push({ name, qty });
  }
  return result;
}

/**
 * Assure qu'un enregistrement ticket_imports existe pour ce service (id = service.id).
 * Permet d'utiliser ticket_import_lines avec ticket_import_id = service.id.
 * Colonnes ticket_imports : id, restaurant_id, imported_at, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version.
 */
async function ensureTicketImportForService(service: Service): Promise<{ error: Error | null }> {
  const row = {
    id: service.id,
    restaurant_id: service.restaurant_id,
    imported_at: new Date().toISOString(),
    service_date: service.service_date,
    service_type: service.service_type,
    image_url: service.image_url,
    analysis_status: service.analysis_status,
    analysis_result_json: service.analysis_result_json,
    analysis_error: service.analysis_error,
    analysis_version: service.analysis_version,
  };
  const { error } = await supabaseServer.from("ticket_imports").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("[ensureTicketImportForService] Supabase error:", JSON.stringify(error));
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/**
 * Récupère les lignes d'un service depuis ticket_import_lines (ticket_import_id = serviceId), triées par line_index.
 * Colonnes ticket_import_lines : id, ticket_import_id, restaurant_id, line_index, raw_label, qty, dish_id, ignored, created_at.
 */
export async function getServiceImportLines(
  serviceId: string
): Promise<{ data: ServiceImportLine[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("ticket_import_lines")
    .select("id, ticket_import_id, restaurant_id, line_index, raw_label, qty, dish_id, ignored, created_at")
    .eq("ticket_import_id", serviceId)
    .order("line_index");

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []) as (Omit<ServiceImportLine, "qty" | "service_id"> & { ticket_import_id: string; qty: unknown; ignored?: boolean })[];
  const normalized = rows.map((r) => ({
    ...r,
    service_id: r.ticket_import_id,
    qty: toNumber(r.qty),
    ignored: r.ignored ?? false,
  })) as ServiceImportLine[];
  return { data: normalized, error: null };
}

/** Met à jour une ligne (qty, dish_id, ignored) dans ticket_import_lines. */
export async function updateServiceImportLine(
  lineId: string,
  restaurantId: string,
  payload: { qty?: number; dish_id?: string | null; ignored?: boolean }
): Promise<{ error: Error | null }> {
  return updateServiceImportLines([lineId], restaurantId, payload);
}

/** Met à jour plusieurs lignes (même payload) ; utilisé pour les groupes affichés. */
export async function updateServiceImportLines(
  lineIds: string[],
  restaurantId: string,
  payload: { qty?: number; dish_id?: string | null; ignored?: boolean }
): Promise<{ error: Error | null }> {
  if (lineIds.length === 0) return { error: null };
  const updates: Record<string, unknown> = {};
  if (payload.qty !== undefined) {
    const qty = Number(payload.qty);
    if (!Number.isFinite(qty) || qty <= 0) return { error: new Error("La quantité doit être strictement positive.") };
    updates.qty = qty;
  }
  if (payload.dish_id !== undefined) updates.dish_id = payload.dish_id ?? null;
  if (payload.ignored !== undefined) updates.ignored = payload.ignored;
  if (Object.keys(updates).length === 0) return { error: null };

  const { error } = await supabaseServer
    .from("ticket_import_lines")
    .update(updates)
    .in("id", lineIds)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Ajoute une ligne manuelle dans ticket_import_lines (ticket_import_id = serviceId). */
export async function addServiceImportLine(
  serviceId: string,
  restaurantId: string,
  payload: { raw_label: string; qty: number; dish_id?: string | null }
): Promise<{ data: ServiceImportLine | null; error: Error | null }> {
  const raw_label = payload.raw_label?.trim() ?? "";
  const qty = Number(payload.qty);
  if (!raw_label) return { data: null, error: new Error("Le libellé est requis.") };
  if (!Number.isFinite(qty) || qty <= 0) return { data: null, error: new Error("La quantité doit être strictement positive.") };

  const { data: existing } = await supabaseServer
    .from("ticket_import_lines")
    .select("line_index")
    .eq("ticket_import_id", serviceId)
    .order("line_index", { ascending: false })
    .limit(1);

  const maxIndex = (existing ?? []).length > 0 ? ((existing as { line_index: number }[])[0].line_index + 1) : 0;

  const { data, error } = await supabaseServer
    .from("ticket_import_lines")
    .insert({
      ticket_import_id: serviceId,
      restaurant_id: restaurantId,
      line_index: maxIndex,
      raw_label,
      qty,
      dish_id: payload.dish_id ?? null,
      ignored: false,
    })
    .select("id, ticket_import_id, restaurant_id, line_index, raw_label, qty, dish_id, ignored, created_at")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  const row = data as Omit<ServiceImportLine, "qty" | "service_id"> & { ticket_import_id: string; qty: unknown };
  return { data: { ...row, service_id: row.ticket_import_id, qty: toNumber(row.qty) } as ServiceImportLine, error: null };
}

/**
 * Remplit ticket_import_lines à partir de analysis_result_json.
 * Idempotent : si des lignes existent déjà on ne fait rien ; avant insert on supprime les lignes existantes
 * pour ce ticket afin d'éviter les doublons en cas de requêtes concurrentes.
 * Contrainte unique (ticket_import_id, line_index) en base empêche les doublons ; en cas de conflit
 * (autre requête a déjà inséré) on considère succès.
 */
export async function hydrateServiceImportLinesFromJson(
  serviceId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  const { data: existing, error: existingError } = await getServiceImportLines(serviceId);
  if (existingError) return { error: existingError };
  if ((existing ?? []).length > 0) return { error: null };

  const { data: service, error: serviceError } = await getService(serviceId);
  if (serviceError || !service) return { error: serviceError ?? new Error("Service introuvable.") };

  const ensureErr = await ensureTicketImportForService(service);
  if (ensureErr.error) return ensureErr;

  const items = parseAnalysisItems(service.analysis_result_json);
  if (items.length === 0) return { error: null };

  const rows = items.map((item, i) => ({
    ticket_import_id: serviceId,
    restaurant_id: restaurantId,
    line_index: i,
    raw_label: item.name,
    qty: item.qty,
    dish_id: null,
    ignored: false,
  }));

  const { error: deleteError } = await supabaseServer
    .from("ticket_import_lines")
    .delete()
    .eq("ticket_import_id", serviceId);
  if (deleteError) return { error: new Error(deleteError.message) };

  const { data: insertData, error: insertError } = await supabaseServer
    .from("ticket_import_lines")
    .insert(rows)
    .select("id");
  if (insertError) {
    if (insertError.code === "23505") return { error: null };
    return { error: new Error(insertError.message) };
  }
  return { error: null };
}

/**
 * Crée ou remplace les ventes du service (service_sales) à partir des lignes ticket_import_lines
 * (dish_id renseigné et non ignorées). ticket_import_id = serviceId.
 */
export async function createServiceSalesFromImportLines(
  serviceId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  const { data: lines, error: fetchError } = await supabaseServer
    .from("ticket_import_lines")
    .select("dish_id, qty")
    .eq("ticket_import_id", serviceId)
    .eq("ignored", false)
    .not("dish_id", "is", null);

  if (fetchError) return { error: new Error(fetchError.message) };

  const byDish = new Map<string, number>();
  for (const row of lines ?? []) {
    const r = row as { dish_id: string; qty: number };
    const qty = toNumber(r.qty);
    if (qty > 0) byDish.set(r.dish_id, (byDish.get(r.dish_id) ?? 0) + qty);
  }

  await supabaseServer.from("service_sales").delete().eq("service_id", serviceId);

  if (byDish.size === 0) return { error: null };

  const sales = Array.from(byDish.entries()).map(([dish_id, qty]) => ({ dish_id, qty }));
  return createServiceSales(serviceId, restaurantId, sales);
}

/**
 * Charge les lignes avec infos plat (nom) pour l'affichage révision.
 * Lit ticket_import_lines où ticket_import_id = serviceId.
 */
export async function getServiceImportLinesWithDishes(
  serviceId: string
): Promise<{ data: ServiceImportLineWithDish[] | null; error: Error | null }> {
  const { data: rawLines, error } = await getServiceImportLines(serviceId);
  if (error) return { data: null, error };
  if (!rawLines) return { data: null, error: null };

  const dishIds = [...new Set(rawLines.map((l) => l.dish_id).filter(Boolean) as string[])];
  let dishMap = new Map<string, { name: string }>();
  if (dishIds.length > 0) {
    const { data: dishes } = await supabaseServer.from("dishes").select("id, name").in("id", dishIds);
    const rows = (dishes ?? []) as { id: string; name: string }[];
    dishMap = new Map(rows.map((d) => [d.id, { name: d.name }]));
  }

  const lines: ServiceImportLineWithDish[] = rawLines.map((line) => ({
    ...line,
    normalized_label: normalizeDishLabel(line.raw_label),
    dish: line.dish_id ? dishMap.get(line.dish_id) ?? null : null,
  }));

  return { data: lines, error: null };
}
