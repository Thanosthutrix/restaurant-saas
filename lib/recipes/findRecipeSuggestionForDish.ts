import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import {
  DISH_RECIPE_SUGGESTION_TEMPLATES,
  type SuggestedComponentTemplate,
} from "./recipeSuggestionTemplates";

export type RecipeSuggestion = {
  productionMode: "prepared" | "resale";
  components: SuggestedComponentTemplate[];
} | null;

/**
 * Trouve un template de suggestion applicable au plat à partir de son nom.
 * Matching par normalisation (lowercase, accents, stop words) sur les noms du catalogue.
 */
export function findRecipeSuggestionForDish(dishName: string): RecipeSuggestion {
  const normalized = normalizeDishLabel(dishName);
  if (!normalized) return null;

  for (const template of DISH_RECIPE_SUGGESTION_TEMPLATES) {
    for (const matchName of template.matchNames) {
      const templateNorm = normalizeDishLabel(matchName);
      if (!templateNorm) continue;
      if (normalized === templateNorm || normalized.includes(templateNorm) || templateNorm.includes(normalized)) {
        return {
          productionMode: template.productionMode ?? "prepared",
          components: template.components,
        };
      }
    }
  }
  return null;
}
