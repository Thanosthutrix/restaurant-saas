/**
 * Hygiène et HACCP : inventaire du matériel, éléments à nettoyer avec leurs
 * protocoles, registres remplis sur l'historique, relevés de température,
 * suivi de l'huile de friture, et plans de salle et de cuisine.
 *
 * Les registres passés sont signés par un salarié réellement présent ce
 * jour-là (d'après le planning), jamais par un « Démo » générique.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getHygieneProtocolPreset } from "@/lib/hygiene/protocolPresets";
import type { HygieneElementCategory } from "@/lib/hygiene/types";
import { STAFF, type PlannedShift } from "./team";
import { dateRange, insertChunked, makeRng, parisToUtcIso, randFloat, randInt, dayOfWeek } from "./util";

export type ElementDef = {
  name: string;
  category: HygieneElementCategory;
  areaLabel: string;
  recurrence: "daily" | "weekly" | "twice_a_week" | "monthly";
  /** Jour de la semaine pour les récurrences hebdomadaires (1 = lundi). */
  dayOfWeek?: number;
  dayOfMonth?: number;
  /** Point de température associé (équipements froids et maintien au chaud). */
  temp?: { min: number; max: number; type: "cold_storage" | "freezer" | "hot_holding" };
  /** Poste qui prend en charge le nettoyage (pour désigner un signataire crédible). */
  station: "cuisine" | "salle" | "bar" | "plonge";
};

export const HYGIENE_ELEMENTS: ElementDef[] = [
  // — Cuisine —
  { name: "Plan de travail central", category: "plan_travail", areaLabel: "Cuisine", recurrence: "daily", station: "cuisine" },
  { name: "Piano de cuisson", category: "piano_plaque", areaLabel: "Cuisine", recurrence: "daily", station: "cuisine" },
  { name: "Four combiné", category: "four", areaLabel: "Cuisine", recurrence: "daily", station: "cuisine" },
  { name: "Friteuse double bac", category: "autre", areaLabel: "Cuisine", recurrence: "daily", station: "cuisine" },
  { name: "Trancheur à charcuterie", category: "trancheuse", areaLabel: "Cuisine", recurrence: "daily", station: "cuisine" },
  { name: "Chambre froide positive", category: "chambre_froide", areaLabel: "Réserve", recurrence: "weekly", dayOfWeek: 2, station: "cuisine", temp: { min: 0, max: 4, type: "cold_storage" } },
  { name: "Congélateur coffre", category: "congelateur", areaLabel: "Réserve", recurrence: "monthly", dayOfMonth: 5, station: "cuisine", temp: { min: -25, max: -18, type: "freezer" } },
  { name: "Armoire réfrigérée cuisine", category: "frigo", areaLabel: "Cuisine", recurrence: "twice_a_week", station: "cuisine", temp: { min: 0, max: 4, type: "cold_storage" } },
  { name: "Bain-marie de service", category: "bac_gastronorme", areaLabel: "Cuisine", recurrence: "daily", station: "cuisine", temp: { min: 63, max: 90, type: "hot_holding" } },
  { name: "Hotte aspirante", category: "hotte", areaLabel: "Cuisine", recurrence: "weekly", dayOfWeek: 2, station: "cuisine" },
  { name: "Sol de cuisine", category: "sol", areaLabel: "Cuisine", recurrence: "daily", station: "plonge" },
  { name: "Murs et faïence cuisine", category: "mur", areaLabel: "Cuisine", recurrence: "weekly", dayOfWeek: 4, station: "plonge" },
  { name: "Plonge et lave-vaisselle", category: "plonge", areaLabel: "Plonge", recurrence: "daily", station: "plonge" },
  { name: "Local à déchets", category: "zone_dechets", areaLabel: "Arrière-cuisine", recurrence: "daily", station: "plonge" },
  { name: "Étagères de réserve sèche", category: "etagere", areaLabel: "Réserve", recurrence: "weekly", dayOfWeek: 3, station: "cuisine" },

  // — Bar et salle —
  { name: "Machine à café", category: "machine", areaLabel: "Bar", recurrence: "daily", station: "bar" },
  { name: "Tireuse à bière", category: "machine", areaLabel: "Bar", recurrence: "weekly", dayOfWeek: 2, station: "bar" },
  { name: "Armoire réfrigérée bar", category: "frigo", areaLabel: "Bar", recurrence: "twice_a_week", station: "bar", temp: { min: 0, max: 4, type: "cold_storage" } },
  { name: "Plan de bar", category: "plan_travail", areaLabel: "Bar", recurrence: "daily", station: "bar" },
  { name: "Sol de salle", category: "sol", areaLabel: "Salle", recurrence: "daily", station: "salle" },
  { name: "Tables et banquettes", category: "autre", areaLabel: "Salle", recurrence: "daily", station: "salle" },
  { name: "Sanitaires clients", category: "sanitaire", areaLabel: "Salle", recurrence: "daily", station: "salle" },
  { name: "Poignées et points de contact", category: "poignee_contact", areaLabel: "Salle", recurrence: "daily", station: "salle" },
];

/** Matériel déclaré à l'inventaire, à l'origine des éléments d'hygiène. */
const EQUIPMENT: { name: string; areaKind: string; areaLabel: string; hygieneCategory: string | null; quantity: number }[] = [
  { name: "Piano de cuisson 6 feux", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "piano_plaque", quantity: 1 },
  { name: "Four combiné 10 niveaux", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "four", quantity: 1 },
  { name: "Friteuse double bac", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "autre", quantity: 1 },
  { name: "Plan de travail inox", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "plan_travail", quantity: 3 },
  { name: "Trancheur à charcuterie", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "trancheuse", quantity: 1 },
  { name: "Chambre froide positive", areaKind: "storage", areaLabel: "Réserve", hygieneCategory: "chambre_froide", quantity: 1 },
  { name: "Congélateur coffre", areaKind: "storage", areaLabel: "Réserve", hygieneCategory: "congelateur", quantity: 1 },
  { name: "Armoire réfrigérée", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "frigo", quantity: 1 },
  { name: "Hotte aspirante", areaKind: "kitchen", areaLabel: "Cuisine", hygieneCategory: "hotte", quantity: 1 },
  { name: "Lave-vaisselle à capot", areaKind: "kitchen", areaLabel: "Plonge", hygieneCategory: "plonge", quantity: 1 },
  { name: "Machine à café 2 groupes", areaKind: "bar", areaLabel: "Bar", hygieneCategory: "machine", quantity: 1 },
  { name: "Tireuse à bière 2 becs", areaKind: "bar", areaLabel: "Bar", hygieneCategory: "machine", quantity: 1 },
  { name: "Armoire réfrigérée bar", areaKind: "bar", areaLabel: "Bar", hygieneCategory: "frigo", quantity: 1 },
  { name: "Table de salle 4 couverts", areaKind: "dining", areaLabel: "Salle", hygieneCategory: null, quantity: 9 },
  { name: "Table de salle 2 couverts", areaKind: "dining", areaLabel: "Salle", hygieneCategory: null, quantity: 4 },
  { name: "Sanitaires clients", areaKind: "sanitary", areaLabel: "Salle", hygieneCategory: "sanitaire", quantity: 2 },
];

/**
 * Inventaire du matériel. La migration `restaurant_equipment_inventory` n'est pas
 * appliquée sur toutes les bases : si la table est absente, on poursuit sans elle,
 * les éléments d'hygiène étant créés indépendamment.
 */
export async function seedEquipmentInventory(
  sb: SupabaseClient,
  restaurantId: string
): Promise<number> {
  const rows = EQUIPMENT.map((e) => ({
    restaurant_id: restaurantId,
    name: e.name,
    area_kind: e.areaKind,
    area_label: e.areaLabel,
    hygiene_category: e.hygieneCategory,
    quantity: e.quantity,
    create_hygiene_element: e.hygieneCategory != null,
    create_dining_table: e.areaKind === "dining",
  }));

  const { error } = await sb.from("restaurant_equipment_inventory").insert(rows);
  if (error) {
    if (/schema cache|does not exist/.test(error.message)) return 0;
    throw new Error(`Inventaire du matériel : ${error.message}`);
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// ÉLÉMENTS D'HYGIÈNE
// ---------------------------------------------------------------------------

export async function seedHygieneElements(
  sb: SupabaseClient,
  restaurantId: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const el of HYGIENE_ELEMENTS) {
    const preset = getHygieneProtocolPreset(el.category);
    const { data, error } = await sb
      .from("hygiene_elements")
      .insert({
        restaurant_id: restaurantId,
        name: el.name,
        category: el.category,
        area_label: el.areaLabel,
        description: preset.description,
        risk_level: preset.suggested_risk_level,
        recurrence_type: el.recurrence,
        recurrence_day_of_week: el.dayOfWeek ?? null,
        recurrence_day_of_month: el.dayOfMonth ?? null,
        cleaning_protocol: preset.cleaning_protocol,
        disinfection_protocol: preset.disinfection_protocol,
        product_used: preset.product_used,
        dosage: preset.dosage,
        contact_time: preset.contact_time,
        active: true,
        temp_point_enabled: el.temp != null,
        temp_min_threshold: el.temp?.min ?? null,
        temp_max_threshold: el.temp?.max ?? null,
        temp_recurrence_type: el.temp ? "daily" : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Élément d'hygiène « ${el.name} » : ${error.message}`);
    ids.set(el.name, (data as { id: string }).id);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// REGISTRE DE NETTOYAGE
// ---------------------------------------------------------------------------

/** Salariés présents un jour donné, filtrés par poste quand c'est possible. */
function signersOn(
  shifts: PlannedShift[],
  date: string,
  station: ElementDef["station"]
): number[] {
  const present = shifts.filter((s) => s.date === date).map((s) => s.staffIndex);
  const unique = [...new Set(present)];
  const matching = unique.filter((i) => STAFF[i].station === station);
  return matching.length > 0 ? matching : unique;
}

/**
 * Génère les tâches de nettoyage sur toute la période et les clôture pour le passé.
 * Un petit nombre de tâches reste non fait (oublis réels d'un service chargé),
 * ce qui donne un score d'hygiène crédible plutôt qu'un 100 % artificiel.
 */
export async function seedHygieneTasks(
  sb: SupabaseClient,
  restaurantId: string,
  elementIds: Map<string, string>,
  shifts: PlannedShift[],
  opts: { from: string; to: string; today: string; openDays: number[] }
): Promise<{ total: number; done: number; missed: number; pending: number }> {
  const rng = makeRng(20260802);
  const rows: Record<string, unknown>[] = [];
  let done = 0;
  let missed = 0;
  let pending = 0;

  for (const el of HYGIENE_ELEMENTS) {
    const elementId = elementIds.get(el.name)!;
    const preset = getHygieneProtocolPreset(el.category);

    for (const date of dateRange(opts.from, opts.to)) {
      const dow = dayOfWeek(date);
      if (!opts.openDays.includes(dow)) continue;

      // Récurrence de l'élément.
      let periodKey: string | null = null;
      if (el.recurrence === "daily") {
        periodKey = `d:${date}`;
      } else if (el.recurrence === "weekly") {
        if (dow !== (el.dayOfWeek ?? 2)) continue;
        periodKey = `w:${date}`;
      } else if (el.recurrence === "twice_a_week") {
        if (dow !== 2 && dow !== 5) continue;
        periodKey = `2w:${date}`;
      } else if (el.recurrence === "monthly") {
        if (Number(date.slice(8, 10)) !== (el.dayOfMonth ?? 5)) continue;
        periodKey = `m:${date}`;
      }
      if (!periodKey) continue;

      const isPast = date < opts.today;
      const row: Record<string, unknown> = {
        restaurant_id: restaurantId,
        element_id: elementId,
        period_key: periodKey,
        due_at: `${date}T23:59:59.999+00:00`,
        risk_level: preset.suggested_risk_level,
        status: "pending",
        maintenance_plan: 0,
      };

      if (isPast) {
        // 4 % des tâches passées restent non faites : incident de service assumé.
        const skipped = rng() < 0.04;
        if (skipped) {
          row.status = "missed";
          missed++;
        } else {
          const candidates = signersOn(shifts, date, el.station);
          if (candidates.length === 0) {
            row.status = "missed";
            missed++;
          } else {
            const staffIndex = candidates[randInt(rng, 0, candidates.length - 1)];
            const staff = STAFF[staffIndex];
            // Nettoyage en fin de service, entre 22 h 45 et 23 h 40.
            const hh = randInt(rng, 22, 23);
            const mm = hh === 22 ? randInt(rng, 45, 59) : randInt(rng, 0, 40);
            row.status = "completed";
            row.completed_at = parisToUtcIso(date, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
            row.completed_by_display = staff.displayName;
            row.completed_by_initials = staff.initials;
            // La plupart des postes sont nettoyés puis désinfectés ; les sols et
            // murs se limitent souvent au nettoyage.
            row.cleaning_action_type = rng() < 0.75 ? "both" : "cleaning";
            done++;
          }
        }
      } else {
        pending++;
      }

      rows.push(row);
    }
  }

  await insertChunked(sb, "hygiene_tasks", rows);
  return { total: rows.length, done, missed, pending };
}

// ---------------------------------------------------------------------------
// TEMPÉRATURES (HACCP)
// ---------------------------------------------------------------------------

export async function seedTemperatures(
  sb: SupabaseClient,
  restaurantId: string,
  elementIds: Map<string, string>,
  shifts: PlannedShift[],
  opts: { from: string; to: string; today: string; openDays: number[] }
): Promise<{ points: number; logs: number; alerts: number }> {
  const rng = makeRng(70125);
  const withTemp = HYGIENE_ELEMENTS.filter((e) => e.temp);
  const pointIds = new Map<string, string>();

  for (const el of withTemp) {
    const { data, error } = await sb
      .from("temperature_points")
      .insert({
        restaurant_id: restaurantId,
        name: el.name,
        point_type: el.temp!.type,
        location: el.areaLabel,
        min_threshold: el.temp!.min,
        max_threshold: el.temp!.max,
        recurrence_type: "daily",
        active: true,
        hygiene_element_id: elementIds.get(el.name) ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Point de température « ${el.name} » : ${error.message}`);
    pointIds.set(el.name, (data as { id: string }).id);
  }

  const taskRows: Record<string, unknown>[] = [];
  const logRows: Record<string, unknown>[] = [];
  const coldRows: Record<string, unknown>[] = [];
  let alerts = 0;

  for (const el of withTemp) {
    const pointId = pointIds.get(el.name)!;
    const { min, max } = el.temp!;

    for (const date of dateRange(opts.from, opts.to)) {
      if (!opts.openDays.includes(dayOfWeek(date))) continue;
      const isPast = date < opts.today;

      taskRows.push({
        restaurant_id: restaurantId,
        temperature_point_id: pointId,
        period_key: `d:${date}`,
        due_at: `${date}T23:59:59.999+00:00`,
        status: isPast ? "completed" : "pending",
      });

      if (!isPast) continue;

      const candidates = signersOn(shifts, date, el.station);
      if (candidates.length === 0) continue;

      // Deux relevés : ouverture et fermeture.
      for (const moment of ["opening", "closing"] as const) {
        const staff = STAFF[candidates[randInt(rng, 0, candidates.length - 1)]];
        const time = moment === "opening" ? "09:45" : "23:15";

        // 3 % de relevés hors seuil, avec action corrective renseignée.
        const outOfRange = rng() < 0.03;
        let value: number;
        if (outOfRange) {
          value = randFloat(rng, max + 0.4, max + 2.6, 1);
          alerts++;
        } else {
          const span = max - min;
          value = randFloat(rng, min + span * 0.25, max - span * 0.15, 1);
        }

        const status = value > max || value < min ? (value > max + 2 ? "critical" : "alert") : "normal";

        logRows.push({
          restaurant_id: restaurantId,
          temperature_point_id: pointId,
          value,
          log_status: status,
          recorded_by_display: staff.displayName,
          comment: moment === "opening" ? "Relevé d'ouverture" : "Relevé de fermeture",
          corrective_action: status === "normal" ? null
            : "Porte refermée et joint vérifié, denrées contrôlées puis transférées en chambre froide. Nouveau relevé conforme à 30 min.",
          product_impact: status === "critical" ? "Aucune denrée écartée — durée de dépassement inférieure à 2 h." : null,
          created_at: parisToUtcIso(date, time),
        });

        // Le registre froid de l'onglet hygiène reçoit le même relevé.
        if (el.temp!.type !== "hot_holding") {
          coldRows.push({
            restaurant_id: restaurantId,
            element_id: elementIds.get(el.name)!,
            event_kind: moment,
            temperature_celsius: value,
            recorded_at: parisToUtcIso(date, time),
            recorded_by_display: staff.displayName,
            recorded_by_initials: staff.initials,
            comment: status === "normal" ? null : "Écart relevé, action corrective engagée.",
          });
        }
      }
    }
  }

  await insertChunked(sb, "temperature_tasks", taskRows);
  await insertChunked(sb, "temperature_logs", logRows);
  await insertChunked(sb, "hygiene_cold_temperature_readings", coldRows);

  return { points: withTemp.length, logs: logRows.length, alerts };
}

// ---------------------------------------------------------------------------
// HUILE DE FRITURE
// ---------------------------------------------------------------------------

/**
 * Suivi de l'huile : le taux de composés polaires monte à l'usage, et l'huile
 * est changée dès qu'il approche le seuil réglementaire de 25 %.
 */
export async function seedFryerOil(
  sb: SupabaseClient,
  restaurantId: string,
  shifts: PlannedShift[],
  opts: { from: string; to: string; today: string; openDays: number[] }
): Promise<{ logs: number; changes: number }> {
  const rng = makeRng(4412);

  const { data: unit, error } = await sb
    .from("fryer_units")
    .insert({
      restaurant_id: restaurantId,
      name: "Friteuse double bac",
      location: "Cuisine",
      capacity_liters: 16,
      oil_temp_min_celsius: 160,
      oil_temp_max_celsius: 180,
      tpm_alert_threshold_pct: 22,
      tpm_change_threshold_pct: 25,
      recurrence_type: "daily",
      active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Friteuse : ${error.message}`);
  const fryerId = (unit as { id: string }).id;

  const days = dateRange(opts.from, opts.to).filter((d) => opts.openDays.includes(dayOfWeek(d)));
  const taskRows: Record<string, unknown>[] = [];
  const logRows: Record<string, unknown>[] = [];
  let changes = 0;

  let batchId: string | null = null;
  let batchStart: string | null = null;
  let tpm = 8;

  async function openBatch(date: string): Promise<void> {
    const { data, error: bErr } = await sb
      .from("fryer_oil_batches")
      .insert({
        restaurant_id: restaurantId,
        fryer_unit_id: fryerId,
        started_at: parisToUtcIso(date, "09:00"),
        oil_product_name: "Huile de friture haute température",
        initial_volume_liters: 16,
        recorded_by_display: "Antoine Leroy",
      })
      .select("id")
      .single();
    if (bErr) throw new Error(`Bain d'huile : ${bErr.message}`);
    batchId = (data as { id: string }).id;
    batchStart = date;
    tpm = randFloat(rng, 6, 9, 1);
  }

  for (const date of days) {
    const isPast = date < opts.today;
    taskRows.push({
      restaurant_id: restaurantId,
      fryer_unit_id: fryerId,
      period_key: `d:${date}`,
      due_at: `${date}T23:59:59.999+00:00`,
      status: isPast ? "completed" : "pending",
    });
    if (!isPast) continue;

    if (!batchId) await openBatch(date);

    // Le taux de composés polaires progresse avec le service.
    tpm = Math.min(40, tpm + randFloat(rng, 0.6, 1.5, 2));
    const mustChange = tpm >= 25;
    const alert = tpm >= 22;

    const candidates = signersOn(shifts, date, "cuisine");
    const staff = candidates.length ? STAFF[candidates[randInt(rng, 0, candidates.length - 1)]] : STAFF[0];

    logRows.push({
      restaurant_id: restaurantId,
      fryer_unit_id: fryerId,
      oil_batch_id: batchId,
      tpm_percent: Math.round(tpm * 10) / 10,
      tpm_test_method: "strip",
      oil_temperature_celsius: randInt(rng, 166, 178),
      filtration_done: true,
      quality_ok: !alert,
      quality_issues: alert ? "Huile foncée, mousse en surface au moment du bain." : null,
      log_status: mustChange ? "critical" : alert ? "alert" : "normal",
      change_oil_required: mustChange,
      oil_changed: mustChange,
      recorded_by_display: staff.displayName,
      comment: "Contrôle de fin de service après filtration.",
      corrective_action: mustChange ? "Bain vidangé, cuve nettoyée et remplie d'huile neuve." : null,
      created_at: parisToUtcIso(date, "23:20"),
    });

    if (mustChange && batchId) {
      await sb
        .from("fryer_oil_batches")
        .update({
          ended_at: parisToUtcIso(date, "23:30"),
          end_reason: "tpm_threshold",
          notes: `Changement au seuil réglementaire (${Math.round(tpm * 10) / 10} % de composés polaires), bain ouvert le ${batchStart}.`,
        })
        .eq("id", batchId);
      changes++;
      batchId = null;
    }
  }

  // Un bain doit rester ouvert pour que la page friteuse affiche l'état courant.
  if (!batchId) await openBatch(opts.today);

  await insertChunked(sb, "fryer_oil_tasks", taskRows);
  await insertChunked(sb, "fryer_oil_logs", logRows);
  return { logs: logRows.length, changes };
}

// ---------------------------------------------------------------------------
// PLANS DE SALLE ET DE CUISINE
// ---------------------------------------------------------------------------

/** 13 tables, 48 couverts : la capacité annoncée du restaurant. */
export const TABLES: { label: string; capacity: number; x: number; y: number }[] = [
  { label: "1", capacity: 2, x: 6, y: 10 },
  { label: "2", capacity: 2, x: 6, y: 26 },
  { label: "3", capacity: 4, x: 6, y: 44 },
  { label: "4", capacity: 4, x: 6, y: 64 },
  { label: "5", capacity: 4, x: 30, y: 26 },
  { label: "6", capacity: 4, x: 30, y: 44 },
  { label: "7", capacity: 4, x: 30, y: 64 },
  { label: "8", capacity: 2, x: 54, y: 10 },
  { label: "9", capacity: 4, x: 54, y: 30 },
  { label: "10", capacity: 4, x: 54, y: 50 },
  { label: "11", capacity: 4, x: 54, y: 70 },
  { label: "12", capacity: 6, x: 78, y: 26 },
  { label: "13", capacity: 4, x: 78, y: 52 },
];

export async function seedDiningTables(
  sb: SupabaseClient,
  restaurantId: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const rows = TABLES.map((t, i) => ({
    restaurant_id: restaurantId,
    label: t.label,
    sort_order: i,
    is_active: true,
  }));
  const { data, error } = await sb.from("dining_tables").insert(rows).select("id, label");
  if (error) throw new Error(`Tables de salle : ${error.message}`);
  for (const r of (data ?? []) as { id: string; label: string }[]) ids.set(r.label, r.id);
  return ids;
}

export async function seedFloorPlans(
  sb: SupabaseClient,
  restaurantId: string,
  tableIds: Map<string, string>,
  elementIds: Map<string, string>
): Promise<void> {
  // — Salle : tables positionnées, bar, entrée, passe et sanitaires —
  const baseTables: Record<string, unknown> = {};
  for (const t of TABLES) {
    const id = tableIds.get(t.label);
    if (!id) continue;
    baseTables[id] = {
      x: t.x, y: t.y,
      width: t.capacity >= 6 ? 18 : t.capacity >= 4 ? 14 : 11,
      height: t.capacity >= 6 ? 14 : t.capacity >= 4 ? 14 : 11,
      capacity: t.capacity,
      rotation: 0,
    };
  }

  const diningLayout = {
    version: 2,
    activeLevelId: "main",
    levels: [
      {
        id: "main",
        label: "Salle",
        sortOrder: 0,
        layout: {
          baseTables,
          fixtures: [
            { id: "bar", kind: "bar", label: "Bar", x: 76, y: 2, width: 22, height: 7, rotation: 0 },
            { id: "entree", kind: "door", label: "Entrée", x: 0, y: 84, width: 9, height: 4, rotation: 0 },
            { id: "passe", kind: "counter", label: "Passe cuisine", x: 44, y: 88, width: 16, height: 5, rotation: 0 },
            { id: "wc", kind: "wall", label: "Sanitaires", x: 88, y: 78, width: 12, height: 14, rotation: 0 },
            { id: "pilier", kind: "pillar", label: "", x: 44, y: 44, width: 4, height: 4, rotation: 0 },
          ],
          removedFromPlan: [],
        },
      },
    ],
  };

  const { error: fpErr } = await sb
    .from("restaurant_floor_plans")
    .insert({ restaurant_id: restaurantId, layout: diningLayout });
  if (fpErr) throw new Error(`Plan de salle : ${fpErr.message}`);

  // — Cuisine : chaque équipement du plan correspond à un élément d'hygiène réel —
  const kitchenEquipment: { name: string; x: number; y: number; w: number; h: number }[] = [
    { name: "Chambre froide positive", x: 4, y: 6, w: 18, h: 16 },
    { name: "Congélateur coffre", x: 4, y: 26, w: 14, h: 12 },
    { name: "Étagères de réserve sèche", x: 4, y: 42, w: 14, h: 12 },
    { name: "Armoire réfrigérée cuisine", x: 26, y: 6, w: 14, h: 12 },
    { name: "Plan de travail central", x: 26, y: 30, w: 26, h: 12 },
    { name: "Trancheur à charcuterie", x: 26, y: 48, w: 12, h: 10 },
    { name: "Piano de cuisson", x: 56, y: 6, w: 20, h: 14 },
    { name: "Four combiné", x: 56, y: 24, w: 16, h: 12 },
    { name: "Friteuse double bac", x: 56, y: 40, w: 14, h: 10 },
    { name: "Bain-marie de service", x: 56, y: 54, w: 16, h: 10 },
    { name: "Hotte aspirante", x: 56, y: 0, w: 20, h: 5 },
    { name: "Plonge et lave-vaisselle", x: 80, y: 30, w: 16, h: 18 },
    { name: "Local à déchets", x: 80, y: 56, w: 14, h: 12 },
  ];

  const kitchenTables: Record<string, unknown> = {};
  for (const eq of kitchenEquipment) {
    const id = elementIds.get(eq.name);
    if (!id) continue;
    kitchenTables[id] = { x: eq.x, y: eq.y, width: eq.w, height: eq.h, capacity: 0, rotation: 0 };
  }

  const kitchenLayout = {
    version: 2,
    activeLevelId: "kitchen-main",
    levels: [
      {
        id: "kitchen-main",
        label: "Cuisine",
        sortOrder: 0,
        layout: {
          baseTables: kitchenTables,
          fixtures: [
            { id: "passe", kind: "counter", label: "Passe", x: 26, y: 66, width: 26, height: 6, rotation: 0 },
            { id: "porte-reserve", kind: "door", label: "Réserve", x: 0, y: 2, width: 4, height: 10, rotation: 0 },
            { id: "porte-salle", kind: "door", label: "Salle", x: 26, y: 76, width: 10, height: 4, rotation: 0 },
            { id: "mur-plonge", kind: "wall", label: "", x: 78, y: 26, width: 2, height: 44, rotation: 0 },
          ],
          removedFromPlan: [],
        },
      },
    ],
  };

  const { error: kErr } = await sb
    .from("restaurant_kitchen_floor_plans")
    .insert({ restaurant_id: restaurantId, layout: kitchenLayout });
  if (kErr) throw new Error(`Plan de cuisine : ${kErr.message}`);
}
