import { cache } from "react";
import {
  getListedRestaurantFromDb,
  getListedRestaurantSocialFromDb,
  listListedRestaurantsFromDb,
  listPublicMenuItemsFromDb,
  listPublicReviewsFromDb,
  listPublicSetMenusFromDb,
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

/**
 * Mémoïsé avec React `cache()` : cette fonction est appelée deux fois par requête sur
 * /restaurant/[id] (generateMetadata + le composant page). Le cache déduplique ces
 * appels au sein d'un même rendu → évite de refaire ~4 requêtes DB inutilement.
 */
export const getPublicRestaurantWithDetails = cache(async function getPublicRestaurantWithDetails(
  id: string
): Promise<RestaurantWithDetails | null> {
  const restaurant = await getPublicRestaurant(id);
  if (!restaurant) return null;

  const [menu_items, set_menus, reviews, social] = await Promise.all([
    getPublicMenuItems(id),
    listPublicSetMenusFromDb(id),
    getPublicReviews(id),
    getListedRestaurantSocialFromDb(id),
  ]);

  return {
    ...restaurant,
    menu_items,
    set_menus,
    reviews,
    social_stories: social.stories,
  };
});
