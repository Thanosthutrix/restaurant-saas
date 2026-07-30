import { getMenuCategorySectionLabel, type MenuCategory } from "@/lib/public/menuCategories";

/** Services de repas dans l'ordre de service. */
export const MEAL_COURSE_ORDER = ["entrée", "plat", "dessert"] as const;

export type DiningMealCourse = (typeof MEAL_COURSE_ORDER)[number];

export function isMealCourse(value: string | null | undefined): value is DiningMealCourse {
  return value === "entrée" || value === "plat" || value === "dessert";
}

function normalizeRubricName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Mots-clés de rubriques carte → service repas (segment ou libellé complet). */
const MEAL_RUBRIC_PATTERNS: Record<DiningMealCourse, RegExp[]> = {
  entrée: [/\bentree/, /\bentrees/, /\bhors.?d.?oeuvre/, /\bstarter/, /\bstarters/],
  plat: [/\bplat\b/, /\bplats\b/, /\bprincipal/, /\bprincipaux/, /\bmain\b/, /\bmains\b/],
  dessert: [/\bdessert/, /\bdesserts/],
};

export function mealCourseFromRubricName(name: string | null | undefined): DiningMealCourse | null {
  if (!name?.trim()) return null;
  const normalized = normalizeRubricName(name);
  for (const course of MEAL_COURSE_ORDER) {
    if (MEAL_RUBRIC_PATTERNS[course].some((pattern) => pattern.test(normalized))) {
      return course;
    }
  }
  return null;
}

/** Chemin rubrique « Entrées › … » — dernier segment repas reconnu. */
export function mealCourseFromCategoryPath(path: string | null | undefined): DiningMealCourse | null {
  if (!path?.trim()) return null;
  let found: DiningMealCourse | null = null;
  for (const segment of path
    .split(/\s*›\s*/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const course = mealCourseFromRubricName(segment);
    if (course) found = course;
  }
  return found;
}

export function mealCourseFromMenuCategory(
  menuCategory: string | null | undefined
): DiningMealCourse | null {
  return isMealCourse(menuCategory) ? menuCategory : null;
}

/** Service repas effectif : rubrique carte > menu_category > course_type enregistré. */
export function resolveMealCourse(params: {
  menuCategory?: string | null;
  categoryPath?: string | null;
  storedCourseType?: string | null;
}): DiningMealCourse | null {
  const fromPath = mealCourseFromCategoryPath(params.categoryPath);
  if (fromPath) return fromPath;
  const fromMenu = mealCourseFromMenuCategory(params.menuCategory);
  if (fromMenu) return fromMenu;
  return isMealCourse(params.storedCourseType) ? params.storedCourseType : null;
}

export function mealCourseLabel(course: DiningMealCourse): string {
  return getMenuCategorySectionLabel(course as MenuCategory);
}

export function mealCourseReadyPushTitle(course: DiningMealCourse): string {
  if (course === "plat") return "Plats prêts";
  if (course === "dessert") return "Desserts prêts";
  return "Entrées prêtes";
}
