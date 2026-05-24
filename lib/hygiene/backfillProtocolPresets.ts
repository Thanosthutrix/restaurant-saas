import { supabaseServer } from "@/lib/supabaseServer";
import { getHygieneProtocolPreset } from "@/lib/hygiene/protocolPresets";
import { HYGIENE_ELEMENT_CATEGORIES, type HygieneElementCategory } from "@/lib/hygiene/types";

function isValidCategory(cat: string): cat is HygieneElementCategory {
  return (HYGIENE_ELEMENT_CATEGORIES as readonly string[]).includes(cat);
}

/** Applique les protocoles types à tous les éléments hygiène existants (par catégorie). */
export async function backfillHygieneProtocolPresets(options?: {
  restaurantId?: string;
}): Promise<{ ok: true; updated: number; total: number } | { ok: false; error: string }> {
  let query = supabaseServer.from("hygiene_elements").select("id, category");
  if (options?.restaurantId) {
    query = query.eq("restaurant_id", options.restaurantId);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, updated: 0, total: 0 };

  let updated = 0;
  for (const row of data) {
    const cat = String(row.category);
    if (!isValidCategory(cat)) continue;

    const preset = getHygieneProtocolPreset(cat);
    const { error: upErr } = await supabaseServer
      .from("hygiene_elements")
      .update({
        description: preset.description,
        cleaning_protocol: preset.cleaning_protocol,
        disinfection_protocol: preset.disinfection_protocol,
        product_used: preset.product_used,
        dosage: preset.dosage,
        contact_time: preset.contact_time,
        risk_level: preset.suggested_risk_level,
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(row.id));

    if (!upErr) updated++;
  }

  return { ok: true, updated, total: data.length };
}
