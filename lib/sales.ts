/**
 * Socle "ventes" : imports de tickets, lignes, ventes.
 * Types et fonctions serveur pour ticket_imports, ticket_import_lines, sales.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/** Un import de ticket (une photo, un fichier, une saisie). */
export type TicketImport = {
  id: string;
  restaurant_id: string;
  imported_at: string;
  service_date: string | null;
  service_type: string | null;
  image_url: string | null;
  analysis_status: string | null;
  analysis_result_json: unknown;
  analysis_error: string | null;
  analysis_version: string | null;
};

/** Une ligne du ticket : texte brut, quantité, plat matché si reconnu, ignorée ou non. */
export type TicketImportLine = {
  id: string;
  ticket_import_id: string;
  restaurant_id: string;
  line_index: number;
  raw_label: string;
  qty: number;
  dish_id: string | null;
  ignored: boolean;
  created_at: string;
};

/** Une vente : un plat vendu pour un ticket donné (qté = somme des lignes matchées). */
export type Sale = {
  id: string;
  ticket_import_id: string;
  restaurant_id: string;
  dish_id: string;
  qty: number;
  created_at: string;
};

/** Payload pour créer un import (champs optionnels selon le flux). */
export type CreateTicketImportPayload = {
  restaurant_id: string;
  service_date?: string | null;
  service_type?: string | null;
  image_url?: string | null;
  analysis_status?: string | null;
  analysis_result_json?: unknown;
  analysis_error?: string | null;
  analysis_version?: string | null;
};

/** Une ligne à enregistrer (avant insertion). */
export type TicketImportLineInput = {
  line_index: number;
  raw_label: string;
  qty: number;
  dish_id?: string | null;
  ignored?: boolean;
};

// ---------------------------------------------------------------------------
// FONCTIONS SERVEUR
// ---------------------------------------------------------------------------

/**
 * Sauvegarde un import de ticket et retourne l'enregistrement créé.
 * À appeler en premier ; ensuite sauvegarder les lignes puis créer les ventes.
 */
export async function saveTicketImport(
  payload: CreateTicketImportPayload
): Promise<{ data: TicketImport | null; error: Error | null }> {
  const row = {
    restaurant_id: payload.restaurant_id,
    service_date: payload.service_date ?? null,
    service_type: payload.service_type ?? null,
    image_url: payload.image_url ?? null,
    analysis_status: payload.analysis_status ?? null,
    analysis_result_json: payload.analysis_result_json ?? null,
    analysis_error: payload.analysis_error ?? null,
    analysis_version: payload.analysis_version ?? null,
  };

  const { data, error } = await supabaseServer
    .from("ticket_imports")
    .insert(row)
    .select("id, restaurant_id, imported_at, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TicketImport, error: null };
}

/**
 * Sauvegarde les lignes d'un ticket importé.
 * Chaque ligne peut avoir un dish_id (si matchée) ou null (ligne non reconnue).
 */
export async function saveTicketImportLines(
  ticketImportId: string,
  restaurantId: string,
  lines: TicketImportLineInput[]
): Promise<{ error: Error | null }> {
  if (lines.length === 0) return { error: null };

  const rows = lines.map((line) => ({
    ticket_import_id: ticketImportId,
    restaurant_id: restaurantId,
    line_index: line.line_index,
    raw_label: line.raw_label,
    qty: line.qty,
    dish_id: line.dish_id ?? null,
    ignored: line.ignored ?? false,
  }));

  const { error } = await supabaseServer.from("ticket_import_lines").insert(rows);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/**
 * Crée les ventes à partir des lignes matchées d'un ticket.
 * - Lit les ticket_import_lines où dish_id est renseigné
 * - Regroupe par dish_id (somme des quantités)
 * - Insère ou met à jour la table sales (une ligne par (ticket_import_id, dish_id))
 * Les lignes non matchées (dish_id null) ne génèrent pas de vente.
 */
export async function createSalesFromMatchedLines(
  ticketImportId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  const { data: lines, error: fetchError } = await supabaseServer
    .from("ticket_import_lines")
    .select("dish_id, qty")
    .eq("ticket_import_id", ticketImportId)
    .eq("ignored", false)
    .not("dish_id", "is", null);

  if (fetchError) return { error: new Error(fetchError.message) };

  const byDish = new Map<string, number>();
  for (const row of lines ?? []) {
    const r = row as { dish_id: string; qty: number };
    const qty = Number(r.qty);
    if (qty > 0) byDish.set(r.dish_id, (byDish.get(r.dish_id) ?? 0) + qty);
  }

  if (byDish.size === 0) return { error: null };

  const rows = Array.from(byDish.entries()).map(([dish_id, qty]) => ({
    ticket_import_id: ticketImportId,
    restaurant_id: restaurantId,
    dish_id,
    qty,
  }));

  const { error: insertError } = await supabaseServer
    .from("sales")
    .upsert(rows, { onConflict: "ticket_import_id,dish_id" });

  if (insertError) return { error: new Error(insertError.message) };
  return { error: null };
}

/**
 * Liste les imports récents d'un restaurant (pour la page /sales).
 */
export async function getTicketImports(
  restaurantId: string,
  limit = 50
): Promise<{ data: TicketImport[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("ticket_imports")
    .select("id, restaurant_id, imported_at, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version")
    .eq("restaurant_id", restaurantId)
    .order("imported_at", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as TicketImport[], error: null };
}

/**
 * Récupère un import par id.
 */
export async function getTicketImport(
  ticketImportId: string
): Promise<{ data: TicketImport | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("ticket_imports")
    .select("id, restaurant_id, imported_at, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version")
    .eq("id", ticketImportId)
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TicketImport, error: null };
}

/**
 * Récupère les lignes d'un import.
 */
export async function getTicketImportLines(
  ticketImportId: string
): Promise<{ data: TicketImportLine[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("ticket_import_lines")
    .select("id, ticket_import_id, restaurant_id, line_index, raw_label, qty, dish_id, ignored, created_at")
    .eq("ticket_import_id", ticketImportId)
    .order("line_index");

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []) as (Omit<TicketImportLine, "qty"> & { qty: unknown; ignored?: boolean })[];
  const normalized = rows.map((r) => ({ ...r, qty: Number(r.qty), ignored: r.ignored ?? false })) as TicketImportLine[];
  return { data: normalized, error: null };
}

/**
 * Met à jour une ligne de ticket (quantité, plat associé, statut ignorée).
 */
export async function updateTicketImportLine(
  lineId: string,
  restaurantId: string,
  payload: { qty?: number; dish_id?: string | null; ignored?: boolean }
): Promise<{ error: Error | null }> {
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
    .eq("id", lineId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/**
 * Ajoute une ligne manuelle à un ticket importé (en fin de liste).
 */
export async function addTicketImportLine(
  ticketImportId: string,
  restaurantId: string,
  payload: { raw_label: string; qty: number; dish_id?: string | null }
): Promise<{ data: TicketImportLine | null; error: Error | null }> {
  const raw_label = payload.raw_label?.trim() ?? "";
  const qty = Number(payload.qty);
  if (!raw_label) return { data: null, error: new Error("Le libellé est requis.") };
  if (!Number.isFinite(qty) || qty <= 0) return { data: null, error: new Error("La quantité doit être strictement positive.") };

  const { data: existing } = await supabaseServer
    .from("ticket_import_lines")
    .select("line_index")
    .eq("ticket_import_id", ticketImportId)
    .order("line_index", { ascending: false })
    .limit(1);

  const maxIndex = (existing ?? []).length > 0 ? ((existing as { line_index: number }[])[0].line_index + 1) : 0;

  const { data, error } = await supabaseServer
    .from("ticket_import_lines")
    .insert({
      ticket_import_id: ticketImportId,
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
  const row = data as Omit<TicketImportLine, "qty"> & { qty: unknown };
  return { data: { ...row, qty: Number(row.qty) } as TicketImportLine, error: null };
}

/**
 * Enregistre un import complet : ticket_import + lignes + ventes.
 * À utiliser pour "enregistrer ce ticket" après analyse et matching.
 * 1) Crée l'entrée ticket_imports
 * 2) Insère les lignes (avec ou sans dish_id)
 * 3) Crée les ventes en regroupant les lignes matchées par plat
 */
export async function recordTicketImportWithLinesAndSales(
  payload: {
    restaurant_id: string;
    service_date?: string | null;
    service_type?: string | null;
    image_url?: string | null;
    analysis_status?: string | null;
    analysis_result_json?: unknown;
    analysis_error?: string | null;
    analysis_version?: string | null;
  },
  lines: TicketImportLineInput[]
): Promise<{ data: { ticket_import_id: string } | null; error: Error | null }> {
  const importRes = await saveTicketImport(payload);
  if (importRes.error || !importRes.data) return { data: null, error: importRes.error ?? new Error("Création de l'import impossible") };

  const ticketImportId = importRes.data.id;
  const saveLinesError = await saveTicketImportLines(ticketImportId, payload.restaurant_id, lines);
  if (saveLinesError.error) return { data: null, error: saveLinesError.error };

  const salesError = await createSalesFromMatchedLines(ticketImportId, payload.restaurant_id);
  if (salesError.error) return { data: null, error: salesError.error };

  return { data: { ticket_import_id: ticketImportId }, error: null };
}

/**
 * Récupère les ventes d'un import (avec nom du plat si besoin).
 */
export async function getSalesForTicketImport(
  ticketImportId: string
): Promise<{ data: (Sale & { dishes?: { name: string } | null })[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("sales")
    .select("id, ticket_import_id, restaurant_id, dish_id, qty, created_at, dishes(name)")
    .eq("ticket_import_id", ticketImportId);

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []) as unknown as (Sale & { dishes?: { name: string } | null })[];
  return { data: rows, error: null };
}

// ---------------------------------------------------------------------------
// PAGE DE CONTRÔLE TICKET IMPORT
// ---------------------------------------------------------------------------

/** Plat associé à une ligne (nom + statut recette). */
export type LineDishInfo = {
  name: string;
  recipe_status: string | null;
};

/** Ligne enrichie pour l'affichage (nom normalisé + infos plat si matché). */
export type TicketImportLineWithDish = TicketImportLine & {
  normalized_label: string;
  dish?: LineDishInfo | null;
};

/** Résumé pour la page de contrôle. */
export type TicketImportControlSummary = {
  total_lines: number;
  recognized_count: number;
  unrecognized_count: number;
  ignored_count: number;
  dishes_missing_count: number;
  dishes_draft_count: number;
};

export type TicketImportControlData = {
  ticketImport: TicketImport;
  lines: TicketImportLineWithDish[];
  summary: TicketImportControlSummary;
  existingSales: (Sale & { dishes?: { name: string } | null })[];
};

/**
 * Charge toutes les données nécessaires pour la page de contrôle d'un ticket importé.
 * - Import + lignes avec label normalisé et infos plat (nom, recipe_status) si matché
 * - Résumé (totaux, reconnus, non reconnus, plats missing/draft)
 * - Ventes déjà enregistrées pour ce ticket
 */
export async function getTicketImportForControlPage(
  ticketImportId: string,
  restaurantId: string
): Promise<{ data: TicketImportControlData | null; error: Error | null }> {
  const [importRes, linesRes, salesRes] = await Promise.all([
    getTicketImport(ticketImportId),
    getTicketImportLines(ticketImportId),
    getSalesForTicketImport(ticketImportId),
  ]);

  if (importRes.error) return { data: null, error: importRes.error };
  if (!importRes.data) return { data: null, error: null };
  if (importRes.data.restaurant_id !== restaurantId) return { data: null, error: null };

  const ticketImport = importRes.data;
  const rawLines = linesRes.data ?? [];
  const existingSales = salesRes.data ?? [];

  const dishIds = [...new Set(rawLines.map((l) => l.dish_id).filter(Boolean) as string[])];
  let dishMap = new Map<string, { name: string; recipe_status: string | null }>();

  if (dishIds.length > 0) {
    const { data: dishes } = await supabaseServer
      .from("dishes")
      .select("id, name, recipe_status")
      .in("id", dishIds);
    const rows = (dishes ?? []) as { id: string; name: string; recipe_status: string | null }[];
    dishMap = new Map(rows.map((d) => [d.id, { name: d.name, recipe_status: d.recipe_status ?? null }]));
  }

  const lines: TicketImportLineWithDish[] = rawLines.map((line) => ({
    ...line,
    normalized_label: normalizeDishLabel(line.raw_label),
    dish: line.dish_id ? dishMap.get(line.dish_id) ?? null : null,
  }));

  const recognized = lines.filter((l) => l.dish_id != null && !l.ignored);
  const unrecognized = lines.filter((l) => l.dish_id == null && !l.ignored);
  const ignoredCount = lines.filter((l) => l.ignored).length;
  const dishIdsWithMissing = new Set(
    recognized.filter((l) => l.dish && l.dish.recipe_status === "missing").map((l) => l.dish_id!)
  );
  const dishIdsWithDraft = new Set(
    recognized.filter((l) => l.dish && l.dish.recipe_status === "draft").map((l) => l.dish_id!)
  );

  const summary: TicketImportControlSummary = {
    total_lines: lines.length,
    recognized_count: recognized.length,
    unrecognized_count: unrecognized.length,
    ignored_count: ignoredCount,
    dishes_missing_count: dishIdsWithMissing.size,
    dishes_draft_count: dishIdsWithDraft.size,
  };

  return {
    data: {
      ticketImport,
      lines,
      summary,
      existingSales,
    },
    error: null,
  };
}
