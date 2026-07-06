import type { MenuItem, Restaurant } from "@/lib/public/types";

/** Galerie publique : couverture, vignette, puis visuels des plats publics. */
export function buildRestaurantPhotoGallery(
  restaurant: Restaurant,
  menuItems: MenuItem[] = []
): string[] {
  const candidates = [
    restaurant.cover_url,
    restaurant.image_url,
    ...menuItems.map((item) => item.image_url),
  ].filter((url): url is string => Boolean(url?.trim()));

  return [...new Set(candidates)];
}
