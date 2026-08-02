/**
 * Exploitation quotidienne : services et ventes, fabrication des préparations,
 * mouvements de stock, approvisionnement, pertes et questionnaires de fin de service.
 *
 * Le fil conducteur est la vente : elle détermine la consommation théorique
 * (via les recettes), donc les quantités à acheter, donc le stock restant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSalesConsumption } from "@/lib/recipes/computeSalesConsumption";
import {
  DISHES, INGREDIENTS, PREPARATIONS, SUPPLIERS,
  priceHt, type DishDef, type SupplierKey,
} from "./catalog";
import { STAFF, serviceLoad, type PlannedShift } from "./team";
import {
  addDays, dateRange, dayOfWeek, insertChunked, makeRng, parisToUtcIso,
  randFloat, randInt, round2, weightedPick,
} from "./util";

export type ServiceRecord = {
  id: string;
  date: string;
  kind: "lunch" | "dinner";
  covers: number;
  revenueHt: number;
  sales: { dishName: string; dishId: string; qty: number; totalHt: number }[];
};

// ---------------------------------------------------------------------------
// FRÉQUENTATION
// ---------------------------------------------------------------------------

/** Nombre de couverts d'un service : le soir et la fin de semaine remplissent la salle. */
function coversFor(rng: () => number, dow: number, kind: "lunch" | "dinner"): number {
  const base: Record<number, { lunch: [number, number]; dinner: [number, number] }> = {
    2: { lunch: [26, 36], dinner: [32, 44] },
    3: { lunch: [28, 38], dinner: [36, 46] },
    4: { lunch: [32, 42], dinner: [42, 54] },
    5: { lunch: [38, 48], dinner: [54, 68] },
    6: { lunch: [40, 52], dinner: [60, 74] },
  };
  const [min, max] = (base[dow] ?? base[3])[kind];
  return randInt(rng, min, max);
}

/** Le mix de vente d'un service, exprimé en nombre d'articles par couvert. */
const MIX = {
  plat: 0.95,
  entrée: 0.45,
  dessert: 0.35,
  boisson: 1.3,
  vin: 0.22,
};

function candidatesFor(category: DishDef["menuCategory"], kind: "lunch" | "dinner"): DishDef[] {
  return DISHES.filter(
    (d) => d.menuCategory === category && (!d.services || d.services.includes(kind))
  );
}

// ---------------------------------------------------------------------------
// SERVICES ET VENTES
// ---------------------------------------------------------------------------

export async function seedServicesAndSales(
  sb: SupabaseClient,
  restaurantId: string,
  dishIds: Map<string, string>,
  opts: { from: string; to: string; openDays: number[] }
): Promise<ServiceRecord[]> {
  const rng = makeRng(90210);
  const services: ServiceRecord[] = [];

  const serviceRows: Record<string, unknown>[] = [];
  const plan: { date: string; kind: "lunch" | "dinner"; covers: number }[] = [];

  for (const date of dateRange(opts.from, opts.to)) {
    const dow = dayOfWeek(date);
    if (!opts.openDays.includes(dow)) continue;
    for (const kind of ["lunch", "dinner"] as const) {
      const covers = coversFor(rng, dow, kind);
      plan.push({ date, kind, covers });
      serviceRows.push({
        restaurant_id: restaurantId,
        service_date: date,
        service_type: kind,
        analysis_status: "manual",
        created_at: parisToUtcIso(date, kind === "lunch" ? "15:10" : "23:40"),
      });
    }
  }

  const inserted: { id: string; service_date: string; service_type: string }[] = [];
  for (let i = 0; i < serviceRows.length; i += 200) {
    const { data, error } = await sb
      .from("services")
      .insert(serviceRows.slice(i, i + 200))
      .select("id, service_date, service_type");
    if (error) throw new Error(`Services : ${error.message}`);
    inserted.push(...((data ?? []) as typeof inserted));
  }

  const idByKey = new Map<string, string>();
  for (const s of inserted) idByKey.set(`${s.service_date}|${s.service_type}`, s.id);

  // Ventes : on tire les articles réellement commandés, catégorie par catégorie.
  const saleRows: Record<string, unknown>[] = [];

  for (const p of plan) {
    const serviceId = idByKey.get(`${p.date}|${p.kind}`)!;
    const qtyByDish = new Map<string, number>();

    for (const [category, perCover] of Object.entries(MIX) as [DishDef["menuCategory"], number][]) {
      const pool = candidatesFor(category, p.kind);
      if (pool.length === 0) continue;
      const count = Math.round(p.covers * perCover * randFloat(rng, 0.88, 1.12, 2));
      const weighted = pool.map((d) => ({ item: d, weight: d.popularity }));
      for (let i = 0; i < count; i++) {
        const dish = weightedPick(rng, weighted);
        qtyByDish.set(dish.name, (qtyByDish.get(dish.name) ?? 0) + 1);
      }
    }

    let revenueHt = 0;
    const sales: ServiceRecord["sales"] = [];
    for (const [dishName, qty] of qtyByDish) {
      const dish = DISHES.find((d) => d.name === dishName)!;
      const unitHt = priceHt(dish.ttc, dish.vat);
      const totalHt = round2(unitHt * qty);
      revenueHt += totalHt;
      sales.push({ dishName, dishId: dishIds.get(dishName)!, qty, totalHt });
      saleRows.push({
        restaurant_id: restaurantId,
        service_id: serviceId,
        dish_id: dishIds.get(dishName)!,
        qty,
        line_total_ht: totalHt,
      });
    }

    services.push({ id: serviceId, date: p.date, kind: p.kind, covers: p.covers, revenueHt: round2(revenueHt), sales });
  }

  await insertChunked(sb, "service_sales", saleRows);
  return services;
}

// ---------------------------------------------------------------------------
// STOCK : CONSOMMATION ET APPROVISIONNEMENT
// ---------------------------------------------------------------------------

/**
 * Calcule la consommation théorique par article et par jour, en s'appuyant sur
 * la fonction de l'application (qui explose les recettes jusqu'aux ingrédients).
 */
export async function computeDailyConsumption(
  restaurantId: string,
  services: ServiceRecord[]
): Promise<Map<string, Map<string, number>>> {
  const byDay = new Map<string, Map<string, number>>();

  const dayGroups = new Map<string, ServiceRecord[]>();
  for (const s of services) {
    const list = dayGroups.get(s.date) ?? [];
    list.push(s);
    dayGroups.set(s.date, list);
  }

  for (const [date, group] of dayGroups) {
    const saleInputs = group.flatMap((s) => s.sales.map((x) => ({ dish_id: x.dishId, qty: x.qty })));
    const result = await computeSalesConsumption(restaurantId, saleInputs);
    const map = new Map<string, number>();
    for (const c of result.consumption) {
      map.set(c.inventory_item_id, round2((map.get(c.inventory_item_id) ?? 0) + c.qty));
    }
    byDay.set(date, map);
  }

  return byDay;
}

/**
 * Écrit les mouvements de stock : un inventaire initial, les réceptions
 * fournisseurs échelonnées, puis la consommation journalière des services.
 * Les réceptions sont calées pour que le stock reste positif jusqu'au bout.
 */
export async function seedStockMovements(
  sb: SupabaseClient,
  restaurantId: string,
  itemIds: Map<string, string>,
  consumptionByDay: Map<string, Map<string, number>>,
  opts: { from: string; to: string }
): Promise<{ movements: number; deliveries: number }> {
  const rng = makeRng(5150);
  const days = [...consumptionByDay.keys()].sort();

  // Besoin total et rythme quotidien par article.
  const totalNeed = new Map<string, number>();
  for (const map of consumptionByDay.values()) {
    for (const [itemId, qty] of map) totalNeed.set(itemId, (totalNeed.get(itemId) ?? 0) + qty);
  }
  const dailyNeed = new Map<string, number>();
  for (const [itemId, total] of totalNeed) dailyNeed.set(itemId, total / days.length);

  // Conditionnement d'achat par article (pour acheter des colis entiers).
  const packById = new Map<string, { pack: number; supplier: SupplierKey; cost: number; unit: string }>();
  for (const ing of INGREDIENTS) {
    const id = itemIds.get(ing.name);
    if (id) packById.set(id, { pack: ing.unitsPerPurchase, supplier: ing.supplier, cost: ing.cost, unit: ing.unit });
  }
  for (const dish of DISHES) {
    if (!dish.resaleItem) continue;
    const id = itemIds.get(dish.name);
    // Les articles de revente sont toujours comptés à l'unité.
    if (id) packById.set(id, { pack: dish.resaleItem.unitsPerPurchase, supplier: dish.resaleItem.supplier, cost: dish.resaleItem.cost, unit: "unit" });
  }

  const movements: Record<string, unknown>[] = [];
  const stock = new Map<string, number>();

  // 1) Inventaire d'ouverture : environ 10 jours de consommation, en colis entiers.
  const openingDate = addDays(days[0], -1);
  for (const [itemId, daily] of dailyNeed) {
    const meta = packById.get(itemId);
    if (!meta || daily <= 0) continue;
    const packs = Math.max(1, Math.ceil((daily * 10) / meta.pack));
    const qty = packs * meta.pack;
    stock.set(itemId, qty);
    movements.push({
      restaurant_id: restaurantId,
      inventory_item_id: itemId,
      movement_type: "inventory_count",
      quantity: qty,
      unit: meta.unit,
      unit_cost: meta.cost,
      reference_label: "Inventaire d'ouverture",
      occurred_at: parisToUtcIso(openingDate, "08:00"),
    });
  }

  // 2) Jour après jour : réception si le stock passe sous le seuil, puis consommation.
  let deliveries = 0;
  for (const date of days) {
    const dow = dayOfWeek(date);
    const consumption = consumptionByDay.get(date)!;

    // Réceptions du jour, par fournisseur livrant ce jour-là.
    for (const [key, supplier] of Object.entries(SUPPLIERS) as [SupplierKey, typeof SUPPLIERS[SupplierKey]][]) {
      if (!supplier.deliveryDays.includes(dow)) continue;

      const lines: { itemId: string; qty: number; cost: number; unit: string }[] = [];
      for (const [itemId, meta] of packById) {
        if (meta.supplier !== key) continue;
        const daily = dailyNeed.get(itemId) ?? 0;
        if (daily <= 0) continue;

        // On réapprovisionne pour tenir jusqu'à la livraison suivante, avec une marge.
        const coverDays = 7 / supplier.deliveryDays.length + 2;
        const target = daily * coverDays;
        const current = stock.get(itemId) ?? 0;
        if (current >= target) continue;

        const packs = Math.max(1, Math.ceil((target - current) / meta.pack));
        const qty = packs * meta.pack;
        stock.set(itemId, current + qty);
        lines.push({ itemId, qty, cost: meta.cost, unit: meta.unit });
      }

      if (lines.length === 0) continue;
      deliveries++;
      for (const l of lines) {
        movements.push({
          restaurant_id: restaurantId,
          inventory_item_id: l.itemId,
          movement_type: "purchase",
          quantity: l.qty,
          unit: l.unit,
          // Les prix d'achat fluctuent légèrement d'une livraison à l'autre.
          unit_cost: Math.round(l.cost * randFloat(rng, 0.97, 1.05, 3) * 100000) / 100000,
          reference_label: `Réception ${supplier.name}`,
          occurred_at: parisToUtcIso(date, "07:30"),
        });
      }
    }

    // Consommation du jour (sortie de stock).
    for (const [itemId, qty] of consumption) {
      if (qty <= 0) continue;
      stock.set(itemId, (stock.get(itemId) ?? 0) - qty);
      movements.push({
        restaurant_id: restaurantId,
        inventory_item_id: itemId,
        movement_type: "consumption",
        quantity: -qty,
        unit: packById.get(itemId)?.unit ?? "g",
        reference_label: `Consommation services du ${date}`,
        occurred_at: parisToUtcIso(date, "23:50"),
      });
    }
  }

  await insertChunked(sb, "stock_movements", movements);

  // Le stock affiché sur la fiche article suit la somme des mouvements.
  for (const [itemId, qty] of stock) {
    await sb
      .from("inventory_items")
      .update({ current_stock_qty: Math.max(0, round2(qty)) })
      .eq("id", itemId);
  }

  return { movements: movements.length, deliveries };
}

// ---------------------------------------------------------------------------
// REGISTRE DES PRÉPARATIONS
// ---------------------------------------------------------------------------

/**
 * Fabrication quotidienne des préparations : température en fin de cuisson,
 * contrôle du refroidissement à +2 h et date limite de consommation.
 */
export async function seedPreparationRecords(
  sb: SupabaseClient,
  restaurantId: string,
  itemIds: Map<string, string>,
  shifts: PlannedShift[],
  opts: { from: string; to: string; today: string; openDays: number[] }
): Promise<number> {
  const rng = makeRng(60660);
  const rows: Record<string, unknown>[] = [];

  for (const date of dateRange(opts.from, opts.to)) {
    if (!opts.openDays.includes(dayOfWeek(date))) continue;
    if (date >= opts.today) continue;

    // Qui est en cuisine ce jour-là ?
    const cooks = [...new Set(shifts.filter((s) => s.date === date).map((s) => s.staffIndex))]
      .filter((i) => STAFF[i].station === "cuisine");
    if (cooks.length === 0) continue;

    for (const [prepIndex, prep] of PREPARATIONS.entries()) {
      // Chaque préparation est relancée selon sa durée de conservation.
      const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
      if (dayNumber % Math.max(1, prep.shelfLifeDays - 1) !== 0) continue;

      const cook = STAFF[cooks[randInt(rng, 0, cooks.length - 1)]];
      const startedAt = parisToUtcIso(date, prep.station === "pâtisserie" ? "08:30" : "09:15");
      const endTemp = randFloat(rng, prep.targetEndTemp + 52, prep.targetEndTemp + 66, 1);
      const endAt = parisToUtcIso(date, prep.station === "pâtisserie" ? "10:00" : "10:45");
      const due2h = new Date(Date.parse(endAt) + 2 * 3600_000).toISOString();
      // Refroidissement réglementaire : sous 10 °C en moins de 2 h.
      const temp2h = randFloat(rng, prep.targetEndTemp - 1.5, prep.targetEndTemp + 1.5, 1);

      rows.push({
        restaurant_id: restaurantId,
        inventory_item_id: itemIds.get(prep.name) ?? null,
        label: prep.name,
        started_at: startedAt,
        temp_end_celsius: endTemp,
        temp_end_recorded_at: endAt,
        temp_2h_celsius: temp2h,
        temp_2h_due_at: due2h,
        temp_2h_recorded_at: new Date(Date.parse(due2h) - randInt(rng, 2, 14) * 60000).toISOString(),
        dlc_date: addDays(date, prep.shelfLifeDays),
        recorded_by_display: cook.displayName,
        // Le numéro de lot est unique par restaurant : date + rang de la préparation.
        lot_reference: `LOT-${date.replace(/-/g, "")}-${String(prepIndex + 1).padStart(2, "0")}`,
        comment: `Fabrication ${prep.batchYield} ${prep.unit} — refroidissement cellule.`,
        // Les lots dont la DLC est passée sont clôturés.
        closed_at: addDays(date, prep.shelfLifeDays) < opts.today
          ? parisToUtcIso(addDays(date, prep.shelfLifeDays), "23:00")
          : null,
        closed_reason: addDays(date, prep.shelfLifeDays) < opts.today ? "Lot écoulé en service" : null,
        created_at: startedAt,
      });
    }
  }

  await insertChunked(sb, "preparation_records", rows);
  return rows.length;
}

// ---------------------------------------------------------------------------
// PERTES
// ---------------------------------------------------------------------------

export async function seedWasteLogs(
  sb: SupabaseClient,
  restaurantId: string,
  itemIds: Map<string, string>,
  services: ServiceRecord[],
  today: string
): Promise<number> {
  const rng = makeRng(1337);
  const rows: Record<string, unknown>[] = [];

  const perishable = INGREDIENTS.filter((i) =>
    ["Poissons", "Viandes", "Légumes", "Crèmerie", "Fruits"].includes(i.category)
  );

  for (const svc of services) {
    if (svc.date >= today) continue;
    // Une perte est déclarée sur environ un service sur quatre.
    if (rng() > 0.25) continue;

    const ing = perishable[randInt(rng, 0, perishable.length - 1)];
    const itemId = itemIds.get(ing.name);
    if (!itemId) continue;

    const qty = ing.unit === "unit" ? randInt(rng, 1, 3) : randInt(rng, 120, 900);
    const reason = weightedPick(rng, [
      { item: "dlc", weight: 3 },
      { item: "cooking", weight: 4 },
      { item: "dropped", weight: 2 },
      { item: "quality", weight: 2 },
    ]);

    rows.push({
      restaurant_id: restaurantId,
      service_id: svc.id,
      inventory_item_id: itemId,
      waste_type: "raw",
      reason,
      quantity: qty,
      unit: ing.unit,
      estimated_cost_ht: round2(qty * ing.cost),
      notes: reason === "dlc" ? "DLC atteinte, produit écarté au contrôle du matin."
        : reason === "cooking" ? "Rebut de cuisson lors du coup de feu."
        : reason === "dropped" ? "Produit tombé au sol pendant le service."
        : "Qualité insuffisante constatée à la réception.",
      logged_at: parisToUtcIso(svc.date, svc.kind === "lunch" ? "14:50" : "23:05"),
    });
  }

  await insertChunked(sb, "waste_logs", rows);
  return rows.length;
}

// ---------------------------------------------------------------------------
// QUESTIONNAIRES DE FIN DE SERVICE
// ---------------------------------------------------------------------------

/**
 * À chaque clôture de service, l'équipe présente répond au micro-sondage anonyme.
 * Les réponses sont cohérentes avec le service : le plat le plus vendu est cité
 * dans les questions de mise en place, le stress monte les soirs de forte affluence.
 */
export async function seedShiftFeedback(
  sb: SupabaseClient,
  restaurantId: string,
  services: ServiceRecord[],
  shifts: PlannedShift[],
  dishIds: Map<string, string>,
  categoryIds: Map<string, string>,
  today: string
): Promise<{ answers: number; services: number }> {
  const rng = makeRng(24680);

  const { data: templates, error } = await sb
    .from("feedback_question_templates")
    .select("id, template_key, category, response_type, follow_up_config")
    .eq("is_active", true);
  if (error) throw new Error(`Modèles de questions : ${error.message}`);

  const byKey = new Map<string, { id: string; template_key: string; category: string; response_type: string; follow_up_config: Record<string, unknown> }>();
  for (const t of (templates ?? []) as any[]) byKey.set(t.template_key, t);

  const rows: Record<string, unknown>[] = [];
  let servicesCovered = 0;

  const ingredientFamilyIds = [...categoryIds.entries()]
    .filter(([path]) => path.startsWith("Stock/") && path.split("/").length === 2)
    .map(([, id]) => id);

  for (const svc of services) {
    if (svc.date >= today) continue;

    // Membres présents sur ce service : chacun peut répondre.
    const present = shifts.filter((s) => s.date === svc.date && s.kind === svc.kind);
    if (present.length === 0) continue;

    // Tout le monde ne répond pas systématiquement : entre 2 réponses et l'effectif complet.
    const responders = Math.max(2, Math.min(present.length, randInt(rng, 2, present.length)));
    const topSeller = [...svc.sales].sort((a, b) => b.qty - a.qty)[0];
    const slowSeller = [...svc.sales].sort((a, b) => a.qty - b.qty)[0];
    const load = serviceLoad(dayOfWeek(svc.date), svc.kind);
    const busy = load >= 9; // vendredi et samedi soir

    servicesCovered++;
    const submittedAt = parisToUtcIso(svc.date, svc.kind === "lunch" ? "15:05" : "23:35");

    for (let r = 0; r < responders; r++) {
      // Chaque répondant reçoit 2 à 3 questions, dont le baromètre d'ambiance.
      const picks: string[] = ["TEAM_STRESS_EMOJI"];
      picks.push(
        weightedPick(rng, [
          { item: "TOP_SELLER_SETUP", weight: 4 },
          { item: "PLATE_RETURN_FREQUENT", weight: 3 },
          { item: "KITCHEN_BOTTLENECK_DISH", weight: 3 },
          { item: "HIGH_FOOD_COST_INGREDIENT", weight: 2 },
        ])
      );
      if (rng() < 0.5) {
        picks.push(
          weightedPick(rng, [
            { item: "SLOW_SELLER_FEEDBACK", weight: 3 },
            { item: "EQUIPMENT_SLOWDOWN", weight: 2 },
            { item: "INGREDIENT_QUALITY_ALERT", weight: 2 },
          ])
        );
      }

      for (const key of picks) {
        const tpl = byKey.get(key);
        if (!tpl) continue;

        let payload: Record<string, unknown> = {};
        let contextKey = "global";

        switch (key) {
          case "TEAM_STRESS_EMOJI": {
            // Les gros services tirent le ressenti vers le rouge.
            const opt = busy
              ? weightedPick(rng, [
                  { item: { value: "hell", emoji: "🔴", label: "En enfer" }, weight: 2 },
                  { item: { value: "tense", emoji: "🟡", label: "Tendu" }, weight: 5 },
                  { item: { value: "smooth", emoji: "🟢", label: "Fluidité" }, weight: 2 },
                ])
              : weightedPick(rng, [
                  { item: { value: "hell", emoji: "🔴", label: "En enfer" }, weight: 1 },
                  { item: { value: "tense", emoji: "🟡", label: "Tendu" }, weight: 3 },
                  { item: { value: "smooth", emoji: "🟢", label: "Fluidité" }, weight: 6 },
                ]);
            payload = opt;
            break;
          }
          case "TOP_SELLER_SETUP":
            payload = { value: rng() > (busy ? 0.45 : 0.2) };
            contextKey = topSeller ? `dish:${topSeller.dishId}` : "global";
            break;
          case "SLOW_SELLER_FEEDBACK":
            payload = { value: rng() < 0.3 };
            contextKey = slowSeller ? `dish:${slowSeller.dishId}` : "global";
            break;
          case "HIGH_FOOD_COST_INGREDIENT":
            payload = { value: rng() < 0.35 };
            break;
          case "PLATE_RETURN_FREQUENT": {
            const seen = rng() < 0.3;
            if (seen && topSeller) {
              const components = (tpl.follow_up_config?.components as string[]) ?? ["viande", "garniture", "sauce"];
              payload = { value: true, dish_id: topSeller.dishId, component: components[randInt(rng, 0, components.length - 1)] };
            } else {
              payload = { value: false };
            }
            break;
          }
          case "KITCHEN_BOTTLENECK_DISH": {
            const dish = svc.sales[randInt(rng, 0, Math.max(0, svc.sales.length - 1))];
            if (!dish) continue;
            payload = { dish_id: dish.dishId };
            contextKey = `dish:${dish.dishId}`;
            break;
          }
          case "EQUIPMENT_SLOWDOWN":
            payload = { equipment: weightedPick(rng, [
              { item: "friteuse", weight: 3 },
              { item: "four", weight: 3 },
              { item: "lave_vaisselle", weight: 2 },
              { item: "plancha", weight: 1 },
              { item: "autre", weight: 1 },
            ]) };
            break;
          case "INGREDIENT_QUALITY_ALERT": {
            if (ingredientFamilyIds.length === 0) continue;
            payload = { category_id: ingredientFamilyIds[randInt(rng, 0, ingredientFamilyIds.length - 1)] };
            break;
          }
          default:
            continue;
        }

        rows.push({
          restaurant_id: restaurantId,
          service_id: svc.id,
          template_id: tpl.id,
          template_key: tpl.template_key,
          category: tpl.category,
          context_key: contextKey,
          response_payload: payload,
          submitted_at: submittedAt,
        });
      }
    }
  }

  await insertChunked(sb, "anonymous_feedback", rows);
  return { answers: rows.length, services: servicesCovered };
}
