import type { Dish, InventoryItem } from "@/lib/db";
import {
  getRestaurantTemplateBySlug,
  type RestaurantTemplateComponent,
  type RestaurantTemplateSuggestedDish,
} from "@/lib/templates/restaurantTemplates";

export type TemplateSuggestions = {
  missingComponents: RestaurantTemplateComponent[];
  missingDishes: RestaurantTemplateSuggestedDish[];
  allSuggestedDishes: RestaurantTemplateSuggestedDish[];
};

export function buildTemplateSuggestionsFromRows({
  templateSlug,
  inventoryItems,
  dishes,
}: {
  templateSlug: string | null | undefined;
  inventoryItems: Pick<InventoryItem, "name">[];
  dishes: Pick<Dish, "name">[];
}): TemplateSuggestions | null {
  const slug = templateSlug?.trim();
  if (!slug) return null;

  const template = getRestaurantTemplateBySlug(slug);
  if (!template) return null;

  const existingInvNames = new Set(inventoryItems.map((i) => i.name.toLowerCase().trim()));
  const existingDishNames = new Set(dishes.map((d) => d.name.toLowerCase().trim()));

  return {
    missingComponents: template.components.filter((c) => !existingInvNames.has(c.name.trim().toLowerCase())),
    missingDishes: template.suggestedDishes.filter((d) => !existingDishNames.has(d.name.trim().toLowerCase())),
    allSuggestedDishes: template.suggestedDishes,
  };
}
