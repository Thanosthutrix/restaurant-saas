/** Catégories affichées sur la carte publique B2C. */
export const MENU_CATEGORIES = [
  { value: "entrée", label: "Entrée", sectionLabel: "Entrées", emoji: "🥗" },
  { value: "plat", label: "Plat", sectionLabel: "Plats", emoji: "🍽️" },
  { value: "dessert", label: "Dessert", sectionLabel: "Desserts", emoji: "🍰" },
  { value: "à_partager", label: "À partager", sectionLabel: "À partager", emoji: "🫕" },
  { value: "vin", label: "Vin", sectionLabel: "Vins", emoji: "🍷" },
  { value: "boisson", label: "Boisson", sectionLabel: "Boissons", emoji: "🥤" },
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number]["value"];

export const MENU_CATEGORY_VALUES: readonly MenuCategory[] = MENU_CATEGORIES.map((c) => c.value);

export function isMenuCategory(value: string | null | undefined): value is MenuCategory {
  return value != null && (MENU_CATEGORY_VALUES as readonly string[]).includes(value);
}

export function normalizeMenuCategory(raw: string | null | undefined): MenuCategory {
  return isMenuCategory(raw) ? raw : "plat";
}

export function getMenuCategoryMeta(category: MenuCategory) {
  return MENU_CATEGORIES.find((c) => c.value === category)!;
}

export function getMenuCategorySectionLabel(category: MenuCategory): string {
  return getMenuCategoryMeta(category).sectionLabel;
}

export function getMenuCategoryEmoji(category: MenuCategory): string {
  return getMenuCategoryMeta(category).emoji;
}
