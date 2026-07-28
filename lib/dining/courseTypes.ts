import { getMenuCategorySectionLabel, type MenuCategory } from "@/lib/public/menuCategories";

/** Services de repas dans l'ordre de service. */
export const MEAL_COURSE_ORDER = ["entrée", "plat", "dessert"] as const;

export type DiningMealCourse = (typeof MEAL_COURSE_ORDER)[number];

export function isMealCourse(value: string | null | undefined): value is DiningMealCourse {
  return value === "entrée" || value === "plat" || value === "dessert";
}

export function mealCourseFromMenuCategory(
  menuCategory: string | null | undefined
): DiningMealCourse | null {
  return isMealCourse(menuCategory) ? menuCategory : null;
}

export function mealCourseLabel(course: DiningMealCourse): string {
  return getMenuCategorySectionLabel(course as MenuCategory);
}

export function mealCourseReadyPushTitle(course: DiningMealCourse): string {
  if (course === "plat") return "Plats prêts";
  if (course === "dessert") return "Desserts prêts";
  return "Entrées prêtes";
}
