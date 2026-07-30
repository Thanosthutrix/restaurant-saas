import { isMealCourse } from "./courseTypes";

/** Catégories carte envoyées au pass bar (pas cuisine). */
export function isBarMenuCategory(menuCategory: string | null | undefined): boolean {
  return menuCategory === "boisson" || menuCategory === "vin";
}

/** Hors repas mais préparés en cuisine (ex. à partager). */
export function isKitchenExtraMenuCategory(menuCategory: string | null | undefined): boolean {
  if (menuCategory == null || menuCategory === "") return true;
  if (isMealCourse(menuCategory)) return false;
  return !isBarMenuCategory(menuCategory);
}

export function lineGoesToBarPass(params: {
  courseType: string | null | undefined;
  menuCategory: string | null | undefined;
}): boolean {
  return isBarMenuCategory(params.menuCategory);
}

export function lineGoesToKitchenPass(params: {
  courseType: string | null | undefined;
  menuCategory: string | null | undefined;
}): boolean {
  if (lineGoesToBarPass(params)) return false;
  if (params.courseType && isMealCourse(params.courseType)) return true;
  return isKitchenExtraMenuCategory(params.menuCategory);
}
