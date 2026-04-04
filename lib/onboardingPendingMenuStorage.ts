import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";

/** Clé sessionStorage — pas de données sensibles, uniquement le brouillon d’analyse carte. */
export const PENDING_ONBOARDING_MENU_KEY = "rs_pending_onboarding_menu_v1";

export type PendingOnboardingMenuStored = {
  v: 1;
  items: MenuSuggestionItem[];
};
