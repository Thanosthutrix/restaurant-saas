/**
 * Helpers d'invalidation du cache Next.js.
 * À appeler dans les server actions après chaque mutation.
 * Import côté serveur uniquement ("use server" ou fichiers serveur).
 */
import { revalidateTag } from "next/cache";

export function invalidateDishesCache() {
  revalidateTag("dishes", "default");
}

export function invalidateSuppliersCache() {
  revalidateTag("suppliers", "default");
}

export function invalidateInventoryCache() {
  revalidateTag("inventory", "default");
}

export function invalidateHygieneElementsCache() {
  revalidateTag("hygiene-elements", "default");
}

export function invalidateTemperaturePointsCache() {
  revalidateTag("temperature-points", "default");
}

export function invalidateStaffCache() {
  revalidateTag("staff", "default");
}
