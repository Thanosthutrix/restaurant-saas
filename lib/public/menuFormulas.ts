import type { MenuCategory } from "@/lib/public/menuCategories";
import { getMenuCategoryEmoji } from "@/lib/public/menuCategories";

export const MENU_FORMULA_TYPES = [
  {
    value: "entree_plat_dessert",
    label: "Entrée + Plat + Dessert",
    steps: ["entrée", "plat", "dessert"] as const satisfies readonly MenuCategory[],
  },
  {
    value: "entree_plat",
    label: "Entrée + Plat",
    steps: ["entrée", "plat"] as const satisfies readonly MenuCategory[],
  },
  {
    value: "plat_dessert",
    label: "Plat + Dessert",
    steps: ["plat", "dessert"] as const satisfies readonly MenuCategory[],
  },
] as const;

export type MenuFormulaType = (typeof MENU_FORMULA_TYPES)[number]["value"];

export const MENU_FORMULA_TYPE_VALUES: readonly MenuFormulaType[] = MENU_FORMULA_TYPES.map(
  (f) => f.value
);

export function isMenuFormulaType(value: string | null | undefined): value is MenuFormulaType {
  return value != null && (MENU_FORMULA_TYPE_VALUES as readonly string[]).includes(value);
}

export function getMenuFormulaMeta(type: MenuFormulaType) {
  return MENU_FORMULA_TYPES.find((f) => f.value === type)!;
}

export function getMenuFormulaLabel(type: MenuFormulaType): string {
  return getMenuFormulaMeta(type).label;
}

export function getMenuFormulaStepEmojis(type: MenuFormulaType): string[] {
  return getMenuFormulaMeta(type).steps.map((step) => getMenuCategoryEmoji(step));
}

export function getMenuFormulaSteps(type: MenuFormulaType): readonly MenuCategory[] {
  return getMenuFormulaMeta(type).steps;
}

export const SET_MENU_DESSERT_TIMINGS = [
  {
    value: "with_previous",
    label: "Choisir en même temps que l'entrée et le plat",
  },
  {
    value: "second_step",
    label: "Choisir en fin de repas (2e temps)",
  },
] as const;

export type SetMenuDessertTiming = (typeof SET_MENU_DESSERT_TIMINGS)[number]["value"];

export function isSetMenuDessertTiming(value: string | null | undefined): value is SetMenuDessertTiming {
  return value === "with_previous" || value === "second_step";
}

export function formulaIncludesDessert(type: MenuFormulaType): boolean {
  return getMenuFormulaSteps(type).includes("dessert");
}

export function getSetMenuDessertTimingLabel(timing: SetMenuDessertTiming): string {
  return SET_MENU_DESSERT_TIMINGS.find((t) => t.value === timing)?.label ?? timing;
}

export function resolveSetMenuDessertTiming(
  formulaType: MenuFormulaType,
  raw: string | null | undefined
): SetMenuDessertTiming {
  if (!formulaIncludesDessert(formulaType)) return "with_previous";
  return isSetMenuDessertTiming(raw) ? raw : "with_previous";
}
