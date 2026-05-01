"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  HYGIENE_ELEMENT_CATEGORIES,
  HYGIENE_RECURRENCE_TYPES,
  type HygieneElementCategory,
  type HygieneRecurrenceType,
  type HygieneRiskLevel,
} from "@/lib/hygiene/types";
import type { EquipmentAreaKind } from "@/lib/equipment-inventory-analysis";

export type EquipmentApplyPayload = {
  selected: boolean;
  name: string;
  area_kind: EquipmentAreaKind;
  area_label: string;
  hygiene_category: HygieneElementCategory | null;
  quantity: number;
  create_hygiene_element: boolean;
  create_dining_table: boolean;
  notes: string | null;
  recurrence_type: HygieneRecurrenceType;
  risk_level: HygieneRiskLevel;
};

export type ApplyEquipmentResult = {
  ok: boolean;
  inventoryCreated: number;
  hygieneCreated: number;
  tablesCreated: number;
  skipped: number;
  errors: string[];
};

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 120);
}

function isAreaKind(raw: string): raw is EquipmentAreaKind {
  return ["kitchen", "dining", "bar", "storage", "sanitary", "other"].includes(raw);
}

function normalizeCategory(raw: string | null): HygieneElementCategory | null {
  if (raw && (HYGIENE_ELEMENT_CATEGORIES as readonly string[]).includes(raw)) return raw as HygieneElementCategory;
  return null;
}

function normalizeRecurrence(raw: string): HygieneRecurrenceType {
  return (HYGIENE_RECURRENCE_TYPES as readonly string[]).includes(raw) ? (raw as HygieneRecurrenceType) : "daily";
}

function normalizeRisk(raw: string): HygieneRiskLevel {
  return raw === "critical" || raw === "important" || raw === "standard" ? raw : "standard";
}

function defaultProtocol(category: HygieneElementCategory | null): string {
  if (category === "frigo" || category === "congelateur" || category === "chambre_froide") {
    return "Nettoyer les surfaces accessibles, joints et poignées. Relever la température si concerné.";
  }
  if (category === "piano_plaque" || category === "four" || category === "hotte") {
    return "Dégraisser les surfaces, retirer les résidus alimentaires, puis rincer/essuyer.";
  }
  return "Nettoyer selon le plan de nettoyage, puis contrôler visuellement.";
}

async function diningTableExists(restaurantId: string, label: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("dining_tables")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("label", label)
    .limit(1);
  return Boolean(data?.length);
}

export async function applyOnboardingEquipmentInventory(
  rows: EquipmentApplyPayload[]
): Promise<ApplyEquipmentResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const selected = rows.filter((row) => row.selected);
  if (selected.length === 0) {
    return { ok: true, inventoryCreated: 0, hygieneCreated: 0, tablesCreated: 0, skipped: 0, errors: [] };
  }

  let inventoryCreated = 0;
  let hygieneCreated = 0;
  let tablesCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of selected) {
    const name = cleanName(row.name);
    if (!name) {
      skipped++;
      continue;
    }
    const areaKind = isAreaKind(row.area_kind) ? row.area_kind : "other";
    const hygieneCategory = normalizeCategory(row.hygiene_category);
    const quantity = Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0 ? Math.round(Number(row.quantity)) : 1;

    const { error: invErr } = await supabaseServer.from("restaurant_equipment_inventory").insert({
      restaurant_id: restaurant.id,
      name,
      area_kind: areaKind,
      area_label: row.area_label.trim(),
      hygiene_category: hygieneCategory,
      quantity,
      create_hygiene_element: Boolean(row.create_hygiene_element && hygieneCategory),
      create_dining_table: Boolean(row.create_dining_table),
      notes: row.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (invErr) {
      errors.push(`${name}: inventaire impossible (${invErr.message}).`);
    } else {
      inventoryCreated++;
    }

    if (row.create_hygiene_element && hygieneCategory) {
      const { error } = await supabaseServer.from("hygiene_elements").insert({
        restaurant_id: restaurant.id,
        name,
        category: hygieneCategory,
        area_label: row.area_label.trim(),
        description: row.notes?.trim() || null,
        risk_level: normalizeRisk(row.risk_level),
        recurrence_type: normalizeRecurrence(row.recurrence_type),
        recurrence_day_of_week: null,
        recurrence_day_of_month: null,
        cleaning_protocol: defaultProtocol(hygieneCategory),
        disinfection_protocol: "Désinfecter si surface de contact alimentaire ou contact client.",
        product_used: null,
        dosage: null,
        contact_time: null,
        active: true,
      });
      if (error) errors.push(`${name}: élément hygiène impossible (${error.message}).`);
      else hygieneCreated++;
    }

    if (row.create_dining_table) {
      for (let i = 0; i < quantity; i++) {
        const label = quantity > 1 ? `${name} ${i + 1}` : name;
        if (await diningTableExists(restaurant.id, label)) {
          skipped++;
          continue;
        }
        const { data: maxRow } = await supabaseServer
          .from("dining_tables")
          .select("sort_order")
          .eq("restaurant_id", restaurant.id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder =
          maxRow && typeof (maxRow as { sort_order: unknown }).sort_order === "number"
            ? (maxRow as { sort_order: number }).sort_order + 1
            : 0;
        const { error } = await supabaseServer.from("dining_tables").insert({
          restaurant_id: restaurant.id,
          label,
          sort_order: nextOrder,
          is_active: true,
        });
        if (error) errors.push(`${label}: table impossible (${error.message}).`);
        else tablesCreated++;
      }
    }
  }

  revalidatePath("/hygiene");
  revalidatePath("/hygiene/elements");
  revalidatePath("/salle");
  revalidatePath("/salle/tables");
  revalidatePath("/dashboard");

  return {
    ok: errors.length === 0 || inventoryCreated + hygieneCreated + tablesCreated > 0,
    inventoryCreated,
    hygieneCreated,
    tablesCreated,
    skipped,
    errors,
  };
}
