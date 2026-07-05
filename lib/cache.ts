/**
 * Cache Next.js (unstable_cache) sur les données "froides" — listes qui changent
 * rarement et peuvent être mises en cache quelques minutes entre les requêtes.
 *
 * Tags d'invalidation : les server actions appellent revalidateTag() après mutation.
 * Durée : 5 min (revalidate: 300).
 */

import { unstable_cache } from "next/cache";
import { getDishes, getSuppliers, getInventoryItems } from "@/lib/db";
import { listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { loadDiningOrderCatalogData } from "@/lib/dining/diningOrderViewData";
import { listHygieneElements, listColdHygieneElements, ensureHygieneTasksForRestaurant } from "@/lib/hygiene/hygieneDb";
import { listTemperaturePoints, ensureTemperatureTasksForRestaurant } from "@/lib/haccpTemperature/haccpTemperatureDb";
import { listStaffMembers } from "@/lib/staff/staffDb";

const TTL = 300; // 5 minutes

// ─── Plats ─────────────────────────────────────────────────────────────────────

export function cachedGetDishes(restaurantId: string) {
  return unstable_cache(
    () => getDishes(restaurantId),
    ["dishes", restaurantId],
    { revalidate: TTL, tags: ["dishes"] }
  )();
}

export function cachedListRestaurantCategories(restaurantId: string) {
  return unstable_cache(
    () => listRestaurantCategories(restaurantId),
    ["categories", restaurantId],
    { revalidate: TTL, tags: ["categories"] }
  )();
}

/** Carte salle/caisse (arborescence + plats par catégorie), cache 5 min. */
export function cachedLoadDiningOrderCatalogData(restaurantId: string) {
  return unstable_cache(
    () => loadDiningOrderCatalogData(restaurantId),
    ["dining-catalog", restaurantId],
    { revalidate: TTL, tags: ["dishes", "categories"] }
  )();
}

// ─── Fournisseurs ──────────────────────────────────────────────────────────────

export function cachedGetSuppliers(restaurantId: string, activeOnly?: boolean) {
  return unstable_cache(
    () => getSuppliers(restaurantId, activeOnly),
    ["suppliers", restaurantId, String(activeOnly ?? "all")],
    { revalidate: TTL, tags: ["suppliers"] }
  )();
}

// ─── Inventaire ────────────────────────────────────────────────────────────────

export function cachedGetInventoryItems(restaurantId: string) {
  return unstable_cache(
    () => getInventoryItems(restaurantId),
    ["inventory", restaurantId],
    { revalidate: TTL, tags: ["inventory"] }
  )();
}

// ─── Éléments hygiène ──────────────────────────────────────────────────────────

export function cachedListHygieneElements(restaurantId: string) {
  return unstable_cache(
    () => listHygieneElements(restaurantId),
    ["hygiene-elements", restaurantId],
    { revalidate: TTL, tags: ["hygiene-elements"] }
  )();
}

export function cachedListColdHygieneElements(restaurantId: string) {
  return unstable_cache(
    () => listColdHygieneElements(restaurantId),
    ["cold-hygiene-elements", restaurantId],
    { revalidate: TTL, tags: ["hygiene-elements"] }
  )();
}

// ─── Points de température ─────────────────────────────────────────────────────

export function cachedListTemperaturePoints(restaurantId: string) {
  return unstable_cache(
    () => listTemperaturePoints(restaurantId),
    ["temperature-points", restaurantId],
    { revalidate: TTL, tags: ["temperature-points"] }
  )();
}

// ─── Ensure hygiene/temperature tasks (génération périodique, max 1×/min) ──────

export function cachedEnsureHygieneTasks(restaurantId: string) {
  return unstable_cache(
    () => ensureHygieneTasksForRestaurant(restaurantId, 14),
    ["ensure-hygiene-tasks", restaurantId],
    { revalidate: 60 }
  )();
}

export function cachedEnsureTemperatureTasks(restaurantId: string) {
  return unstable_cache(
    () => ensureTemperatureTasksForRestaurant(restaurantId, 14),
    ["ensure-temperature-tasks", restaurantId],
    { revalidate: 60 }
  )();
}

// ─── Badge hygiène (sidebar) ───────────────────────────────────────────────────

export function cachedCountHygienePending(restaurantId: string) {
  return unstable_cache(
    async () => {
      const { countDashboardHygienePending } = await import("@/lib/dashboard/hygieneTileData");
      return countDashboardHygienePending(restaurantId);
    },
    ["hygiene-pending-count", restaurantId],
    { revalidate: 60, tags: ["hygiene-elements", "temperature-points"] }
  )();
}

// ─── Badge préparations (contrôle +2 h : rappel bleu / retard rouge) ────────────

export function cachedCountPreparations2hSignals(restaurantId: string) {
  return unstable_cache(
    async () => {
      const { countPreparations2hSignals } = await import("@/lib/preparations/preparationsDb");
      return countPreparations2hSignals(restaurantId);
    },
    ["preparations-2h-signals", restaurantId],
    { revalidate: 30, tags: ["preparations"] }
  )();
}

// ─── Staff ─────────────────────────────────────────────────────────────────────

export function cachedListStaffMembers(restaurantId: string) {
  return unstable_cache(
    () => listStaffMembers(restaurantId),
    ["staff", restaurantId],
    { revalidate: TTL, tags: ["staff"] }
  )();
}
