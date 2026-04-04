/**
 * Templates de restaurant V1 — pré-remplissage des composants stock à l'onboarding.
 * Fichier statique TypeScript : pas de table SQL pour les templates.
 * Tout reste modifiable ensuite dans l'interface.
 */

import type { AllowedUnit } from "@/lib/constants";

export type TemplateItemType = "ingredient" | "prep" | "resale";

/** Un composant par défaut fourni par le template. */
export type RestaurantTemplateComponent = {
  name: string;
  type: TemplateItemType;
  unit: AllowedUnit;
  current_stock_qty: number;
  min_stock_qty: number | null;
};

/** Plat suggéré par le template. Mode = prepared (préparé) ou resale (revente). */
export type RestaurantTemplateSuggestedDish = {
  name: string;
  production_mode: "prepared" | "resale";
};

/** Un template de restaurant : composants stock suggérés + plats suggérés. */
export type RestaurantTemplate = {
  slug: string;
  name: string;
  description: string;
  /** Composants stock suggérés (inventory_items). */
  components: RestaurantTemplateComponent[];
  /** Plats suggérés (dishes). Affichés sur /dishes, appliqués sans doublon. */
  suggestedDishes: RestaurantTemplateSuggestedDish[];
};

const TEMPLATES: RestaurantTemplate[] = [
  {
    slug: "pizzeria",
    name: "Pizzeria",
    description: "Pizza, boissons, ingrédients de base.",
    components: [
      { name: "Farine", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Eau", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 10000 },
      { name: "Levure", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Sel", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Huile d'olive", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Sauce tomate", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 3000 },
      { name: "Mozzarella", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Jambon", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Champignons", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Olives", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Chèvre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Lardons", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Merguez", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 20 },
      { name: "Origan", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 100 },
      { name: "Bière 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Coca 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Eau minérale", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
    ],
    suggestedDishes: [
      { name: "Pizza Margherita", production_mode: "prepared" },
      { name: "Pizza 4 fromages", production_mode: "prepared" },
      { name: "Pizza Reine", production_mode: "prepared" },
      { name: "Pizza pepperoni", production_mode: "prepared" },
      { name: "Coca 33cl", production_mode: "resale" },
      { name: "Bière 33cl", production_mode: "resale" },
      { name: "Eau minérale", production_mode: "resale" },
    ],
  },
  {
    slug: "snack-fastfood",
    name: "Snack / Fast-food",
    description: "Burgers, kebabs, frites, boissons.",
    components: [
      { name: "Pain burger", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 30 },
      { name: "Steak haché", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Cheddar", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Salade", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Tomate", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Oignon", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Sauce burger", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Sauce blanche", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Tortilla", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 20 },
      { name: "Kebab", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Poulet", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Frites", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Huile de friture", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Coca 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Eau minérale", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
    ],
    suggestedDishes: [
      { name: "Burger classique", production_mode: "prepared" },
      { name: "Burger cheese", production_mode: "prepared" },
      { name: "Kebab", production_mode: "prepared" },
      { name: "Frites", production_mode: "prepared" },
      { name: "Coca 33cl", production_mode: "resale" },
      { name: "Eau minérale", production_mode: "resale" },
    ],
  },
  {
    slug: "brasserie-traditionnel",
    name: "Brasserie / Restaurant traditionnel",
    description: "Cuisine classique, produits frais, boissons.",
    components: [
      { name: "Beurre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Crème", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Lait", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 3000 },
      { name: "Œufs", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 60 },
      { name: "Farine", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Pommes de terre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Salade", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Tomate", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Oignon", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Poulet", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Steak haché", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Saumon", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Riz", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Pâtes", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Sucre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Cacao", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Coca 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 12 },
      { name: "Eau minérale", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Vin rouge", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 6 },
      { name: "Vin blanc", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 6 },
    ],
    suggestedDishes: [
      { name: "Steak frites", production_mode: "prepared" },
      { name: "Poulet rôti", production_mode: "prepared" },
      { name: "Saumon riz", production_mode: "prepared" },
      { name: "Salade composée", production_mode: "prepared" },
      { name: "Coca 33cl", production_mode: "resale" },
      { name: "Eau minérale", production_mode: "resale" },
      { name: "Vin rouge", production_mode: "resale" },
      { name: "Vin blanc", production_mode: "resale" },
    ],
  },
  {
    slug: "boulangerie-patisserie",
    name: "Boulangerie / Pâtisserie",
    description: "Farine, pâte, viennoiseries, boissons chaudes.",
    components: [
      { name: "Farine", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 10000 },
      { name: "Beurre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Sucre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 3000 },
      { name: "Lait", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Œufs", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 120 },
      { name: "Levure boulangère", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Levure chimique", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 200 },
      { name: "Chocolat", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Amandes", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Crème", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Confiture", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Jambon", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Fromage", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Salade", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Café", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Thé", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 200 },
    ],
    suggestedDishes: [
      { name: "Croissant", production_mode: "prepared" },
      { name: "Pain au chocolat", production_mode: "prepared" },
      { name: "Sandwich jambon-beurre", production_mode: "prepared" },
      { name: "Quiche", production_mode: "prepared" },
      { name: "Tarte aux pommes", production_mode: "prepared" },
      { name: "Café", production_mode: "resale" },
      { name: "Thé", production_mode: "resale" },
    ],
  },
  {
    slug: "bar-cafe",
    name: "Bar / Café",
    description: "Boissons chaudes et froides, snacking.",
    components: [
      { name: "Café grain", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Thé", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Chocolat en poudre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Lait", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Sucre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Citron", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 20 },
      { name: "Menthe", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 100 },
      { name: "Eau minérale", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Coca 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Bière 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Vin rouge", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 12 },
      { name: "Vin blanc", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 12 },
      { name: "Chips", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Cacahuètes", type: "resale", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
    ],
    suggestedDishes: [
      { name: "Café expresso", production_mode: "resale" },
      { name: "Café crème", production_mode: "resale" },
      { name: "Thé", production_mode: "resale" },
      { name: "Coca 33cl", production_mode: "resale" },
      { name: "Bière 33cl", production_mode: "resale" },
      { name: "Vin rouge", production_mode: "resale" },
      { name: "Vin blanc", production_mode: "resale" },
      { name: "Eau minérale", production_mode: "resale" },
      { name: "Chips", production_mode: "resale" },
      { name: "Cacahuètes", production_mode: "resale" },
    ],
  },
  {
    slug: "glacier-crepe-gaufre",
    name: "Glacier / Crêpe / Gaufre",
    description: "Pâte à crêpe, glaces, garnitures, boissons.",
    components: [
      { name: "Farine", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Lait", type: "ingredient", unit: "ml", current_stock_qty: 0, min_stock_qty: 5000 },
      { name: "Œufs", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 60 },
      { name: "Beurre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Sucre", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Pâte à tartiner", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Chocolat", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Chantilly", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 1000 },
      { name: "Caramel", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Fraise", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Banane", type: "ingredient", unit: "unit", current_stock_qty: 0, min_stock_qty: 20 },
      { name: "Vanille", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 100 },
      { name: "Glace vanille", type: "prep", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Glace chocolat", type: "prep", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Glace fraise", type: "prep", unit: "g", current_stock_qty: 0, min_stock_qty: 2000 },
      { name: "Coulis chocolat", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Coulis fraise", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Café", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 500 },
      { name: "Thé", type: "ingredient", unit: "g", current_stock_qty: 0, min_stock_qty: 200 },
      { name: "Coca 33cl", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
      { name: "Eau minérale", type: "resale", unit: "unit", current_stock_qty: 0, min_stock_qty: 24 },
    ],
    suggestedDishes: [
      { name: "Crêpe beurre sucre", production_mode: "prepared" },
      { name: "Crêpe Nutella", production_mode: "prepared" },
      { name: "Gaufre nature", production_mode: "prepared" },
      { name: "Gaufre Chantilly", production_mode: "prepared" },
      { name: "Boule vanille", production_mode: "prepared" },
      { name: "Boule chocolat", production_mode: "prepared" },
      { name: "Sundae", production_mode: "prepared" },
      { name: "Café", production_mode: "resale" },
      { name: "Thé", production_mode: "resale" },
      { name: "Coca 33cl", production_mode: "resale" },
      { name: "Eau minérale", production_mode: "resale" },
    ],
  },
];

/** Liste de tous les templates (pour l'onboarding). */
export function getRestaurantTemplates(): RestaurantTemplate[] {
  return TEMPLATES;
}

/** Récupère un template par son slug, ou undefined. */
export function getRestaurantTemplateBySlug(slug: string): RestaurantTemplate | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

/** Valeur du sélecteur « autre / sans modèle » à l’onboarding (ou nouvel établissement). */
export const RESTAURANT_PROFILE_OTHER = "other" as const;

export type ResolvedRestaurantProfile = {
  template_slug: string | null;
  /** Aligné sur le slug du template quand un modèle est choisi, sinon `other`. */
  activity_type: string;
  template: RestaurantTemplate | undefined;
};

/**
 * À partir du choix unique (slug template ou `other`), déduit slug stocké + activité + objet template.
 */
export function resolveRestaurantProfile(profile: string): ResolvedRestaurantProfile {
  const trimmed = profile.trim();
  if (!trimmed || trimmed === RESTAURANT_PROFILE_OTHER) {
    return { template_slug: null, activity_type: "other", template: undefined };
  }
  const template = getRestaurantTemplateBySlug(trimmed);
  if (!template) {
    return { template_slug: null, activity_type: "other", template: undefined };
  }
  return { template_slug: trimmed, activity_type: trimmed, template };
}
