import { isMealCourse, mealCourseFromCategoryPath, resolveMealCourse } from "./courseTypes";

function normalizeRubricName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Mots-clés de rubriques carte routées vers le pass bar (segment ou libellé complet). */
const BAR_RUBRIC_PATTERNS: RegExp[] = [
  /\bboisson/,
  /\bvin\b|\bvins\b/,
  /\bcocktail/,
  /\baperitif/,
  /\bdigestif/,
  /\bbiere/,
  /\bchampagne/,
  /\bspiritueux/,
  /\bsoft\b|\bsofts\b/,
  /\bcafe\b|\bcafes\b/,
  /\bthe\b|\bthes\b/,
  /\bbar\b/,
  /\bcave\b/,
  /\bliquor\b|\bliqueur/,
];

/** Un segment de rubrique (ex. « Cocktails », « Vins rouges ») va au bar. */
export function isBarRubricName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const normalized = normalizeRubricName(name);
  return BAR_RUBRIC_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Chemin rubrique « Boissons › Softs › … » — vrai si un segment correspond. */
export function isBarCategoryPath(path: string | null | undefined): boolean {
  if (!path?.trim()) return false;
  return path
    .split(/\s*›\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .some(isBarRubricName);
}

/** Catégories carte (menu_category plat) envoyées au pass bar si pas de rubrique. */
export function isBarMenuCategory(menuCategory: string | null | undefined): boolean {
  return menuCategory === "boisson" || menuCategory === "vin";
}

export function lineGoesToBarPass(params: {
  courseType?: string | null | undefined;
  menuCategory: string | null | undefined;
  categoryPath?: string | null | undefined;
}): boolean {
  if (isBarCategoryPath(params.categoryPath)) return true;
  return isBarMenuCategory(params.menuCategory);
}

/** Hors repas mais préparés en cuisine (ex. à partager). */
export function isKitchenExtraMenuCategory(
  menuCategory: string | null | undefined,
  categoryPath?: string | null | undefined
): boolean {
  if (lineGoesToBarPass({ menuCategory, categoryPath })) return false;
  if (mealCourseFromCategoryPath(categoryPath)) return false;
  if (menuCategory != null && isMealCourse(menuCategory)) return false;
  if (menuCategory == null || menuCategory === "") return true;
  return menuCategory === "à_partager" || !isBarMenuCategory(menuCategory);
}

export function lineGoesToKitchenPass(params: {
  courseType: string | null | undefined;
  menuCategory: string | null | undefined;
  categoryPath?: string | null | undefined;
}): boolean {
  if (lineGoesToBarPass(params)) return false;
  if (
    resolveMealCourse({
      storedCourseType: params.courseType,
      menuCategory: params.menuCategory,
      categoryPath: params.categoryPath,
    })
  ) {
    return true;
  }
  return isKitchenExtraMenuCategory(params.menuCategory, params.categoryPath);
}
