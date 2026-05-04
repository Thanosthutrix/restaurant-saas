import {
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  PENDING_ONBOARDING_INGREDIENT_CATEGORIES_KEY,
  PENDING_ONBOARDING_POST_CATEGORIES_FLOW_KEY,
} from "@/lib/onboardingPendingMenuStorage";

export function setPostCategoriesOnboardingFlowActive(): void {
  try {
    sessionStorage.setItem(PENDING_ONBOARDING_POST_CATEGORIES_FLOW_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isPostCategoriesOnboardingFlowActive(): boolean {
  try {
    return sessionStorage.getItem(PENDING_ONBOARDING_POST_CATEGORIES_FLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPostCategoriesOnboardingFlowFlag(): void {
  try {
    sessionStorage.removeItem(PENDING_ONBOARDING_POST_CATEGORIES_FLOW_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPendingIngredientCategoriesInSession(): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_ONBOARDING_INGREDIENT_CATEGORIES_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { v?: number; assignments?: unknown[] };
    return data?.v === 1 && Array.isArray(data.assignments) && data.assignments.length > 0;
  } catch {
    return false;
  }
}

export function hasPendingEquipmentInSession(): boolean {
  try {
    return Boolean(sessionStorage.getItem(PENDING_ONBOARDING_EQUIPMENT_KEY));
  } catch {
    return false;
  }
}

/** Après l’étape relevés de CA (onboarding post-rubriques carte). */
export function navigateToNextOnboardingAfterRevenueStep(router: {
  push: (href: string) => void;
  refresh: () => void;
}): void {
  clearPostCategoriesOnboardingFlowFlag();
  if (hasPendingIngredientCategoriesInSession()) {
    router.push("/onboarding/review-ingredient-categories");
    return;
  }
  if (hasPendingEquipmentInSession()) {
    router.push("/onboarding/review-equipment");
    return;
  }
  router.push("/dashboard");
  router.refresh();
}
