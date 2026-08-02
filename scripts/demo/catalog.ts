/**
 * Catalogue du restaurant de démo — « Le Comptoir du Marché », brasserie parisienne.
 *
 * Chaîne de cohérence :
 *   ingrédients (prix d'achat réels au g/ml/unité)
 *     → préparations maison (fonds, sauces, pâtes, desserts)
 *       → plats de la carte (recettes qui consomment ingrédients ET préparations)
 *
 * Les prix de vente sont posés pour donner un coefficient food-cost crédible
 * en brasserie (matière ≈ 25–32 % du prix HT sur les plats, ≈ 15–22 % sur les
 * boissons). Le contrôle est fait par `printCoherenceReport` après le seed.
 */

export type Unit = "g" | "ml" | "unit";

export type IngredientDef = {
  name: string;
  unit: Unit;
  /** Prix d'achat HT par unité de base (€/g, €/ml, €/unité). */
  cost: number;
  category: string;
  /** Conditionnement d'achat fournisseur. */
  purchaseUnit: string;
  /** Nombre d'unités de base par conditionnement (ex. 1 colis = 5000 g). */
  unitsPerPurchase: number;
  supplier: SupplierKey;
  /** Stock cible en unité de base. */
  targetStock: number;
  minStock: number;
};

export type SupplierKey = "metro" | "boucherie" | "maree" | "primeur" | "boissons";

export type PrepDef = {
  name: string;
  unit: Unit;
  category: string;
  /** Rendement d'une fabrication, en unité de base (ex. 2000 ml de fond). */
  batchYield: number;
  /** Durée de vie en jours après fabrication (DLC). */
  shelfLifeDays: number;
  /** Température visée en fin de fabrication (°C), pour le registre de refroidissement. */
  targetEndTemp: number;
  /** Poste de production. */
  station: "chaud" | "froid" | "pâtisserie";
  components: { item: string; qty: number }[];
};

export type DishDef = {
  name: string;
  mode: "prepared" | "resale";
  /** Prix de vente TTC affiché sur la carte. */
  ttc: number;
  /** TVA : 10 % restauration sur place, 20 % sur les boissons alcoolisées. */
  vat: 10 | 20;
  menuCategory: "entrée" | "plat" | "dessert" | "boisson" | "vin";
  categoryPath: string;
  description?: string;
  /** Recette : consomme des ingrédients et/ou des préparations. */
  recipe?: { item: string; qty: number }[];
  /**
   * Article de revente adossé au plat. L'application crée l'article de stock au nom
   * exact du plat (`ensureResaleDishStockBinding`) : on ne fournit donc que l'achat.
   */
  resaleItem?: { cost: number; purchaseUnit: string; unitsPerPurchase: number; supplier: SupplierKey; targetStock: number; minStock: number };
  /** Popularité relative dans le mix de ventes (poids). */
  popularity: number;
  /** Disponible au déjeuner / au dîner. */
  services?: ("lunch" | "dinner")[];
};

// ---------------------------------------------------------------------------
// INGRÉDIENTS — prix marché France 2026, HT, par unité de base
// ---------------------------------------------------------------------------

export const INGREDIENTS: IngredientDef[] = [
  // — Boucherie —
  { name: "Faux-filet de bœuf", unit: "g", cost: 0.0246, category: "Viandes", purchaseUnit: "pièce 5 kg", unitsPerPurchase: 5000, supplier: "boucherie", targetStock: 9000, minStock: 3000 },
  { name: "Bavette d'aloyau", unit: "g", cost: 0.0198, category: "Viandes", purchaseUnit: "pièce 3 kg", unitsPerPurchase: 3000, supplier: "boucherie", targetStock: 6000, minStock: 2000 },
  { name: "Steak haché 15% MG", unit: "g", cost: 0.0128, category: "Viandes", purchaseUnit: "colis 5 kg", unitsPerPurchase: 5000, supplier: "boucherie", targetStock: 8000, minStock: 2500 },
  { name: "Filet de poulet fermier", unit: "g", cost: 0.0142, category: "Viandes", purchaseUnit: "colis 4 kg", unitsPerPurchase: 4000, supplier: "boucherie", targetStock: 7000, minStock: 2000 },
  { name: "Magret de canard", unit: "g", cost: 0.0215, category: "Viandes", purchaseUnit: "colis 3 kg", unitsPerPurchase: 3000, supplier: "boucherie", targetStock: 5000, minStock: 1500 },
  { name: "Gorge de porc", unit: "g", cost: 0.0068, category: "Viandes", purchaseUnit: "colis 2 kg", unitsPerPurchase: 2000, supplier: "boucherie", targetStock: 3000, minStock: 1000 },
  { name: "Foie de volaille", unit: "g", cost: 0.0074, category: "Viandes", purchaseUnit: "barquette 1 kg", unitsPerPurchase: 1000, supplier: "boucherie", targetStock: 2000, minStock: 600 },
  { name: "Lardons fumés", unit: "g", cost: 0.0112, category: "Charcuterie", purchaseUnit: "colis 2 kg", unitsPerPurchase: 2000, supplier: "boucherie", targetStock: 3000, minStock: 1000 },
  { name: "Jambon blanc supérieur", unit: "g", cost: 0.0165, category: "Charcuterie", purchaseUnit: "pièce 2 kg", unitsPerPurchase: 2000, supplier: "boucherie", targetStock: 3000, minStock: 1000 },

  // — Marée —
  { name: "Pavé de saumon", unit: "g", cost: 0.0238, category: "Poissons", purchaseUnit: "filet 2 kg", unitsPerPurchase: 2000, supplier: "maree", targetStock: 5000, minStock: 1500 },
  { name: "Filet de cabillaud", unit: "g", cost: 0.0262, category: "Poissons", purchaseUnit: "colis 2 kg", unitsPerPurchase: 2000, supplier: "maree", targetStock: 4000, minStock: 1200 },

  // — Primeur —
  { name: "Pomme de terre Agria", unit: "g", cost: 0.0011, category: "Légumes", purchaseUnit: "sac 25 kg", unitsPerPurchase: 25000, supplier: "primeur", targetStock: 40000, minStock: 12000 },
  { name: "Oignon jaune", unit: "g", cost: 0.0016, category: "Légumes", purchaseUnit: "sac 10 kg", unitsPerPurchase: 10000, supplier: "primeur", targetStock: 15000, minStock: 5000 },
  { name: "Échalote", unit: "g", cost: 0.0042, category: "Légumes", purchaseUnit: "sac 5 kg", unitsPerPurchase: 5000, supplier: "primeur", targetStock: 5000, minStock: 1500 },
  { name: "Ail", unit: "g", cost: 0.0089, category: "Légumes", purchaseUnit: "sac 1 kg", unitsPerPurchase: 1000, supplier: "primeur", targetStock: 1500, minStock: 400 },
  { name: "Carotte", unit: "g", cost: 0.0014, category: "Légumes", purchaseUnit: "sac 10 kg", unitsPerPurchase: 10000, supplier: "primeur", targetStock: 12000, minStock: 4000 },
  { name: "Céleri branche", unit: "g", cost: 0.0022, category: "Légumes", purchaseUnit: "colis 5 kg", unitsPerPurchase: 5000, supplier: "primeur", targetStock: 4000, minStock: 1200 },
  { name: "Poireau", unit: "g", cost: 0.0021, category: "Légumes", purchaseUnit: "colis 5 kg", unitsPerPurchase: 5000, supplier: "primeur", targetStock: 4000, minStock: 1200 },
  { name: "Tomate grappe", unit: "g", cost: 0.0031, category: "Légumes", purchaseUnit: "colis 6 kg", unitsPerPurchase: 6000, supplier: "primeur", targetStock: 6000, minStock: 2000 },
  { name: "Salade batavia", unit: "g", cost: 0.0028, category: "Légumes", purchaseUnit: "colis 5 kg", unitsPerPurchase: 5000, supplier: "primeur", targetStock: 5000, minStock: 1500 },
  { name: "Champignon de Paris", unit: "g", cost: 0.0042, category: "Légumes", purchaseUnit: "colis 3 kg", unitsPerPurchase: 3000, supplier: "primeur", targetStock: 4000, minStock: 1200 },
  { name: "Haricot vert extra-fin", unit: "g", cost: 0.0058, category: "Légumes", purchaseUnit: "colis 5 kg", unitsPerPurchase: 5000, supplier: "primeur", targetStock: 5000, minStock: 1500 },
  { name: "Pomme Golden", unit: "g", cost: 0.0022, category: "Fruits", purchaseUnit: "colis 10 kg", unitsPerPurchase: 10000, supplier: "primeur", targetStock: 8000, minStock: 2500 },
  { name: "Citron jaune", unit: "unit", cost: 0.42, category: "Fruits", purchaseUnit: "colis 50 pièces", unitsPerPurchase: 50, supplier: "primeur", targetStock: 100, minStock: 30 },

  // — Crèmerie —
  { name: "Beurre doux", unit: "g", cost: 0.0092, category: "Crèmerie", purchaseUnit: "plaque 5 kg", unitsPerPurchase: 5000, supplier: "metro", targetStock: 8000, minStock: 2500 },
  { name: "Crème liquide 30%", unit: "ml", cost: 0.0048, category: "Crèmerie", purchaseUnit: "brique 1 L", unitsPerPurchase: 1000, supplier: "metro", targetStock: 10000, minStock: 3000 },
  { name: "Lait entier", unit: "ml", cost: 0.0012, category: "Crèmerie", purchaseUnit: "brique 1 L", unitsPerPurchase: 1000, supplier: "metro", targetStock: 12000, minStock: 4000 },
  { name: "Œuf frais", unit: "unit", cost: 0.28, category: "Crèmerie", purchaseUnit: "plateau 30", unitsPerPurchase: 30, supplier: "metro", targetStock: 360, minStock: 120 },
  { name: "Comté râpé", unit: "g", cost: 0.0165, category: "Crèmerie", purchaseUnit: "sachet 1 kg", unitsPerPurchase: 1000, supplier: "metro", targetStock: 3000, minStock: 1000 },
  { name: "Parmesan râpé", unit: "g", cost: 0.0198, category: "Crèmerie", purchaseUnit: "sachet 1 kg", unitsPerPurchase: 1000, supplier: "metro", targetStock: 2000, minStock: 600 },
  { name: "Bûche de chèvre", unit: "g", cost: 0.0142, category: "Crèmerie", purchaseUnit: "colis 2 kg", unitsPerPurchase: 2000, supplier: "metro", targetStock: 2500, minStock: 800 },

  // — Épicerie —
  { name: "Farine T55", unit: "g", cost: 0.0009, category: "Épicerie", purchaseUnit: "sac 25 kg", unitsPerPurchase: 25000, supplier: "metro", targetStock: 20000, minStock: 6000 },
  { name: "Sucre semoule", unit: "g", cost: 0.0012, category: "Épicerie", purchaseUnit: "sac 10 kg", unitsPerPurchase: 10000, supplier: "metro", targetStock: 10000, minStock: 3000 },
  { name: "Cassonade", unit: "g", cost: 0.0018, category: "Épicerie", purchaseUnit: "sac 5 kg", unitsPerPurchase: 5000, supplier: "metro", targetStock: 4000, minStock: 1200 },
  { name: "Riz basmati", unit: "g", cost: 0.0021, category: "Épicerie", purchaseUnit: "sac 10 kg", unitsPerPurchase: 10000, supplier: "metro", targetStock: 8000, minStock: 2500 },
  { name: "Tagliatelles fraîches", unit: "g", cost: 0.0038, category: "Épicerie", purchaseUnit: "colis 3 kg", unitsPerPurchase: 3000, supplier: "metro", targetStock: 6000, minStock: 2000 },
  { name: "Huile d'olive vierge", unit: "ml", cost: 0.0072, category: "Épicerie", purchaseUnit: "bidon 5 L", unitsPerPurchase: 5000, supplier: "metro", targetStock: 8000, minStock: 2500 },
  { name: "Huile de friture", unit: "ml", cost: 0.0021, category: "Épicerie", purchaseUnit: "bidon 10 L", unitsPerPurchase: 10000, supplier: "metro", targetStock: 40000, minStock: 15000 },
  { name: "Vinaigre de vin rouge", unit: "ml", cost: 0.0028, category: "Épicerie", purchaseUnit: "bidon 5 L", unitsPerPurchase: 5000, supplier: "metro", targetStock: 5000, minStock: 1500 },
  { name: "Moutarde de Dijon", unit: "g", cost: 0.0048, category: "Épicerie", purchaseUnit: "seau 2,5 kg", unitsPerPurchase: 2500, supplier: "metro", targetStock: 3000, minStock: 1000 },
  { name: "Sel fin", unit: "g", cost: 0.0004, category: "Épicerie", purchaseUnit: "sac 5 kg", unitsPerPurchase: 5000, supplier: "metro", targetStock: 5000, minStock: 1500 },
  { name: "Poivre noir moulu", unit: "g", cost: 0.018, category: "Épicerie", purchaseUnit: "boîte 1 kg", unitsPerPurchase: 1000, supplier: "metro", targetStock: 1200, minStock: 400 },
  { name: "Fond de veau déshydraté", unit: "g", cost: 0.021, category: "Épicerie", purchaseUnit: "boîte 1 kg", unitsPerPurchase: 1000, supplier: "metro", targetStock: 2000, minStock: 600 },
  { name: "Vin blanc de cuisine", unit: "ml", cost: 0.0022, category: "Épicerie", purchaseUnit: "bidon 5 L", unitsPerPurchase: 5000, supplier: "metro", targetStock: 6000, minStock: 2000 },
  { name: "Cognac de cuisine", unit: "ml", cost: 0.029, category: "Épicerie", purchaseUnit: "bouteille 1 L", unitsPerPurchase: 1000, supplier: "metro", targetStock: 1500, minStock: 500 },
  { name: "Chocolat noir 70%", unit: "g", cost: 0.0128, category: "Épicerie", purchaseUnit: "sac 5 kg", unitsPerPurchase: 5000, supplier: "metro", targetStock: 5000, minStock: 1500 },
  { name: "Gousse de vanille", unit: "unit", cost: 3.8, category: "Épicerie", purchaseUnit: "boîte 10", unitsPerPurchase: 10, supplier: "metro", targetStock: 20, minStock: 6 },
  { name: "Pain de campagne", unit: "g", cost: 0.0032, category: "Épicerie", purchaseUnit: "colis 4 kg", unitsPerPurchase: 4000, supplier: "metro", targetStock: 5000, minStock: 1500 },
  { name: "Cornichon", unit: "g", cost: 0.0056, category: "Épicerie", purchaseUnit: "seau 2,5 kg", unitsPerPurchase: 2500, supplier: "metro", targetStock: 2500, minStock: 800 },
];

// ---------------------------------------------------------------------------
// PRÉPARATIONS MAISON — fabriquées en cuisine, tracées au registre
// ---------------------------------------------------------------------------

export const PREPARATIONS: PrepDef[] = [
  {
    name: "Fond de veau maison",
    unit: "ml", category: "Bases", batchYield: 4000, shelfLifeDays: 4, targetEndTemp: 8, station: "chaud",
    components: [
      { item: "Carotte", qty: 800 }, { item: "Oignon jaune", qty: 600 }, { item: "Céleri branche", qty: 400 },
      { item: "Poireau", qty: 400 }, { item: "Fond de veau déshydraté", qty: 240 },
      { item: "Vin blanc de cuisine", qty: 500 }, { item: "Beurre doux", qty: 120 },
    ],
  },
  {
    name: "Sauce au poivre",
    unit: "ml", category: "Sauces", batchYield: 2000, shelfLifeDays: 3, targetEndTemp: 8, station: "chaud",
    components: [
      { item: "Fond de veau maison", qty: 1200 }, { item: "Crème liquide 30%", qty: 700 },
      { item: "Poivre noir moulu", qty: 45 }, { item: "Cognac de cuisine", qty: 120 }, { item: "Beurre doux", qty: 100 },
    ],
  },
  {
    name: "Sauce béarnaise",
    unit: "ml", category: "Sauces", batchYield: 1200, shelfLifeDays: 2, targetEndTemp: 10, station: "chaud",
    components: [
      { item: "Beurre doux", qty: 900 }, { item: "Œuf frais", qty: 8 }, { item: "Échalote", qty: 180 },
      { item: "Vinaigre de vin rouge", qty: 150 }, { item: "Poivre noir moulu", qty: 12 },
    ],
  },
  {
    name: "Vinaigrette maison",
    unit: "ml", category: "Sauces", batchYield: 2000, shelfLifeDays: 7, targetEndTemp: 12, station: "froid",
    components: [
      { item: "Huile d'olive vierge", qty: 1400 }, { item: "Vinaigre de vin rouge", qty: 450 },
      { item: "Moutarde de Dijon", qty: 120 }, { item: "Sel fin", qty: 20 }, { item: "Poivre noir moulu", qty: 8 },
    ],
  },
  {
    name: "Frites fraîches",
    // 15 kg de pommes de terre donnent 12 kg de frites : 20 % de perte à
    // l'épluchage et à la taille, soit 1,25 g de brut par gramme fini.
    unit: "g", category: "Garnitures", batchYield: 12000, shelfLifeDays: 1, targetEndTemp: 10, station: "chaud",
    components: [
      { item: "Pomme de terre Agria", qty: 15000 }, { item: "Huile de friture", qty: 900 }, { item: "Sel fin", qty: 60 },
    ],
  },
  {
    name: "Purée maison",
    unit: "g", category: "Garnitures", batchYield: 6000, shelfLifeDays: 2, targetEndTemp: 8, station: "chaud",
    components: [
      { item: "Pomme de terre Agria", qty: 5500 }, { item: "Beurre doux", qty: 600 },
      { item: "Lait entier", qty: 900 }, { item: "Sel fin", qty: 45 },
    ],
  },
  {
    name: "Base soupe à l'oignon",
    unit: "ml", category: "Bases", batchYield: 5000, shelfLifeDays: 3, targetEndTemp: 8, station: "chaud",
    components: [
      { item: "Oignon jaune", qty: 3500 }, { item: "Beurre doux", qty: 350 },
      { item: "Fond de veau maison", qty: 1500 }, { item: "Vin blanc de cuisine", qty: 500 },
    ],
  },
  {
    name: "Terrine de campagne",
    unit: "g", category: "Charcuterie maison", batchYield: 4000, shelfLifeDays: 6, targetEndTemp: 8, station: "froid",
    components: [
      { item: "Gorge de porc", qty: 2600 }, { item: "Foie de volaille", qty: 1400 },
      { item: "Oignon jaune", qty: 350 }, { item: "Échalote", qty: 200 }, { item: "Œuf frais", qty: 6 },
      { item: "Cognac de cuisine", qty: 150 }, { item: "Sel fin", qty: 70 }, { item: "Poivre noir moulu", qty: 25 },
    ],
  },
  {
    name: "Pâte sucrée",
    unit: "g", category: "Pâtisserie", batchYield: 3000, shelfLifeDays: 4, targetEndTemp: 6, station: "pâtisserie",
    components: [
      { item: "Farine T55", qty: 1600 }, { item: "Beurre doux", qty: 900 },
      { item: "Sucre semoule", qty: 450 }, { item: "Œuf frais", qty: 5 },
    ],
  },
  {
    name: "Appareil à crème brûlée",
    unit: "ml", category: "Pâtisserie", batchYield: 4000, shelfLifeDays: 3, targetEndTemp: 8, station: "pâtisserie",
    components: [
      { item: "Crème liquide 30%", qty: 2800 }, { item: "Lait entier", qty: 700 },
      { item: "Œuf frais", qty: 24 }, { item: "Sucre semoule", qty: 600 }, { item: "Gousse de vanille", qty: 3 },
    ],
  },
  {
    name: "Mousse au chocolat",
    unit: "g", category: "Pâtisserie", batchYield: 4000, shelfLifeDays: 3, targetEndTemp: 6, station: "pâtisserie",
    components: [
      { item: "Chocolat noir 70%", qty: 1400 }, { item: "Œuf frais", qty: 22 },
      { item: "Sucre semoule", qty: 350 }, { item: "Crème liquide 30%", qty: 800 },
    ],
  },
  {
    name: "Caramel beurre salé",
    unit: "g", category: "Pâtisserie", batchYield: 1500, shelfLifeDays: 10, targetEndTemp: 10, station: "pâtisserie",
    components: [
      { item: "Sucre semoule", qty: 700 }, { item: "Crème liquide 30%", qty: 500 },
      { item: "Beurre doux", qty: 350 }, { item: "Sel fin", qty: 12 },
    ],
  },
];

// ---------------------------------------------------------------------------
// CARTE
// ---------------------------------------------------------------------------

export const DISHES: DishDef[] = [
  // ————— ENTRÉES —————
  {
    name: "Soupe à l'oignon gratinée", mode: "prepared", ttc: 9.5, vat: 10, menuCategory: "entrée",
    categoryPath: "Carte/Entrées", popularity: 7,
    description: "Oignons confits au fond de veau maison, croûton et comté gratiné.",
    recipe: [{ item: "Base soupe à l'oignon", qty: 320 }, { item: "Comté râpé", qty: 45 }, { item: "Pain de campagne", qty: 55 }],
  },
  {
    name: "Terrine de campagne, cornichons", mode: "prepared", ttc: 10.5, vat: 10, menuCategory: "entrée",
    categoryPath: "Carte/Entrées", popularity: 6,
    description: "Terrine maison au foie de volaille, cornichons et pain de campagne.",
    recipe: [{ item: "Terrine de campagne", qty: 130 }, { item: "Cornichon", qty: 35 }, { item: "Pain de campagne", qty: 60 }],
  },
  {
    name: "Œufs mayonnaise", mode: "prepared", ttc: 7.5, vat: 10, menuCategory: "entrée",
    categoryPath: "Carte/Entrées", popularity: 5,
    description: "Deux œufs fermiers, mayonnaise maison à la moutarde de Dijon.",
    recipe: [{ item: "Œuf frais", qty: 2 }, { item: "Moutarde de Dijon", qty: 12 }, { item: "Huile d'olive vierge", qty: 35 }, { item: "Salade batavia", qty: 40 }],
  },
  {
    name: "Salade de chèvre chaud", mode: "prepared", ttc: 12.5, vat: 10, menuCategory: "entrée",
    categoryPath: "Carte/Entrées", popularity: 6,
    description: "Batavia, toasts de chèvre gratinés, vinaigrette maison.",
    recipe: [{ item: "Salade batavia", qty: 110 }, { item: "Bûche de chèvre", qty: 90 }, { item: "Pain de campagne", qty: 55 }, { item: "Vinaigrette maison", qty: 30 }, { item: "Tomate grappe", qty: 60 }],
  },
  {
    name: "Rillettes de saumon", mode: "prepared", ttc: 11.5, vat: 10, menuCategory: "entrée",
    categoryPath: "Carte/Entrées", popularity: 4,
    description: "Saumon travaillé à la crème et à l'échalote, toasts grillés.",
    recipe: [{ item: "Pavé de saumon", qty: 95 }, { item: "Crème liquide 30%", qty: 35 }, { item: "Échalote", qty: 20 }, { item: "Citron jaune", qty: 0.25 }, { item: "Pain de campagne", qty: 50 }],
  },

  // ————— PLATS —————
  {
    name: "Entrecôte grillée, sauce au poivre", mode: "prepared", ttc: 26.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Viandes", popularity: 10,
    description: "Faux-filet grillé, sauce au poivre maison, frites fraîches.",
    recipe: [{ item: "Faux-filet de bœuf", qty: 250 }, { item: "Sauce au poivre", qty: 80 }, { item: "Frites fraîches", qty: 220 }],
  },
  {
    name: "Bavette à l'échalote", mode: "prepared", ttc: 22.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Viandes", popularity: 8,
    description: "Bavette d'aloyau, échalotes confites au vin, frites fraîches.",
    recipe: [{ item: "Bavette d'aloyau", qty: 220 }, { item: "Échalote", qty: 70 }, { item: "Beurre doux", qty: 25 }, { item: "Vin blanc de cuisine", qty: 40 }, { item: "Frites fraîches", qty: 220 }],
  },
  {
    name: "Steak frites", mode: "prepared", ttc: 18.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Viandes", popularity: 11,
    description: "Steak haché façon bouchère, frites fraîches, salade.",
    recipe: [{ item: "Steak haché 15% MG", qty: 190 }, { item: "Frites fraîches", qty: 250 }, { item: "Salade batavia", qty: 35 }, { item: "Vinaigrette maison", qty: 15 }],
  },
  {
    name: "Magret de canard, purée maison", mode: "prepared", ttc: 24.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Viandes", popularity: 7,
    description: "Magret rosé, purée maison au beurre, jus corsé.",
    recipe: [{ item: "Magret de canard", qty: 220 }, { item: "Purée maison", qty: 260 }, { item: "Fond de veau maison", qty: 70 }],
  },
  {
    name: "Suprême de volaille aux champignons", mode: "prepared", ttc: 19.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Viandes", popularity: 7,
    description: "Filet de poulet fermier, crème de champignons, riz basmati.",
    recipe: [{ item: "Filet de poulet fermier", qty: 200 }, { item: "Champignon de Paris", qty: 110 }, { item: "Crème liquide 30%", qty: 70 }, { item: "Fond de veau maison", qty: 50 }, { item: "Riz basmati", qty: 110 }],
  },
  {
    name: "Pavé de saumon, haricots verts", mode: "prepared", ttc: 22.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Poissons", popularity: 7,
    description: "Saumon snacké, haricots verts extra-fins au beurre.",
    recipe: [{ item: "Pavé de saumon", qty: 180 }, { item: "Haricot vert extra-fin", qty: 160 }, { item: "Beurre doux", qty: 25 }, { item: "Citron jaune", qty: 0.25 }],
  },
  {
    name: "Cabillaud rôti, riz basmati", mode: "prepared", ttc: 23.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Poissons", popularity: 5,
    description: "Dos de cabillaud rôti, riz basmati, beurre citronné.",
    recipe: [{ item: "Filet de cabillaud", qty: 180 }, { item: "Riz basmati", qty: 120 }, { item: "Beurre doux", qty: 30 }, { item: "Citron jaune", qty: 0.25 }],
  },
  {
    name: "Tagliatelles à la carbonara", mode: "prepared", ttc: 16.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Pâtes", popularity: 8,
    description: "Tagliatelles fraîches, lardons fumés, crème et parmesan.",
    recipe: [{ item: "Tagliatelles fraîches", qty: 200 }, { item: "Lardons fumés", qty: 85 }, { item: "Œuf frais", qty: 1 }, { item: "Parmesan râpé", qty: 30 }, { item: "Crème liquide 30%", qty: 55 }],
  },
  {
    name: "Croque-monsieur maison, salade", mode: "prepared", ttc: 14.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Brasserie", popularity: 6, services: ["lunch"],
    description: "Pain de campagne, jambon supérieur, béchamel et comté.",
    recipe: [{ item: "Pain de campagne", qty: 130 }, { item: "Jambon blanc supérieur", qty: 85 }, { item: "Comté râpé", qty: 65 }, { item: "Lait entier", qty: 60 }, { item: "Farine T55", qty: 18 }, { item: "Beurre doux", qty: 25 }, { item: "Salade batavia", qty: 45 }],
  },
  {
    name: "Salade César au poulet", mode: "prepared", ttc: 16.5, vat: 10, menuCategory: "plat",
    categoryPath: "Carte/Plats/Salades", popularity: 6, services: ["lunch"],
    description: "Batavia, poulet fermier grillé, parmesan et croûtons.",
    recipe: [{ item: "Salade batavia", qty: 130 }, { item: "Filet de poulet fermier", qty: 130 }, { item: "Parmesan râpé", qty: 28 }, { item: "Pain de campagne", qty: 45 }, { item: "Vinaigrette maison", qty: 35 }],
  },

  // ————— DESSERTS —————
  {
    name: "Crème brûlée à la vanille", mode: "prepared", ttc: 8.0, vat: 10, menuCategory: "dessert",
    categoryPath: "Carte/Desserts", popularity: 8,
    description: "Crème à la gousse de vanille, cassonade caramélisée minute.",
    recipe: [{ item: "Appareil à crème brûlée", qty: 160 }, { item: "Cassonade", qty: 18 }],
  },
  {
    name: "Mousse au chocolat maison", mode: "prepared", ttc: 7.5, vat: 10, menuCategory: "dessert",
    categoryPath: "Carte/Desserts", popularity: 7,
    description: "Chocolat noir 70 %, montée à la minute chaque matin.",
    recipe: [{ item: "Mousse au chocolat", qty: 150 }],
  },
  {
    name: "Tarte Tatin, crème fraîche", mode: "prepared", ttc: 8.5, vat: 10, menuCategory: "dessert",
    categoryPath: "Carte/Desserts", popularity: 6,
    description: "Pommes Golden caramélisées, pâte sucrée maison.",
    recipe: [{ item: "Pâte sucrée", qty: 90 }, { item: "Pomme Golden", qty: 220 }, { item: "Cassonade", qty: 45 }, { item: "Beurre doux", qty: 30 }, { item: "Crème liquide 30%", qty: 35 }],
  },
  {
    name: "Fondant au chocolat, caramel beurre salé", mode: "prepared", ttc: 8.5, vat: 10, menuCategory: "dessert",
    categoryPath: "Carte/Desserts", popularity: 7,
    description: "Cœur coulant, caramel beurre salé maison.",
    recipe: [{ item: "Chocolat noir 70%", qty: 65 }, { item: "Beurre doux", qty: 55 }, { item: "Œuf frais", qty: 1 }, { item: "Sucre semoule", qty: 45 }, { item: "Farine T55", qty: 28 }, { item: "Caramel beurre salé", qty: 35 }],
  },
  {
    name: "Café gourmand", mode: "prepared", ttc: 9.5, vat: 10, menuCategory: "dessert",
    categoryPath: "Carte/Desserts", popularity: 6,
    description: "Expresso accompagné de trois mignardises maison.",
    recipe: [{ item: "Mousse au chocolat", qty: 55 }, { item: "Appareil à crème brûlée", qty: 60 }, { item: "Caramel beurre salé", qty: 20 }, { item: "Pâte sucrée", qty: 30 }, { item: "Café expresso", qty: 1 }],
  },

  // ————— BOISSONS (revente) —————
  {
    name: "Café expresso", mode: "resale", ttc: 2.4, vat: 10, menuCategory: "boisson", categoryPath: "Carte/Boissons/Chaudes", popularity: 14,
    resaleItem: { cost: 0.22, purchaseUnit: "boîte 200", unitsPerPurchase: 200, supplier: "boissons", targetStock: 600, minStock: 200 },
  },
  {
    name: "Thé / infusion", mode: "resale", ttc: 3.2, vat: 10, menuCategory: "boisson", categoryPath: "Carte/Boissons/Chaudes", popularity: 4,
    resaleItem: { cost: 0.18, purchaseUnit: "boîte 100", unitsPerPurchase: 100, supplier: "boissons", targetStock: 300, minStock: 100 },
  },
  {
    name: "Coca-Cola 33cl", mode: "resale", ttc: 3.8, vat: 10, menuCategory: "boisson", categoryPath: "Carte/Boissons/Softs", popularity: 9,
    resaleItem: { cost: 0.62, purchaseUnit: "pack 24", unitsPerPurchase: 24, supplier: "boissons", targetStock: 240, minStock: 72 },
  },
  {
    name: "Perrier 33cl", mode: "resale", ttc: 3.6, vat: 10, menuCategory: "boisson", categoryPath: "Carte/Boissons/Softs", popularity: 5,
    resaleItem: { cost: 0.55, purchaseUnit: "pack 24", unitsPerPurchase: 24, supplier: "boissons", targetStock: 168, minStock: 48 },
  },
  {
    name: "Eau minérale 50cl", mode: "resale", ttc: 3.2, vat: 10, menuCategory: "boisson", categoryPath: "Carte/Boissons/Softs", popularity: 8,
    resaleItem: { cost: 0.38, purchaseUnit: "pack 24", unitsPerPurchase: 24, supplier: "boissons", targetStock: 288, minStock: 96 },
  },
  {
    name: "Jus de fruits 25cl", mode: "resale", ttc: 3.9, vat: 10, menuCategory: "boisson", categoryPath: "Carte/Boissons/Softs", popularity: 5,
    resaleItem: { cost: 0.68, purchaseUnit: "pack 24", unitsPerPurchase: 24, supplier: "boissons", targetStock: 144, minStock: 48 },
  },
  {
    name: "Bière pression 25cl", mode: "resale", ttc: 4.2, vat: 20, menuCategory: "boisson", categoryPath: "Carte/Boissons/Bières", popularity: 10,
    resaleItem: { cost: 0.95, purchaseUnit: "fût 30 L (120 × 25cl)", unitsPerPurchase: 120, supplier: "boissons", targetStock: 360, minStock: 120 },
  },
  {
    name: "Bière pression 50cl", mode: "resale", ttc: 7.2, vat: 20, menuCategory: "boisson", categoryPath: "Carte/Boissons/Bières", popularity: 6,
    resaleItem: { cost: 1.9, purchaseUnit: "fût 30 L (60 × 50cl)", unitsPerPurchase: 60, supplier: "boissons", targetStock: 180, minStock: 60 },
  },
  {
    name: "Kir vin blanc", mode: "resale", ttc: 5.5, vat: 20, menuCategory: "boisson", categoryPath: "Carte/Boissons/Apéritifs", popularity: 4,
    resaleItem: { cost: 1.1, purchaseUnit: "bouteille (16 doses)", unitsPerPurchase: 16, supplier: "boissons", targetStock: 96, minStock: 32 },
  },

  // ————— VINS (revente) —————
  {
    name: "Verre de vin rouge 12cl", mode: "resale", ttc: 5.5, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Au verre", popularity: 9,
    resaleItem: { cost: 1.35, purchaseUnit: "bouteille 75cl (6 verres)", unitsPerPurchase: 6, supplier: "boissons", targetStock: 180, minStock: 60 },
  },
  {
    name: "Verre de vin blanc 12cl", mode: "resale", ttc: 5.5, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Au verre", popularity: 7,
    resaleItem: { cost: 1.4, purchaseUnit: "bouteille 75cl (6 verres)", unitsPerPurchase: 6, supplier: "boissons", targetStock: 150, minStock: 48 },
  },
  {
    name: "Côtes du Rhône rouge", mode: "resale", ttc: 26.0, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Rouges", popularity: 5,
    resaleItem: { cost: 7.2, purchaseUnit: "carton 6", unitsPerPurchase: 6, supplier: "boissons", targetStock: 36, minStock: 12 },
  },
  {
    name: "Bordeaux Médoc", mode: "resale", ttc: 32.0, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Rouges", popularity: 3,
    resaleItem: { cost: 9.8, purchaseUnit: "carton 6", unitsPerPurchase: 6, supplier: "boissons", targetStock: 24, minStock: 6 },
  },
  {
    name: "Bourgogne Chardonnay", mode: "resale", ttc: 38.0, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Blancs", popularity: 3,
    resaleItem: { cost: 11.5, purchaseUnit: "carton 6", unitsPerPurchase: 6, supplier: "boissons", targetStock: 24, minStock: 6 },
  },
  {
    name: "Sancerre blanc", mode: "resale", ttc: 36.0, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Blancs", popularity: 3,
    resaleItem: { cost: 10.9, purchaseUnit: "carton 6", unitsPerPurchase: 6, supplier: "boissons", targetStock: 24, minStock: 6 },
  },
  {
    name: "Rosé de Provence", mode: "resale", ttc: 25.0, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Rosés", popularity: 4,
    resaleItem: { cost: 6.9, purchaseUnit: "carton 6", unitsPerPurchase: 6, supplier: "boissons", targetStock: 30, minStock: 12 },
  },
  {
    name: "Champagne brut", mode: "resale", ttc: 72.0, vat: 20, menuCategory: "vin", categoryPath: "Carte/Vins/Champagnes", popularity: 1,
    resaleItem: { cost: 22.5, purchaseUnit: "carton 6", unitsPerPurchase: 6, supplier: "boissons", targetStock: 18, minStock: 6 },
  },
];

// ---------------------------------------------------------------------------
// FOURNISSEURS
// ---------------------------------------------------------------------------

export const SUPPLIERS: Record<SupplierKey, {
  name: string; contact_name: string; email: string; phone: string;
  /** Jours de livraison (0 = dimanche). */
  deliveryDays: number[];
  /** Délai entre commande et livraison, en jours. */
  leadDays: number;
}> = {
  metro: { name: "Metro Cash & Carry Paris", contact_name: "Service pro", email: "commandes@metro-demo.fr", phone: "01 45 22 18 40", deliveryDays: [2, 5], leadDays: 1 },
  boucherie: { name: "Boucherie Saint-Éloi", contact_name: "Patrick Saint-Éloi", email: "contact@boucherie-sainteloi-demo.fr", phone: "01 42 33 76 12", deliveryDays: [1, 4], leadDays: 1 },
  maree: { name: "Marée du Comptoir", contact_name: "Hélène Vasseur", email: "commandes@maree-comptoir-demo.fr", phone: "01 43 61 09 55", deliveryDays: [2, 5], leadDays: 1 },
  primeur: { name: "Primeurs de Rungis", contact_name: "Yacine Amrani", email: "pro@primeurs-rungis-demo.fr", phone: "01 46 87 30 21", deliveryDays: [1, 3, 5], leadDays: 1 },
  boissons: { name: "France Boissons Île-de-France", contact_name: "Céline Marchand", email: "idf@france-boissons-demo.fr", phone: "01 40 19 62 77", deliveryDays: [3], leadDays: 2 },
};

// ---------------------------------------------------------------------------
// CALCUL DE COÛT MATIÈRE (contrôle de cohérence)
// ---------------------------------------------------------------------------

const ingredientByName = new Map(INGREDIENTS.map((i) => [i.name, i]));
const prepByName = new Map(PREPARATIONS.map((p) => [p.name, p]));
/** Articles de revente : ils existent en stock et peuvent entrer dans une recette (ex. le café du café gourmand). */
const resaleByName = new Map(
  DISHES.filter((d) => d.resaleItem).map((d) => [d.name, d.resaleItem!])
);

/** Coût unitaire d'un composant, quel que soit son type (ingrédient, préparation, revente). */
function componentUnitCost(name: string, seen: Set<string>): number {
  const ing = ingredientByName.get(name);
  if (ing) return ing.cost;
  if (prepByName.has(name)) return prepUnitCost(name, new Set(seen));
  const resale = resaleByName.get(name);
  if (resale) return resale.cost;
  return Number.NaN;
}

/** Coût de revient d'une unité de préparation (récursif sur les preps imbriquées). */
export function prepUnitCost(prepName: string, seen = new Set<string>()): number {
  const prep = prepByName.get(prepName);
  if (!prep) throw new Error(`Préparation inconnue : ${prepName}`);
  if (seen.has(prepName)) throw new Error(`Cycle de préparations sur ${prepName}`);
  seen.add(prepName);

  let batchCost = 0;
  for (const c of prep.components) {
    const unit = componentUnitCost(c.item, seen);
    if (Number.isNaN(unit)) {
      throw new Error(`Composant inconnu « ${c.item} » dans la préparation « ${prepName} »`);
    }
    batchCost += unit * c.qty;
  }
  return batchCost / prep.batchYield;
}

/** Coût matière d'une portion vendue. */
export function dishFoodCost(dish: DishDef): number {
  if (dish.mode === "resale") return dish.resaleItem?.cost ?? 0;
  let total = 0;
  for (const c of dish.recipe ?? []) {
    const unit = componentUnitCost(c.item, new Set());
    if (Number.isNaN(unit)) {
      throw new Error(`Composant inconnu « ${c.item} » dans le plat « ${dish.name} »`);
    }
    total += unit * c.qty;
  }
  return total;
}

export function priceHt(ttc: number, vat: number): number {
  return Math.round((ttc / (1 + vat / 100)) * 100) / 100;
}

/** Ratio matière / prix de vente HT, en %. */
export function foodCostRatio(dish: DishDef): number {
  const ht = priceHt(dish.ttc, dish.vat);
  return ht > 0 ? (dishFoodCost(dish) / ht) * 100 : 0;
}
