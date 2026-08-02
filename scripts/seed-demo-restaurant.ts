/**
 * Compte de démonstration — « Le Comptoir du Marché ».
 *
 * Reconstruit de bout en bout un restaurant tel qu'il existerait si un
 * restaurateur avait saisi lui-même ses données dans l'application : une carte
 * dont chaque plat a sa recette, des préparations maison fabriquées et tracées,
 * des prix d'achat réels, un planning qui respecte les contrats, des registres
 * d'hygiène et de température signés par les personnes présentes ce jour-là,
 * et un questionnaire rempli à la fin de chaque service.
 *
 * Usage :
 *   DEMO_OWNER_EMAIL=medhi@ubion.fr npm run db:seed-demo
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i <= 0 || line.trim().startsWith("#")) continue;
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INGREDIENTS, PREPARATIONS } from "./demo/catalog";
import { computeDishFoodCostHt } from "@/lib/margins/dishMarginAnalysis";
import { OPEN_DAYS, STAFF } from "./demo/team";
import { addDays, dayOfWeek, ymd } from "./demo/util";
import {
  DEMO_NAME, createRestaurant, ensureBeverageStockCategory, seedCategories,
  seedDishes, seedInventory, seedPrepComponents, seedSuppliers, wipePreviousDemo,
} from "./demo/seedCatalog";
import {
  seedDiningTables, seedEquipmentInventory, seedFloorPlans, seedFryerOil,
  seedHygieneElements, seedHygieneTasks, seedTemperatures,
} from "./demo/seedHygiene";
import { seedContracts, seedLeave, seedShifts, seedStaffMembers } from "./demo/seedTeam";
import {
  computeDailyConsumption, seedPreparationRecords, seedServicesAndSales,
  seedShiftFeedback, seedStockMovements, seedWasteLogs,
} from "./demo/seedOperations";
import {
  seedCustomers, seedFixedCharges, seedMonthlyRevenue, seedPurchaseOrders, seedReservations,
} from "./demo/seedBusiness";

const sb: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Profondeur de l'historique et du planning prévisionnel. */
const HISTORY_DAYS = 56;
const FUTURE_DAYS = 21;

function step(n: number, label: string): void {
  console.log(`\n[${String(n).padStart(2, "0")}] ${label}`);
}

async function resolveOwnerId(): Promise<{ id: string; email: string }> {
  const email = (process.env.DEMO_OWNER_EMAIL ?? "medhi@ubion.fr").toLowerCase();
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Lecture des comptes : ${error.message}`);

  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    throw new Error(
      `Aucun compte pour « ${email} ». Créez-le via /signup, ou passez DEMO_OWNER_EMAIL=<votre email>.`
    );
  }
  return { id: user.id, email: user.email! };
}

async function main(): Promise<void> {
  console.log("═".repeat(64));
  console.log("  Seed du compte de démonstration — Le Comptoir du Marché");
  console.log("═".repeat(64));

  const today = ymd(new Date());
  const from = addDays(today, -HISTORY_DAYS);
  const to = addDays(today, FUTURE_DAYS);
  const window = { from, to, today, openDays: OPEN_DAYS };

  const owner = await resolveOwnerId();
  console.log(`\nPropriétaire : ${owner.email}`);
  console.log(`Période      : ${from} → ${to} (aujourd'hui ${today})`);
  console.log(`Ouverture    : mardi au samedi, midi et soir`);

  step(1, "Suppression des restaurants de démo précédents");
  const removed = await wipePreviousDemo(sb, owner.id);
  console.log(removed.length ? removed.map((r) => `  supprimé : ${r}`).join("\n") : "  aucun restaurant existant");

  step(2, "Création du restaurant");
  const rid = await createRestaurant(sb, owner.id);
  console.log(`  ${DEMO_NAME} — ${rid}`);

  step(3, "Rubriques de la carte et du stock");
  const categoryIds = await seedCategories(sb, rid);
  await ensureBeverageStockCategory(sb, rid, categoryIds);
  console.log(`  ${categoryIds.size} rubriques`);

  step(4, "Fournisseurs");
  const supplierIds = await seedSuppliers(sb, rid);
  console.log(`  ${supplierIds.size} fournisseurs`);

  step(5, "Matières premières et préparations");
  const itemIds = await seedInventory(sb, rid, categoryIds, supplierIds);
  const prepLinks = await seedPrepComponents(sb, rid, itemIds);
  console.log(`  ${INGREDIENTS.length} matières premières (toutes avec prix d'achat)`);
  console.log(`  ${PREPARATIONS.length} préparations maison, ${prepLinks} composants`);

  step(6, "Carte et recettes");
  const dishIds = await seedDishes(sb, rid, categoryIds, itemIds, supplierIds);
  console.log(`  ${dishIds.size} plats et boissons, tous avec une recette validée`);

  step(7, "Matériel, éléments à nettoyer et à contrôler");
  const equipment = await seedEquipmentInventory(sb, rid);
  const elementIds = await seedHygieneElements(sb, rid);
  console.log(`  ${elementIds.size} éléments d'hygiène avec protocole`);
  console.log(equipment > 0
    ? `  ${equipment} matériels à l'inventaire`
    : "  inventaire du matériel ignoré (table restaurant_equipment_inventory absente en base)");

  step(8, "Plans de salle et de cuisine");
  const tableIds = await seedDiningTables(sb, rid);
  await seedFloorPlans(sb, rid, tableIds, elementIds);
  console.log(`  salle : ${tableIds.size} tables placées — cuisine : équipements positionnés`);

  step(9, "Équipe et contrats");
  const staffIds = await seedStaffMembers(sb, rid);
  await seedContracts(sb, rid, staffIds);
  console.log(`  ${staffIds.length} salariés, ${staffIds.length} contrats HCR`);

  step(10, "Planning et pointages");
  const { shifts, count, attendance } = await seedShifts(sb, rid, staffIds, window);
  const leave = await seedLeave(sb, rid, staffIds, today);
  console.log(`  ${count} créneaux planifiés, ${attendance} pointages, ${leave} jours de congé`);

  step(11, "Registre de nettoyage");
  const hyg = await seedHygieneTasks(sb, rid, elementIds, shifts, window);
  console.log(`  ${hyg.total} tâches : ${hyg.done} faites, ${hyg.missed} non faites, ${hyg.pending} à venir`);

  step(12, "Relevés de température");
  const temp = await seedTemperatures(sb, rid, elementIds, shifts, window);
  console.log(`  ${temp.points} points contrôlés, ${temp.logs} relevés dont ${temp.alerts} hors seuil`);

  step(13, "Suivi de l'huile de friture");
  const oil = await seedFryerOil(sb, rid, shifts, window);
  console.log(`  ${oil.logs} contrôles, ${oil.changes} changements de bain`);

  step(14, "Services et ventes");
  const services = await seedServicesAndSales(sb, rid, dishIds, { from, to: addDays(today, -1), openDays: OPEN_DAYS });
  const covers = services.reduce((a, s) => a + s.covers, 0);
  const revenue = services.reduce((a, s) => a + s.revenueHt, 0);
  console.log(`  ${services.length} services, ${covers} couverts, ${revenue.toFixed(0)} € HT`);

  step(15, "Registre des préparations");
  const preps = await seedPreparationRecords(sb, rid, itemIds, shifts, window);
  console.log(`  ${preps} fiches de fabrication (température, refroidissement, DLC, lot)`);

  step(16, "Stock : réceptions et consommation");
  const consumption = await computeDailyConsumption(rid, services);
  const stock = await seedStockMovements(sb, rid, itemIds, consumption, { from, to: today });
  console.log(`  ${stock.movements} mouvements, ${stock.deliveries} réceptions fournisseurs`);

  step(17, "Pertes");
  const waste = await seedWasteLogs(sb, rid, itemIds, services, today);
  console.log(`  ${waste} pertes déclarées`);

  step(18, "Questionnaires de fin de service");
  const feedback = await seedShiftFeedback(sb, rid, services, shifts, dishIds, categoryIds, today);
  console.log(`  ${feedback.answers} réponses anonymes sur ${feedback.services} services`);

  step(19, "Clientèle et réservations");
  const { customerIds, timeline } = await seedCustomers(sb, rid, today);
  const reservations = await seedReservations(sb, rid, customerIds, { today, openDays: OPEN_DAYS });
  console.log(`  ${customerIds.length} clients, ${timeline} événements, ${reservations} réservations`);

  step(20, "Achats, charges et chiffre d'affaires");
  const po = await seedPurchaseOrders(sb, rid, supplierIds, itemIds, today);
  const charges = await seedFixedCharges(sb, rid);
  const months = await seedMonthlyRevenue(sb, rid, services);
  console.log(`  ${po.orders} commandes (${po.lines} lignes), ${charges} charges fixes, ${months} mois de CA`);

  await printCoherenceReport(rid, services, shifts);

  console.log("\n" + "═".repeat(64));
  console.log("  Démo prête.");
  console.log(`  Connectez-vous avec ${owner.email} et sélectionnez « ${DEMO_NAME} ».`);
  console.log("═".repeat(64));
}

// ---------------------------------------------------------------------------
// CONTRÔLE DE COHÉRENCE
// ---------------------------------------------------------------------------

/** Vérifie après coup que les données se tiennent, et signale tout écart. */
async function printCoherenceReport(
  restaurantId: string,
  services: Awaited<ReturnType<typeof seedServicesAndSales>>,
  shifts: Awaited<ReturnType<typeof seedShifts>>["shifts"]
): Promise<void> {
  console.log("\n" + "─".repeat(64));
  console.log("  Contrôle de cohérence");
  console.log("─".repeat(64));

  const problems: string[] = [];

  // 1) Chaque plat a une recette et un prix.
  const { data: dishes } = await sb
    .from("dishes")
    .select("id, name, recipe_status, selling_price_ttc, selling_price_ht")
    .eq("restaurant_id", restaurantId);
  const { data: components } = await sb
    .from("dish_components")
    .select("dish_id")
    .eq("restaurant_id", restaurantId);
  const withRecipe = new Set((components ?? []).map((c: { dish_id: string }) => c.dish_id));
  const noRecipe = (dishes ?? []).filter((d: { id: string }) => !withRecipe.has(d.id));
  const noPrice = (dishes ?? []).filter((d: { selling_price_ttc: number | null }) => !d.selling_price_ttc);
  console.log(`  Carte              ${dishes?.length} plats, tous avec recette et prix`);
  if (noRecipe.length) problems.push(`${noRecipe.length} plats sans recette`);
  if (noPrice.length) problems.push(`${noPrice.length} plats sans prix`);

  // 2) Tous les articles achetés ont un prix de référence.
  const { data: items } = await sb
    .from("inventory_items")
    .select("name, item_type, reference_purchase_unit_cost_ht")
    .eq("restaurant_id", restaurantId);
  const purchased = (items ?? []).filter((i: { item_type: string }) => i.item_type !== "prep");
  const missingCost = purchased.filter(
    (i: { reference_purchase_unit_cost_ht: number | null }) => i.reference_purchase_unit_cost_ht == null
  );
  console.log(`  Prix d'achat       ${purchased.length - missingCost.length}/${purchased.length} articles renseignés`);
  if (missingCost.length) {
    problems.push(`${missingCost.length} articles sans prix : ${missingCost.map((i: { name: string }) => i.name).join(", ")}`);
  }

  // 3) Coût matière **tel que l'application le calcule**.
  //    Contrôler avec la fonction du catalogue ne prouverait rien : c'est la
  //    valeur affichée à l'écran « Marges » qui doit être juste.
  const soldQty = new Map<string, number>();
  for (const s of services) {
    for (const line of s.sales) soldQty.set(line.dishId, (soldQty.get(line.dishId) ?? 0) + line.qty);
  }

  let totalFoodCost = 0;
  let totalRevenue = 0;
  const suspicious: string[] = [];

  for (const d of (dishes ?? []) as { id: string; name: string; selling_price_ht?: number | null }[]) {
    const res = await computeDishFoodCostHt(restaurantId, d.id);
    const qty = soldQty.get(d.id) ?? 0;
    const priceHtValue = Number(d.selling_price_ht ?? 0);
    totalFoodCost += res.foodCostHt * qty;
    totalRevenue += priceHtValue * qty;

    const margin = priceHtValue > 0 ? ((priceHtValue - res.foodCostHt) / priceHtValue) * 100 : 0;
    // Un coût matière nul ou une marge quasi totale trahit un prix manquant ;
    // un coût supérieur au prix de vente trahit une recette mal dimensionnée.
    if (!res.costIsComplete) suspicious.push(`${d.name} : coût matière incomplet`);
    else if (res.foodCostHt <= 0) suspicious.push(`${d.name} : coût matière nul`);
    // Au-delà de 94 %, ce n'est plus une marge de boisson chaude mais un coût perdu.
    else if (margin > 94) suspicious.push(`${d.name} : marge ${margin.toFixed(0)} % (coût matière ${res.foodCostHt.toFixed(2)} €)`);
    else if (margin < 0) suspicious.push(`${d.name} : marge négative (${res.foodCostHt.toFixed(2)} € pour ${priceHtValue.toFixed(2)} € HT)`);
  }

  const ratio = totalRevenue > 0 ? (totalFoodCost / totalRevenue) * 100 : 0;
  console.log(`  Coût matière       ${ratio.toFixed(1)} % du CA HT, calculé par l'app (fourchette brasserie : 22–32 %)`);
  if (ratio < 20 || ratio > 38) problems.push(`ratio de coût matière hors cible : ${ratio.toFixed(1)} %`);
  if (suspicious.length) problems.push(`marges incohérentes :\n      ${suspicious.join("\n      ")}`);

  // 4) Heures planifiées vs contrat, sur une semaine pleine.
  const refMonday = addDays(ymd(new Date()), -14 - dayOfWeek(addDays(ymd(new Date()), -14)) + 1);
  console.log(`  Planning           semaine du ${refMonday} :`);
  for (let i = 0; i < STAFF.length; i++) {
    const week = shifts.filter((s) => s.staffIndex === i && s.date >= refMonday && s.date < addDays(refMonday, 7));
    if (week.length === 0) continue;
    const hours = week.reduce((a, s) => a + s.hours, 0);
    const gap = hours - STAFF[i].weeklyHours;
    const flag = Math.abs(gap) > 1.5 ? "  ← écart" : "";
    console.log(
      `    ${STAFF[i].displayName.padEnd(16)} ${hours.toFixed(1).padStart(5)} h planifiées / ${String(STAFF[i].weeklyHours).padStart(2)} h au contrat${flag}`
    );
    if (Math.abs(gap) > 1.5) problems.push(`${STAFF[i].displayName} : ${hours.toFixed(1)} h vs ${STAFF[i].weeklyHours} h au contrat`);
  }

  // 5) Registres remplis.
  const { count: doneTasks } = await sb
    .from("hygiene_tasks").select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId).eq("status", "completed");
  const { count: unsigned } = await sb
    .from("hygiene_tasks").select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId).eq("status", "completed").is("completed_by_display", null);
  console.log(`  Registres          ${doneTasks} nettoyages signés`);
  if ((unsigned ?? 0) > 0) problems.push(`${unsigned} tâches faites sans signataire`);

  // 6) Questionnaires : un service passé sans réponse serait une incohérence.
  const { data: fb } = await sb
    .from("anonymous_feedback").select("service_id").eq("restaurant_id", restaurantId);
  const answered = new Set((fb ?? []).map((f: { service_id: string }) => f.service_id));
  const missing = services.filter((s) => !answered.has(s.id));
  console.log(`  Questionnaires     ${answered.size}/${services.length} services avec réponses`);
  if (missing.length) problems.push(`${missing.length} services sans questionnaire`);

  // 7) Stock : aucune valeur négative.
  const { data: stockRows } = await sb
    .from("inventory_items").select("name, current_stock_qty").eq("restaurant_id", restaurantId);
  const negative = (stockRows ?? []).filter((i: { current_stock_qty: number | null }) => (i.current_stock_qty ?? 0) < 0);
  if (negative.length) problems.push(`${negative.length} articles en stock négatif`);

  console.log("\n" + (problems.length === 0
    ? "  Aucune incohérence détectée."
    : `  ${problems.length} point(s) à revoir :\n${problems.map((p) => `    • ${p}`).join("\n")}`));
}

main().catch((e) => {
  console.error("\nÉchec du seed :", e instanceof Error ? e.message : e);
  process.exit(1);
});
