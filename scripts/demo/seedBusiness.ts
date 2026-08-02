/**
 * Vie commerciale et gestion : clientèle, réservations, commandes fournisseurs,
 * charges fixes et historique de chiffre d'affaires.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { INGREDIENTS, SUPPLIERS, type SupplierKey } from "./catalog";
import type { ServiceRecord } from "./seedOperations";
import { addDays, dayOfWeek, insertChunked, makeRng, parisToUtcIso, randInt, round2 } from "./util";

// ---------------------------------------------------------------------------
// CLIENTÈLE
// ---------------------------------------------------------------------------

const CUSTOMERS = [
  { first: "Claire", last: "Fontaine", email: "claire.fontaine@example.fr", phone: "+33612345601", tags: ["Habitué"], note: "Table au calme, allergie aux fruits à coque." },
  { first: "Julien", last: "Moreau", email: "julien.moreau@example.fr", phone: "+33612345602", tags: ["Habitué", "VIP"], note: "Vient chaque jeudi soir, aime le Sancerre." },
  { first: "Sabrina", last: "Haddad", email: "sabrina.haddad@example.fr", phone: "+33612345603", tags: ["Entreprise"], note: "Déjeuners d'affaires, facture au nom de la société." },
  { first: "Thomas", last: "Girard", email: "thomas.girard@example.fr", phone: "+33612345604", tags: [], note: null },
  { first: "Léa", last: "Bernard", email: "lea.bernard@example.fr", phone: "+33612345605", tags: ["Habitué"], note: "Végétarienne." },
  { first: "Marc", last: "Olivier", email: "marc.olivier@example.fr", phone: "+33612345606", tags: ["Entreprise"], note: "Réserve la grande table 12 pour ses équipes." },
  { first: "Nadia", last: "Belkacem", email: "nadia.belkacem@example.fr", phone: "+33612345607", tags: ["VIP"], note: "Anniversaire en octobre, apprécie le champagne." },
  { first: "Hugo", last: "Lefevre", email: "hugo.lefevre@example.fr", phone: "+33612345608", tags: [], note: null },
];

const TAGS = [
  { label: "Habitué", color: "#0ea5e9" },
  { label: "VIP", color: "#f59e0b" },
  { label: "Entreprise", color: "#6366f1" },
];

export async function seedCustomers(
  sb: SupabaseClient,
  restaurantId: string,
  today: string
): Promise<{ customerIds: string[]; timeline: number }> {
  const rng = makeRng(777);

  const { data: tagRows, error: tagErr } = await sb
    .from("customer_tags")
    .insert(TAGS.map((t) => ({ restaurant_id: restaurantId, label: t.label, color: t.color })))
    .select("id, label");
  if (tagErr) throw new Error(`Étiquettes clients : ${tagErr.message}`);
  const tagIds = new Map((tagRows as { id: string; label: string }[]).map((t) => [t.label, t.id]));

  const customerIds: string[] = [];
  const assignments: Record<string, unknown>[] = [];
  const timeline: Record<string, unknown>[] = [];

  for (const c of CUSTOMERS) {
    const { data, error } = await sb
      .from("restaurant_customers")
      .insert({
        restaurant_id: restaurantId,
        display_name: `${c.first} ${c.last}`,
        first_name: c.first,
        last_name: c.last,
        email: c.email,
        phone: c.phone,
        preferred_locale: "fr",
        service_memo: c.note,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Client « ${c.first} ${c.last} » : ${error.message}`);
    const id = (data as { id: string }).id;
    customerIds.push(id);

    for (const t of c.tags) {
      const tagId = tagIds.get(t);
      if (tagId) assignments.push({ customer_id: id, tag_id: tagId });
    }

    // Historique : quelques visites passées par client.
    const visits = c.tags.includes("Habitué") ? randInt(rng, 5, 9) : randInt(rng, 1, 4);
    for (let v = 0; v < visits; v++) {
      const day = addDays(today, -randInt(rng, 3, 85));
      timeline.push({
        restaurant_id: restaurantId,
        customer_id: id,
        event_type: "visit",
        occurred_at: parisToUtcIso(day, "20:45"),
        title: "Venue au restaurant",
        body: `Table de ${randInt(rng, 2, 6)} couverts.`,
      });
    }
  }

  if (assignments.length) {
    const { error } = await sb.from("customer_tag_assignments").insert(assignments);
    if (error) throw new Error(`Étiquettes attribuées : ${error.message}`);
  }
  await insertChunked(sb, "customer_timeline_events", timeline);

  return { customerIds, timeline: timeline.length };
}

// ---------------------------------------------------------------------------
// RÉSERVATIONS
// ---------------------------------------------------------------------------

export async function seedReservations(
  sb: SupabaseClient,
  restaurantId: string,
  customerIds: string[],
  opts: { today: string; openDays: number[] }
): Promise<number> {
  const rng = makeRng(2024);
  const rows: Record<string, unknown>[] = [];

  // Trois semaines passées (honorées) et deux semaines à venir (confirmées).
  for (let d = -21; d <= 14; d++) {
    const date = addDays(opts.today, d);
    if (!opts.openDays.includes(dayOfWeek(date))) continue;

    const count = dayOfWeek(date) >= 5 ? randInt(rng, 3, 5) : randInt(rng, 1, 3);
    for (let i = 0; i < count; i++) {
      const dinner = rng() > 0.35;
      const hour = dinner ? randInt(rng, 19, 21) : randInt(rng, 12, 13);
      const startsAt = parisToUtcIso(date, `${String(hour).padStart(2, "0")}:${rng() > 0.5 ? "30" : "00"}`);
      const endsAt = new Date(Date.parse(startsAt) + 105 * 60000).toISOString();
      const withAccount = rng() > 0.4;
      const customerId = withAccount ? customerIds[randInt(rng, 0, customerIds.length - 1)] : null;

      const past = date < opts.today;
      // Les réservations passées sont honorées, sauf de rares annulations.
      const status = past
        ? rng() < 0.08 ? (rng() < 0.5 ? "cancelled" : "no_show") : "completed"
        : rng() < 0.2 ? "pending" : "confirmed";

      rows.push({
        restaurant_id: restaurantId,
        customer_id: customerId,
        party_size: randInt(rng, 2, dayOfWeek(date) >= 5 ? 6 : 4),
        starts_at: startsAt,
        ends_at: endsAt,
        status,
        contact_name: customerId ? null : `Client ${randInt(rng, 100, 999)}`,
        contact_phone: customerId ? null : `+3361234${randInt(rng, 1000, 9999)}`,
        notes: rng() < 0.2 ? "Demande une table près de la fenêtre." : null,
        source: rng() < 0.6 ? "phone" : rng() < 0.8 ? "website" : "walk_in",
        created_at: parisToUtcIso(addDays(date, -randInt(rng, 1, 10)), "10:00"),
      });
    }
  }

  await insertChunked(sb, "restaurant_reservations", rows);
  return rows.length;
}

// ---------------------------------------------------------------------------
// COMMANDES FOURNISSEURS
// ---------------------------------------------------------------------------

/**
 * Commandes récentes : une par fournisseur, reprenant les articles dont le stock
 * est le plus sollicité. Les commandes passées sont réceptionnées, la dernière
 * est encore attendue.
 */
export async function seedPurchaseOrders(
  sb: SupabaseClient,
  restaurantId: string,
  supplierIds: Map<SupplierKey, string>,
  itemIds: Map<string, string>,
  today: string
): Promise<{ orders: number; lines: number }> {
  const rng = makeRng(8080);
  let orders = 0;
  let lines = 0;

  for (const [key, supplier] of Object.entries(SUPPLIERS) as [SupplierKey, typeof SUPPLIERS[SupplierKey]][]) {
    const supplierId = supplierIds.get(key);
    if (!supplierId) continue;

    const items = INGREDIENTS.filter((i) => i.supplier === key);
    if (items.length === 0) continue;

    // Une commande passée (reçue) et une commande à venir.
    for (const [offset, status] of [[-9, "received"], [2, "expected_delivery"]] as const) {
      const orderDate = addDays(today, offset);
      const expected = addDays(orderDate, supplier.leadDays);

      const selected = items.slice(0, Math.min(items.length, randInt(rng, 4, 8)));
      const message = [
        `Bonjour ${supplier.contact_name},`,
        "",
        "Merci de nous livrer la commande suivante :",
        ...selected.map((i) => {
          const packs = Math.max(1, Math.round((i.targetStock / i.unitsPerPurchase) * 0.5));
          return `— ${i.name} : ${packs} × ${i.purchaseUnit}`;
        }),
        "",
        `Livraison souhaitée le ${expected}.`,
        "",
        "Cordialement,",
        "Le Comptoir du Marché — 14 rue du Marché Saint-Honoré, 75001 Paris",
      ].join("\n");

      const { data, error } = await sb
        .from("purchase_orders")
        .insert({
          restaurant_id: restaurantId,
          supplier_id: supplierId,
          status,
          generated_message: message,
          expected_delivery_date: expected,
          created_at: parisToUtcIso(orderDate, "16:30"),
        })
        .select("id")
        .single();
      if (error) throw new Error(`Commande ${supplier.name} : ${error.message}`);
      const orderId = (data as { id: string }).id;
      orders++;

      const lineRows = selected.map((i) => {
        const packs = Math.max(1, Math.round((i.targetStock / i.unitsPerPurchase) * 0.5));
        return {
          purchase_order_id: orderId,
          inventory_item_id: itemIds.get(i.name)!,
          ordered_qty_purchase_unit: packs,
          purchase_unit: i.purchaseUnit,
          purchase_to_stock_ratio: i.unitsPerPurchase,
          item_name_snapshot: i.name,
          supplier_sku_snapshot: null,
        };
      });
      const { error: lErr } = await sb.from("purchase_order_lines").insert(lineRows);
      if (lErr) throw new Error(`Lignes de commande ${supplier.name} : ${lErr.message}`);
      lines += lineRows.length;
    }
  }

  return { orders, lines };
}

// ---------------------------------------------------------------------------
// CHARGES FIXES ET CHIFFRE D'AFFAIRES
// ---------------------------------------------------------------------------

const FIXED_CHARGES = [
  { label: "Loyer et charges locatives", amount: 5800 },
  { label: "Électricité et gaz", amount: 1450 },
  { label: "Eau", amount: 280 },
  { label: "Assurance multirisque", amount: 340 },
  { label: "Expert-comptable", amount: 520 },
  { label: "Logiciels et caisse", amount: 210 },
  { label: "Blanchisserie", amount: 380 },
  { label: "Collecte des déchets", amount: 160 },
  { label: "Abonnements télécom et internet", amount: 95 },
];

export async function seedFixedCharges(sb: SupabaseClient, restaurantId: string): Promise<number> {
  const rows = FIXED_CHARGES.map((c, i) => ({
    restaurant_id: restaurantId,
    label: c.label,
    monthly_amount: c.amount,
    active: true,
    sort_order: i,
  }));
  const { error } = await sb.from("restaurant_fixed_charges").insert(rows);
  if (error) throw new Error(`Charges fixes : ${error.message}`);
  return rows.length;
}

/** Historique de CA mensuel, reconstitué à partir des ventes réellement enregistrées. */
export async function seedMonthlyRevenue(
  sb: SupabaseClient,
  restaurantId: string,
  services: ServiceRecord[]
): Promise<number> {
  const byMonth = new Map<string, number>();
  for (const s of services) {
    const month = `${s.date.slice(0, 7)}-01`;
    byMonth.set(month, (byMonth.get(month) ?? 0) + s.revenueHt);
  }

  const rows = [...byMonth.entries()].map(([month, ht]) => ({
    restaurant_id: restaurantId,
    month,
    revenue_ht: round2(ht),
    // TVA moyenne pondérée observée en brasserie (10 % nourriture, 20 % alcools).
    revenue_ttc: round2(ht * 1.115),
    source_label: "Relevés de caisse",
    notes: "Cumul des services enregistrés dans l'application.",
  }));

  const { error } = await sb.from("restaurant_monthly_revenues").insert(rows);
  if (error) throw new Error(`CA mensuel : ${error.message}`);
  return rows.length;
}
