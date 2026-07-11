import { getMenuFormulaSteps } from "@/lib/public/menuFormulas";
import type { MenuFormulaType } from "@/lib/public/menuFormulas";
import { isMenuCategory, type MenuCategory } from "@/lib/public/menuCategories";
import type { PublicSetMenuDish } from "@/lib/public/types";

export type SetMenuDishIdsByStep = Partial<Record<MenuCategory, string[]>>;

export function buildDishIdsByStep(dishes: PublicSetMenuDish[]): SetMenuDishIdsByStep {
  const out: SetMenuDishIdsByStep = {};
  for (const dish of dishes) {
    if (!out[dish.step_category]) out[dish.step_category] = [];
    out[dish.step_category]!.push(dish.id);
  }
  return out;
}

export function pruneDishIdsForFormula(
  dishIdsByStep: SetMenuDishIdsByStep,
  formulaType: MenuFormulaType
): SetMenuDishIdsByStep {
  const allowed = new Set(getMenuFormulaSteps(formulaType));
  const out: SetMenuDishIdsByStep = {};
  for (const step of allowed) {
    if (dishIdsByStep[step]?.length) out[step] = [...dishIdsByStep[step]!];
  }
  return out;
}

export function flattenDishIdsByStep(dishIdsByStep: SetMenuDishIdsByStep): string[] {
  const ids: string[] = [];
  for (const list of Object.values(dishIdsByStep)) {
    if (list?.length) ids.push(...list);
  }
  return ids;
}

export function isValidSetMenuStepCategory(value: string): value is MenuCategory {
  return isMenuCategory(value) && (value === "entrée" || value === "plat" || value === "dessert");
}
