/** Types et libellés des composants stockés. */

export const INVENTORY_ITEM_TYPES = ["ingredient", "prep", "resale", "supply"] as const;
export type InventoryItemType = (typeof INVENTORY_ITEM_TYPES)[number];

export const FOOD_INVENTORY_ITEM_TYPES = ["ingredient", "prep", "resale"] as const;

export const INVENTORY_ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  ingredient: "Matière première",
  prep: "Préparation",
  resale: "Revente",
  supply: "Petit matériel",
};

export const INVENTORY_ITEM_TYPE_DOT: Record<InventoryItemType, { dotClass: string; label: string }> = {
  ingredient: { dotClass: "bg-amber-500", label: "Matière première" },
  prep: { dotClass: "bg-copper-600", label: "Préparation" },
  resale: { dotClass: "bg-emerald-500", label: "Revente" },
  supply: { dotClass: "bg-sky-500", label: "Petit matériel" },
};

export function isSupplyItemType(itemType: string): itemType is "supply" {
  return itemType === "supply";
}

export function isFoodInventoryItemType(itemType: string): boolean {
  return (FOOD_INVENTORY_ITEM_TYPES as readonly string[]).includes(itemType);
}
