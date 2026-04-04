/**
 * Templates de suggestion de recette (catalogue métier codé en dur).
 * - Plats vendus (dishes)
 * - Préparations intermédiaires (inventory_items type prep)
 * Quantités indicatives à ajuster par le restaurateur.
 */

export type SuggestedComponentTemplate = {
  name: string;
  unit: string;
  itemType: "ingredient" | "prep" | "resale";
  qty: number;
};

export type DishRecipeSuggestionTemplate = {
  kind: "dish";
  matchNames: string[];
  productionMode?: "prepared" | "resale";
  components: SuggestedComponentTemplate[];
};

export type PrepRecipeSuggestionTemplate = {
  kind: "prep";
  matchNames: string[];
  components: SuggestedComponentTemplate[];
};

/** Rétrocompat : type générique pour les plats. */
export type RecipeSuggestionTemplate = {
  matchNames: string[];
  productionMode?: "prepared" | "resale";
  components: SuggestedComponentTemplate[];
};

// --- PLATS VENDUS ---

export const DISH_RECIPE_SUGGESTION_TEMPLATES: DishRecipeSuggestionTemplate[] = [
  { kind: "dish", matchNames: ["margherita", "pizza margherita"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 100 }] },
  { kind: "dish", matchNames: ["reine", "pizza reine"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 100 }, { name: "Jambon", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Champignons", unit: "g", itemType: "ingredient", qty: 60 }] },
  { kind: "dish", matchNames: ["jambon", "pizza jambon"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 100 }, { name: "Jambon", unit: "g", itemType: "ingredient", qty: 80 }] },
  { kind: "dish", matchNames: ["champignons", "pizza champignons"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 100 }, { name: "Champignons", unit: "g", itemType: "ingredient", qty: 60 }] },
  { kind: "dish", matchNames: ["4 fromages", "quatre fromages", "pizza 4 fromages"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 70 }, { name: "Gorgonzola", unit: "g", itemType: "ingredient", qty: 40 }, { name: "Chèvre", unit: "g", itemType: "ingredient", qty: 40 }, { name: "Emmental", unit: "g", itemType: "ingredient", qty: 40 }] },
  { kind: "dish", matchNames: ["napolitaine", "pizza napolitaine"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 100 }, { name: "Anchois", unit: "g", itemType: "ingredient", qty: 30 }, { name: "Câpres", unit: "g", itemType: "ingredient", qty: 10 }] },
  { kind: "dish", matchNames: ["calzone"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 60 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Jambon", unit: "g", itemType: "ingredient", qty: 50 }, { name: "Champignons", unit: "g", itemType: "ingredient", qty: 40 }] },
  { kind: "dish", matchNames: ["regina", "pizza regina"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 100 }, { name: "Jambon", unit: "g", itemType: "ingredient", qty: 60 }, { name: "Champignons", unit: "g", itemType: "ingredient", qty: 40 }, { name: "Olives", unit: "g", itemType: "ingredient", qty: 20 }] },
  { kind: "dish", matchNames: ["vegetarienne", "végétarienne", "pizza végétarienne"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Courgette", unit: "g", itemType: "ingredient", qty: 40 }, { name: "Aubergine", unit: "g", itemType: "ingredient", qty: 40 }, { name: "Poivron", unit: "g", itemType: "ingredient", qty: 30 }] },
  { kind: "dish", matchNames: ["orientale", "pizza orientale"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Mozzarella", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Merguez", unit: "g", itemType: "ingredient", qty: 60 }, { name: "Poivron", unit: "g", itemType: "ingredient", qty: 40 }] },
  { kind: "dish", matchNames: ["chevre miel", "chèvre miel", "pizza chèvre miel"], productionMode: "prepared", components: [{ name: "Pâte à pizza", unit: "unit", itemType: "prep", qty: 1 }, { name: "Sauce tomate", unit: "g", itemType: "ingredient", qty: 60 }, { name: "Chèvre", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Miel", unit: "g", itemType: "ingredient", qty: 20 }] },
  { kind: "dish", matchNames: ["tiramisu"], productionMode: "prepared", components: [{ name: "Mascarpone", unit: "g", itemType: "ingredient", qty: 90 }, { name: "Biscuit cuillère", unit: "unit", itemType: "ingredient", qty: 3 }, { name: "Café", unit: "ml", itemType: "ingredient", qty: 30 }, { name: "Cacao", unit: "g", itemType: "ingredient", qty: 5 }] },
  { kind: "dish", matchNames: ["panna cotta", "pannacotta"], productionMode: "prepared", components: [{ name: "Crème", unit: "ml", itemType: "ingredient", qty: 100 }, { name: "Sucre", unit: "g", itemType: "ingredient", qty: 15 }, { name: "Gélatine", unit: "g", itemType: "ingredient", qty: 2 }, { name: "Vanille", unit: "g", itemType: "ingredient", qty: 1 }] },
  { kind: "dish", matchNames: ["fondant chocolat", "fondant au chocolat"], productionMode: "prepared", components: [{ name: "Chocolat", unit: "g", itemType: "ingredient", qty: 80 }, { name: "Beurre", unit: "g", itemType: "ingredient", qty: 40 }, { name: "Oeuf", unit: "unit", itemType: "ingredient", qty: 2 }, { name: "Sucre", unit: "g", itemType: "ingredient", qty: 25 }, { name: "Farine", unit: "g", itemType: "ingredient", qty: 20 }] },
  { kind: "dish", matchNames: ["mousse chocolat", "mousse au chocolat"], productionMode: "prepared", components: [{ name: "Chocolat", unit: "g", itemType: "ingredient", qty: 100 }, { name: "Oeuf", unit: "unit", itemType: "ingredient", qty: 3 }, { name: "Sucre", unit: "g", itemType: "ingredient", qty: 30 }, { name: "Crème", unit: "ml", itemType: "ingredient", qty: 50 }] },
  { kind: "dish", matchNames: ["creme brulee", "crème brûlée"], productionMode: "prepared", components: [{ name: "Crème", unit: "ml", itemType: "ingredient", qty: 100 }, { name: "Jaune d'oeuf", unit: "unit", itemType: "ingredient", qty: 2 }, { name: "Sucre", unit: "g", itemType: "ingredient", qty: 25 }, { name: "Vanille", unit: "g", itemType: "ingredient", qty: 1 }] },
  { kind: "dish", matchNames: ["eau minerale", "eau minérale", "eau"], productionMode: "resale", components: [{ name: "Eau minérale stock", unit: "unit", itemType: "resale", qty: 1 }] },
  { kind: "dish", matchNames: ["biere 33cl", "bière 33cl", "biere", "bière 33"], productionMode: "resale", components: [{ name: "Bière 33cl stock", unit: "unit", itemType: "resale", qty: 1 }] },
  { kind: "dish", matchNames: ["coca 33cl", "coca"], productionMode: "resale", components: [{ name: "Coca 33cl stock", unit: "unit", itemType: "resale", qty: 1 }] },
  { kind: "dish", matchNames: ["sprite"], productionMode: "resale", components: [{ name: "Sprite stock", unit: "unit", itemType: "resale", qty: 1 }] },
  { kind: "dish", matchNames: ["fanta"], productionMode: "resale", components: [{ name: "Fanta stock", unit: "unit", itemType: "resale", qty: 1 }] },
  { kind: "dish", matchNames: ["cafe", "café", "expresso", "espresso"], productionMode: "prepared", components: [{ name: "Café", unit: "g", itemType: "ingredient", qty: 7 }, { name: "Eau", unit: "ml", itemType: "ingredient", qty: 100 }] },
  { kind: "dish", matchNames: ["the", "thé"], productionMode: "prepared", components: [{ name: "Thé", unit: "g", itemType: "ingredient", qty: 2 }, { name: "Eau", unit: "ml", itemType: "ingredient", qty: 200 }] },
];

// --- PRÉPARATIONS INTERMÉDIAIRES ---

export const PREP_RECIPE_SUGGESTION_TEMPLATES: PrepRecipeSuggestionTemplate[] = [
  { kind: "prep", matchNames: ["pate a pizza", "pâte à pizza", "pate pizza"], components: [{ name: "Farine", unit: "g", itemType: "ingredient", qty: 160 }, { name: "Eau", unit: "ml", itemType: "ingredient", qty: 90 }, { name: "Levure", unit: "g", itemType: "ingredient", qty: 2 }, { name: "Sel", unit: "g", itemType: "ingredient", qty: 3 }, { name: "Huile d'olive", unit: "ml", itemType: "ingredient", qty: 5 }] },
  { kind: "prep", matchNames: ["sauce tomate maison", "sauce tomate"], components: [{ name: "Tomates concassées", unit: "g", itemType: "ingredient", qty: 1000 }, { name: "Huile d'olive", unit: "ml", itemType: "ingredient", qty: 30 }, { name: "Ail", unit: "g", itemType: "ingredient", qty: 10 }, { name: "Sel", unit: "g", itemType: "ingredient", qty: 5 }, { name: "Origan", unit: "g", itemType: "ingredient", qty: 2 }] },
  { kind: "prep", matchNames: ["pate a crepe", "pâte à crêpe", "pate crepe"], components: [{ name: "Farine", unit: "g", itemType: "ingredient", qty: 250 }, { name: "Lait", unit: "ml", itemType: "ingredient", qty: 500 }, { name: "Oeuf", unit: "unit", itemType: "ingredient", qty: 3 }, { name: "Beurre", unit: "g", itemType: "ingredient", qty: 50 }] },
  { kind: "prep", matchNames: ["chantilly maison", "chantilly"], components: [{ name: "Crème liquide", unit: "ml", itemType: "ingredient", qty: 250 }, { name: "Sucre", unit: "g", itemType: "ingredient", qty: 25 }] },
];

/** Rétrocompat : liste des templates plats au format ancien (sans kind). */
export const RECIPE_SUGGESTION_TEMPLATES: RecipeSuggestionTemplate[] = DISH_RECIPE_SUGGESTION_TEMPLATES.map(
  (t) => ({ matchNames: t.matchNames, productionMode: t.productionMode, components: t.components })
);
