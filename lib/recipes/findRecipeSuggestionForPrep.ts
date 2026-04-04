import { normalizeInventoryItemName } from "./normalizeInventoryItemName";
import {
  PREP_RECIPE_SUGGESTION_TEMPLATES,
  type SuggestedComponentTemplate,
} from "./recipeSuggestionTemplates";

export type PrepRecipeSuggestion = {
  components: SuggestedComponentTemplate[];
} | null;

/**
 * Trouve un template de suggestion de composition applicable à une préparation (inventory_item type prep).
 * Matching par normalisation (lowercase, trim, accents) sur les noms du catalogue.
 */
export function findRecipeSuggestionForPrep(prepName: string): PrepRecipeSuggestion {
  const normalized = normalizeInventoryItemName(prepName);
  if (!normalized) return null;

  for (const template of PREP_RECIPE_SUGGESTION_TEMPLATES) {
    for (const matchName of template.matchNames) {
      const templateNorm = normalizeInventoryItemName(matchName);
      if (!templateNorm) continue;
      if (normalized === templateNorm || normalized.includes(templateNorm) || templateNorm.includes(normalized)) {
        return { components: template.components };
      }
    }
  }
  return null;
}
