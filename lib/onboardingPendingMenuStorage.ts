import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import type { EquipmentInventorySuggestion } from "@/lib/equipment-inventory-analysis";
import type { RecipePhotoSuggestion } from "@/lib/recipe-photo-analysis";

/** Clé sessionStorage — pas de données sensibles, uniquement le brouillon d’analyse carte. */
export const PENDING_ONBOARDING_MENU_KEY = "rs_pending_onboarding_menu_v1";
export const PENDING_ONBOARDING_RECIPES_KEY = "rs_pending_onboarding_recipes_v1";
export const PENDING_ONBOARDING_CATEGORIES_KEY = "rs_pending_onboarding_categories_v1";
/** Rubriques composants stock — après rubriques carte ; dérivé des recettes analysées. */
export const PENDING_ONBOARDING_INGREDIENT_CATEGORIES_KEY = "rs_pending_onboarding_ingredient_categories_v1";
export const PENDING_ONBOARDING_PURCHASE_PRICES_KEY = "rs_pending_onboarding_purchase_prices_v1";
export const PENDING_ONBOARDING_EQUIPMENT_KEY = "rs_pending_onboarding_equipment_v1";
/** Après rubriques carte : enchaînement factures → CA → rubriques composants / équipement (session). */
export const PENDING_ONBOARDING_POST_CATEGORIES_FLOW_KEY = "rs_onboarding_post_categories_flow_v1";

export type PendingOnboardingCategoryAssignment = {
  dish_name: string;
  normalized_label: string;
  suggested_category: string;
};

export type PendingOnboardingPurchasePriceSuggestion = {
  invoice_id: string;
  extracted_line_id: string;
  supplier_id: string | null;
  label: string;
  quantity: number | null;
  unit: string | null;
  unit_price_ht: number | null;
  line_total_ht: number | null;
  suggested_inventory_item_id: string | null;
  suggested_inventory_item_name: string | null;
};

export type PendingOnboardingMenuStored = {
  v: 1;
  items: MenuSuggestionItem[];
};

export type PendingOnboardingRecipesStored = {
  v: 1;
  items: RecipePhotoSuggestion[];
};

export type PendingOnboardingIngredientCategoryAssignment = {
  ingredient_name: string;
  normalized_label: string;
  suggested_category: string;
};

export type PendingOnboardingIngredientCategoriesStored = {
  v: 1;
  assignments: PendingOnboardingIngredientCategoryAssignment[];
};

export type PendingOnboardingCategoriesStored = {
  v: 1;
  assignments: PendingOnboardingCategoryAssignment[];
};

export type PendingOnboardingPurchasePricesStored = {
  v: 1;
  items: PendingOnboardingPurchasePriceSuggestion[];
};

export type PendingOnboardingEquipmentStored = {
  v: 1;
  items: EquipmentInventorySuggestion[];
};
