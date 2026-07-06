import {
  getListedRestaurantFromDb,
  listListedRestaurantsFromDb,
  listPublicMenuItemsFromDb,
  listPublicReviewsFromDb,
} from "@/lib/public/publicDb";
import type { MenuItem, Restaurant, RestaurantWithDetails, Review } from "@/lib/public/types";

/** Liste des restaurants visibles sur le portail B2C (is_public_listed = true). */
export async function listPublicRestaurants(): Promise<Restaurant[]> {
  return listListedRestaurantsFromDb();
}

/** Recherche textuelle côté serveur (nom, cuisine, adresse). */
export async function searchPublicRestaurants(query: string): Promise<Restaurant[]> {
  const q = query.trim().toLowerCase();
  const all = await listPublicRestaurants();
  if (!q) return all;

  return all.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.cuisine_type.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q)
  );
}

export async function getPublicRestaurant(id: string): Promise<Restaurant | null> {
  return getListedRestaurantFromDb(id);
}

export async function getPublicMenuItems(restaurantId: string): Promise<MenuItem[]> {
  return listPublicMenuItemsFromDb(restaurantId);
}

export async function getPublicReviews(restaurantId: string): Promise<Review[]> {
  return listPublicReviewsFromDb(restaurantId);
}

export async function getPublicRestaurantWithDetails(
  id: string
): Promise<RestaurantWithDetails | null> {
  const restaurant = await getPublicRestaurant(id);
  if (!restaurant) return null;

  const [menu_items, reviews] = await Promise.all([
    getPublicMenuItems(id),
    getPublicReviews(id),
  ]);

  return { ...restaurant, menu_items, reviews };
}
