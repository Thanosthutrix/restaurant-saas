/**
 * Simulation « Ma poche » sur le restaurant de test (dev) — juin 2026.
 *
 *   CA HT        : 40 000,00 € (60 services valorisés via service_sales.line_total_ht)
 *   Personnel    : 5 employés au SMIC (11,88 €/h brut), 19 shifts × 8 h chacun (152 h)
 *   Factures     : 14 factures classées par poste (Metro, EDF, SACEM, Uber Eats…)
 *   Charges manu : loyer 2 500 €/mois, emprunt 950 €/mois, CFE 1 750 €/an
 *   Réglages     : charges patronales 42 %, impôts (IS) 25 %
 *
 * Idempotent : supprime d'abord ses propres données (marqueurs SIM-/[SIM]/juin 2026).
 * Usage : npx tsx scripts/seed-pocket-simulation.ts
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

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const RESTAURANT_NAME = "Resto Test Claude (dev)";
const SMIC_HOURLY = 11.88;
const JUNE = (d: number) => `2026-06-${String(d).padStart(2, "0")}`;

function fail(msg: string): never {
  console.error("ÉCHEC :", msg);
  process.exit(1);
}

async function main() {
  // ── Restaurant cible ────────────────────────────────────────────────────────
  const { data: resto } = await sb
    .from("restaurants")
    .select("id")
    .eq("name", RESTAURANT_NAME)
    .maybeSingle();
  if (!resto) fail(`restaurant « ${RESTAURANT_NAME} » introuvable`);
  const rid = (resto as { id: string }).id;
  console.log("Restaurant :", rid);

  const { data: dish } = await sb
    .from("dishes")
    .select("id")
    .eq("restaurant_id", rid)
    .limit(1)
    .maybeSingle();
  if (!dish) fail("aucun plat dans le restaurant de test");
  const dishId = (dish as { id: string }).id;

  // ── Nettoyage (idempotence) ─────────────────────────────────────────────────
  console.log("Nettoyage des données de simulation précédentes…");

  const { data: oldServices } = await sb
    .from("services")
    .select("id")
    .eq("restaurant_id", rid)
    .gte("service_date", JUNE(1))
    .lte("service_date", JUNE(30));
  const oldServiceIds = ((oldServices as { id: string }[]) ?? []).map((s) => s.id);
  if (oldServiceIds.length > 0) {
    await sb.from("service_sales").delete().in("service_id", oldServiceIds);
    await sb.from("services").delete().in("id", oldServiceIds);
  }

  await sb
    .from("work_shifts")
    .delete()
    .eq("restaurant_id", rid)
    .gte("starts_at", "2026-05-31T00:00:00Z")
    .lte("starts_at", "2026-07-01T23:59:59Z");
  await sb.from("staff_members").delete().eq("restaurant_id", rid).like("display_name", "Équipier SMIC%");

  const { data: oldInv } = await sb
    .from("supplier_invoices")
    .select("id")
    .eq("restaurant_id", rid)
    .like("invoice_number", "SIM-%");
  const oldInvIds = ((oldInv as { id: string }[]) ?? []).map((i) => i.id);
  if (oldInvIds.length > 0) {
    await sb.from("supplier_invoice_extracted_lines").delete().in("supplier_invoice_id", oldInvIds);
    await sb.from("supplier_invoices").delete().in("id", oldInvIds);
  }
  await sb.from("suppliers").delete().eq("restaurant_id", rid).like("name", "[SIM]%");
  await sb.from("restaurant_fixed_charges").delete().eq("restaurant_id", rid);

  // ── Réglages ───────────────────────────────────────────────────────────────
  await sb
    .from("restaurants")
    .update({ payroll_employer_pct: 42, pocket_tax_pct: 25 })
    .eq("id", rid);
  console.log("Réglages : charges patronales 42 %, impôts 25 % (IS).");

  // ── CA : 60 services (midi + soir, 30 jours) = 40 000,00 € HT exactement ───
  console.log("CA : 60 services sur juin…");
  const services: { restaurant_id: string; service_date: string; service_type: string }[] = [];
  for (let d = 1; d <= 30; d++) {
    services.push({ restaurant_id: rid, service_date: JUNE(d), service_type: "lunch" });
    services.push({ restaurant_id: rid, service_date: JUNE(d), service_type: "dinner" });
  }
  const { data: insServices, error: sErr } = await sb
    .from("services")
    .insert(services)
    .select("id");
  if (sErr || !insServices) fail("insertion services : " + sErr?.message);

  const perService = 666.67; // 59 × 666,67 + 666,47 = 40 000,00
  const sales = (insServices as { id: string }[]).map((s, idx) => ({
    restaurant_id: rid,
    service_id: s.id,
    dish_id: dishId,
    qty: 1,
    line_total_ht: idx === 59 ? 666.47 : perService,
  }));
  const { error: salesErr } = await sb.from("service_sales").insert(sales);
  if (salesErr) fail("insertion ventes : " + salesErr.message);
  console.log("  → 40 000,00 € HT répartis sur 60 services.");

  // ── Personnel : 5 employés SMIC, 19 shifts × 8 h chacun ─────────────────────
  console.log("Personnel : 5 employés au SMIC…");
  const staffRows = Array.from({ length: 5 }, (_, i) => ({
    restaurant_id: rid,
    display_name: `Équipier SMIC ${i + 1}`,
    role_label: i < 2 ? "Cuisine" : "Salle",
    app_role: "lecture_seule",
    active: true,
    hourly_gross_rate: SMIC_HOURLY,
  }));
  const { data: insStaff, error: stErr } = await sb
    .from("staff_members")
    .insert(staffRows)
    .select("id");
  if (stErr || !insStaff) fail("insertion staff : " + stErr?.message);

  // Jours ouvrés de juin 2026 (fermé le dimanche : 7, 14, 21, 28)
  const workdays: number[] = [];
  for (let d = 1; d <= 30; d++) {
    if (![7, 14, 21, 28].includes(d)) workdays.push(d);
  }
  const shifts: { restaurant_id: string; staff_member_id: string; starts_at: string; ends_at: string }[] = [];
  (insStaff as { id: string }[]).forEach((st, i) => {
    // 19 shifts de 8 h par employé (≈152 h/mois), départs décalés pour varier.
    const days = workdays.slice(i % 3, (i % 3) + 19);
    for (const d of days) {
      shifts.push({
        restaurant_id: rid,
        staff_member_id: st.id,
        starts_at: `${JUNE(d)}T08:00:00Z`, // 10h Paris
        ends_at: `${JUNE(d)}T16:00:00Z`, // 18h Paris
      });
    }
  });
  const { error: shErr } = await sb.from("work_shifts").insert(shifts);
  if (shErr) fail("insertion shifts : " + shErr.message);
  console.log(`  → ${shifts.length} shifts (5 × 19 × 8 h = 760 h planifiées).`);

  // ── Fournisseurs + factures classées ────────────────────────────────────────
  console.log("Factures fournisseurs…");
  const suppliers = [
    "[SIM] Metro France",
    "[SIM] Transgourmet Boissons",
    "[SIM] EDF Pro",
    "[SIM] Veolia Eau",
    "[SIM] AXA Assurances",
    "[SIM] GreaseNet Hottes",
    "[SIM] Elis Blanchisserie",
    "[SIM] Cabinet Comptable Durand",
    "[SIM] Uber Eats",
    "[SIM] SACEM",
    "[SIM] Mutuelle Hôtellerie",
  ];
  const { data: insSup, error: supErr } = await sb
    .from("suppliers")
    .insert(
      suppliers.map((name, i) => ({
        restaurant_id: rid,
        name,
        email: `sim-${i}@exemple.test`,
      }))
    )
    .select("id, name");
  if (supErr || !insSup) fail("insertion fournisseurs : " + supErr?.message);
  const supByName = new Map((insSup as { id: string; name: string }[]).map((s) => [s.name, s.id]));

  type Inv = { sup: string; num: string; date: string; ht: number; cat: string };
  const invoices: Inv[] = [
    // Matières premières — 11 250 € (28,1 % du CA)
    { sup: "[SIM] Metro France", num: "SIM-MET-01", date: JUNE(3), ht: 2450, cat: "matieres" },
    { sup: "[SIM] Metro France", num: "SIM-MET-02", date: JUNE(10), ht: 2320, cat: "matieres" },
    { sup: "[SIM] Metro France", num: "SIM-MET-03", date: JUNE(17), ht: 2280, cat: "matieres" },
    { sup: "[SIM] Metro France", num: "SIM-MET-04", date: JUNE(24), ht: 2150, cat: "matieres" },
    { sup: "[SIM] Transgourmet Boissons", num: "SIM-TRG-01", date: JUNE(5), ht: 820, cat: "matieres" },
    { sup: "[SIM] Transgourmet Boissons", num: "SIM-TRG-02", date: JUNE(19), ht: 780, cat: "matieres" },
    { sup: "[SIM] Metro France", num: "SIM-MET-05", date: JUNE(26), ht: 450, cat: "matieres" }, // emballages
    // Locaux & énergies — 1 230 €
    { sup: "[SIM] EDF Pro", num: "SIM-EDF-01", date: JUNE(8), ht: 780, cat: "locaux" },
    { sup: "[SIM] Veolia Eau", num: "SIM-VEO-01", date: JUNE(12), ht: 165, cat: "locaux" },
    { sup: "[SIM] AXA Assurances", num: "SIM-AXA-01", date: JUNE(1), ht: 285, cat: "locaux" },
    // Entretien — 430 €
    { sup: "[SIM] GreaseNet Hottes", num: "SIM-GRN-01", date: JUNE(15), ht: 190, cat: "entretien" },
    { sup: "[SIM] Elis Blanchisserie", num: "SIM-ELS-01", date: JUNE(20), ht: 240, cat: "entretien" },
    // Prestataires — 439 €
    { sup: "[SIM] Cabinet Comptable Durand", num: "SIM-CPT-01", date: JUNE(30), ht: 350, cat: "prestataires" },
    { sup: "[SIM] Cabinet Comptable Durand", num: "SIM-LOG-01", date: JUNE(2), ht: 89, cat: "prestataires" }, // logiciel caisse
    // Marketing & banque — 1 030 €
    { sup: "[SIM] Uber Eats", num: "SIM-UBE-01", date: JUNE(30), ht: 620, cat: "marketing_banque" },
    { sup: "[SIM] Uber Eats", num: "SIM-TPE-01", date: JUNE(30), ht: 410, cat: "marketing_banque" }, // frais TPE
    // Impôts & taxes — 92 €
    { sup: "[SIM] SACEM", num: "SIM-SAC-01", date: JUNE(6), ht: 92, cat: "impots_taxes" },
    // RH — 260 €
    { sup: "[SIM] Mutuelle Hôtellerie", num: "SIM-MUT-01", date: JUNE(1), ht: 260, cat: "rh" },
  ];
  const { error: invErr } = await sb.from("supplier_invoices").insert(
    invoices.map((i) => ({
      restaurant_id: rid,
      supplier_id: supByName.get(i.sup),
      invoice_number: i.num,
      invoice_date: i.date,
      amount_ht: i.ht,
      amount_ttc: Math.round(i.ht * 1.2 * 100) / 100,
      status: "draft",
      expense_category: i.cat,
    }))
  );
  if (invErr) fail("insertion factures : " + invErr.message);
  const totalInvoices = invoices.reduce((s, i) => s + i.ht, 0);
  console.log(`  → ${invoices.length} factures, ${totalInvoices.toFixed(2)} € HT.`);

  // ── Charges manuelles (sans facture) ────────────────────────────────────────
  const { error: chErr } = await sb.from("restaurant_fixed_charges").insert([
    { restaurant_id: rid, label: "Loyer commercial", monthly_amount: 2500, category: "locaux", periodicity: "monthly" },
    { restaurant_id: rid, label: "Échéance emprunt banque", monthly_amount: 950, category: "financier", periodicity: "monthly" },
    { restaurant_id: rid, label: "CFE", monthly_amount: 1750, category: "impots_taxes", periodicity: "yearly" },
  ]);
  if (chErr) fail("insertion charges : " + chErr.message);
  console.log("  → loyer 2 500 €/mois, emprunt 950 €/mois, CFE 1 750 €/an.");

  // ── Attendu (mode trésorerie, juin = mois complet → charges mensuelles pleines) ──
  const labor = 5 * Math.round(152 * SMIC_HOURLY * 1.42 * 100) / 100;
  const loyer = 2500; // mois complet = montant plein
  const emprunt = 950;
  const cfe = 1750 / 12; // annuelle ÷ 12 par mois couvert
  const dep = 11250 + (labor + 260) + (1230 + loyer) + 430 + 439 + 1030 + (92 + cfe) + emprunt;
  const res = 40000 - dep;
  const poche = res * 0.75;
  console.log("\n── ATTENDU (trésorerie) ──");
  console.log(`  Masse salariale chargée : ${labor.toFixed(2)} €`);
  console.log(`  Total dépenses          : ${dep.toFixed(2)} €`);
  console.log(`  Résultat                : ${res.toFixed(2)} €  |  IS 25 % : ${(res * 0.25).toFixed(2)} €`);
  console.log(`  DANS LA POCHE           : ${poche.toFixed(2)} €`);
  console.log("\nSimulation prête → /pilotage/bilan?p=lastmonth&m=cash");
}

main();
