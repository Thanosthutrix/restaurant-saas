/**
 * Historique des prix d’achat (mouvements `purchase` avec `unit_cost`).
 */

import { supabaseServer } from "@/lib/supabaseServer";

export type PurchasePriceMonthBucket = {
  /** Clé triable YYYY-MM */
  yearMonth: string;
  /** Libellé court pour l’UI */
  labelFr: string;
  /** Moyenne pondérée par quantités reçues (€ / unité de stock), null si aucun achat ce mois. */
  weightedAvgUnitCost: number | null;
  totalQty: number;
  movementCount: number;
};

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Dernier coût unitaire connu par article (une requête, ordre chronologique global). */
export async function getLastKnownPurchaseUnitCostByItemIds(
  restaurantId: string,
  itemIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (itemIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from("stock_movements")
    .select("inventory_item_id, unit_cost, occurred_at")
    .eq("restaurant_id", restaurantId)
    .eq("movement_type", "purchase")
    .in("inventory_item_id", itemIds)
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .order("occurred_at", { ascending: false });

  if (error || !data) return map;

  for (const row of data) {
    const id = (row as { inventory_item_id: string }).inventory_item_id;
    if (map.has(id)) continue;
    const c = Number((row as { unit_cost: unknown }).unit_cost);
    if (Number.isFinite(c) && c > 0) map.set(id, roundMoney(c));
  }
  return map;
}

function monthLabelFr(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

function yearMonthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Dernier coût unitaire connu (tous achats confondus). */
export async function getLastKnownPurchaseUnitCost(
  restaurantId: string,
  inventoryItemId: string
): Promise<{ unitCost: number | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("stock_movements")
    .select("unit_cost")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("movement_type", "purchase")
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { unitCost: null, error: new Error(error.message) };
  if (!data) return { unitCost: null, error: null };
  const n = Number((data as { unit_cost: unknown }).unit_cost);
  return { unitCost: Number.isFinite(n) && n > 0 ? roundMoney(n) : null, error: null };
}

export type PurchasePriceStats = {
  lastKnownUnitCost: number | null;
  /** Moyenne pondérée sur les achats des ~3 derniers mois glissants (occurred_at). */
  avgThreeMonthsWeighted: number | null;
  /** 3 mois calendaires (le mois courant + les 2 précédents), ordre chronologique. */
  monthlyBuckets: PurchasePriceMonthBucket[];
};

/**
 * Stats tarifaires pour la fiche composant : dernier prix, moyenne 3 mois glissants, détail par mois calendaire.
 */
export async function getPurchasePriceStatsForItem(
  restaurantId: string,
  inventoryItemId: string
): Promise<{ data: PurchasePriceStats; error: Error | null }> {
  const empty: PurchasePriceStats = {
    lastKnownUnitCost: null,
    avgThreeMonthsWeighted: null,
    monthlyBuckets: [],
  };

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: rows, error } = await supabaseServer
    .from("stock_movements")
    .select("quantity, unit_cost, occurred_at")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("movement_type", "purchase")
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .gte("occurred_at", threeMonthsAgo.toISOString())
    .order("occurred_at", { ascending: true });

  if (error) return { data: empty, error: new Error(error.message) };

  let rollSumQc = 0;
  let rollSumQ = 0;
  const byMonth = new Map<string, { sumQc: number; sumQ: number; count: number }>();

  for (const raw of rows ?? []) {
    const r = raw as { quantity: unknown; unit_cost: unknown; occurred_at: string };
    const q = Number(r.quantity);
    const c = Number(r.unit_cost);
    if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(c) || c <= 0) continue;
    const qc = q * c;
    rollSumQc += qc;
    rollSumQ += q;

    const ym = yearMonthKey(r.occurred_at);
    if (!ym) continue;
    const cur = byMonth.get(ym) ?? { sumQc: 0, sumQ: 0, count: 0 };
    cur.sumQc += qc;
    cur.sumQ += q;
    cur.count += 1;
    byMonth.set(ym, cur);
  }

  const avgThreeMonthsWeighted =
    rollSumQ > 0 ? roundMoney(rollSumQc / rollSumQ) : null;

  const monthKeys: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthlyBuckets: PurchasePriceMonthBucket[] = monthKeys.map((yearMonth) => {
    const agg = byMonth.get(yearMonth);
    if (!agg || agg.sumQ <= 0) {
      return {
        yearMonth,
        labelFr: monthLabelFr(yearMonth),
        weightedAvgUnitCost: null,
        totalQty: 0,
        movementCount: 0,
      };
    }
    return {
      yearMonth,
      labelFr: monthLabelFr(yearMonth),
      weightedAvgUnitCost: roundMoney(agg.sumQc / agg.sumQ),
      totalQty: roundMoney(agg.sumQ * 1000) / 1000,
      movementCount: agg.count,
    };
  });

  const last = await getLastKnownPurchaseUnitCost(restaurantId, inventoryItemId);
  if (last.error) return { data: empty, error: last.error };

  return {
    data: {
      lastKnownUnitCost: last.unitCost,
      avgThreeMonthsWeighted,
      monthlyBuckets,
    },
    error: null,
  };
}
