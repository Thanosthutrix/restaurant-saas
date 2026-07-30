export type DishComponentRole = "integrated" | "topping" | "accompaniment";

export type LineModificationType = "remove_component" | "swap_accompaniment";

export type DiningLineModification = {
  id: string;
  modificationType: LineModificationType;
  dishComponentId: string | null;
  inventoryItemId: string | null;
  inventoryItemName: string;
  replacementInventoryItemId: string | null;
  replacementInventoryItemName: string | null;
};

/** Option configurable sur la fiche plat (composant direct ingredient uniquement). */
export type DishCustomizableComponent = {
  dishComponentId: string;
  inventoryItemId: string;
  name: string;
  unit: string;
  role: "topping" | "accompaniment";
};

export const DISH_COMPONENT_ROLE_LABELS: Record<DishComponentRole, string> = {
  integrated: "Intégré (recette)",
  topping: "Garniture retirable",
  accompaniment: "Accompagnement",
};
