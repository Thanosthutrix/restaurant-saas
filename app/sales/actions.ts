"use server";

import { revalidatePath } from "next/cache";
import {
  recordTicketImportWithLinesAndSales,
  createSalesFromMatchedLines,
  type TicketImportLineInput,
} from "@/lib/sales";

export type RecordSalesResult =
  | { ok: true; ticket_import_id: string }
  | { ok: false; error: string };

/**
 * Enregistre un ticket dans le socle ventes (ticket_imports + lignes + sales).
 * À appeler après analyse et matching des lignes.
 *
 * @param payload restaurant_id, service_date, service_type, optionnellement image_url et champs d'analyse
 * @param lines lignes du ticket : raw_label, qty, dish_id (si matché). Les lignes sans dish_id ne créent pas de vente.
 */
export async function recordSales(
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
  lines: { raw_label: string; qty: number; dish_id?: string | null }[]
): Promise<RecordSalesResult> {
  if (!payload.restaurant_id) {
    return { ok: false, error: "restaurant_id requis." };
  }

  const lineInputs: TicketImportLineInput[] = lines.map((line, index) => ({
    line_index: index,
    raw_label: line.raw_label,
    qty: line.qty,
    dish_id: line.dish_id ?? null,
  }));

  const { data, error } = await recordTicketImportWithLinesAndSales(payload, lineInputs);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Aucune donnée retournée." };
  }

  revalidatePath("/sales");
  revalidatePath("/service/[id]", "page");
  return { ok: true, ticket_import_id: data.ticket_import_id };
}

export type SyncSalesResult = { ok: true } | { ok: false; error: string };

/**
 * Crée ou met à jour les ventes d'un ticket importé à partir des lignes matchées (ticket_import_lines avec dish_id).
 * À appeler depuis la page de contrôle pour "Enregistrer les ventes".
 */
export async function syncSalesForTicketImport(
  ticketImportId: string,
  restaurantId: string
): Promise<SyncSalesResult> {
  const { error } = await createSalesFromMatchedLines(ticketImportId, restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ticket-import/[id]", "page");
  revalidatePath("/sales");
  return { ok: true };
}
