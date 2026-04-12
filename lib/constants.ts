/**
 * ID du restaurant en dur (legacy).
 * Pour les nouvelles pages, utiliser getCurrentRestaurant() depuis @/lib/auth
 * et passer restaurant.id (le restaurant du compte connecté).
 */
export const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111" as const;

export const SERVICE_TYPES = ["lunch", "dinner"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Unités autorisées pour les composants stock (inventory_items). */
export const ALLOWED_UNITS = ["g", "kg", "ml", "l", "unit", "sceau"] as const;
export type AllowedUnit = (typeof ALLOWED_UNITS)[number];

/** Libellés courts pour les listes (valeur en base = clé). */
export const STOCK_UNIT_LABEL_FR: Record<AllowedUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L (litre)",
  unit: "unité",
  sceau: "sceau",
};

const STOCK_UNIT_ALIASES: Record<string, AllowedUnit> = {
  litre: "l",
  litres: "l",
  ltr: "l",
  liter: "l",
  liters: "l",
  kilogramme: "kg",
  kilogrammes: "kg",
  sceaux: "sceau",
};

export function isAllowedUnit(s: string): s is AllowedUnit {
  return ALLOWED_UNITS.includes(s as AllowedUnit);
}

/** Texte d’aide pour les messages d’erreur (création / édition composant). */
export const ALLOWED_STOCK_UNITS_HELP_FR = "g, kg, ml, L (litre), unité ou sceau";

/**
 * Normalise une saisie vers une unité de stock canonique (clé DB).
 * Accepte les alias français / anglais courants pour l et kg.
 */
export function parseAllowedStockUnit(s: string): AllowedUnit | null {
  const t = s.trim().toLowerCase();
  if (isAllowedUnit(t)) return t;
  return STOCK_UNIT_ALIASES[t] ?? null;
}

/** Nom du bucket Storage pour les BL (bons de livraison). Utilisable côté client et serveur. */
export const DELIVERY_NOTES_BUCKET = "delivery-notes";

/** Types d’élément pour les photos de traçabilité à la réception (registre). */
export const TRACEABILITY_ELEMENT_TYPES = ["ingredient", "prep", "resale", "other"] as const;
export type TraceabilityElementType = (typeof TRACEABILITY_ELEMENT_TYPES)[number];

export const TRACEABILITY_ELEMENT_LABEL_FR: Record<TraceabilityElementType, string> = {
  ingredient: "Ingrédient",
  prep: "Préparation",
  resale: "Revente",
  other: "Autre",
};

/** Nom du bucket Storage pour les factures fournisseur. */
export const SUPPLIER_INVOICES_BUCKET = "supplier-invoices";

/** Preuves photo pour les tâches de nettoyage critiques (PND). */
export const HYGIENE_PROOFS_BUCKET = "hygiene-proofs";
