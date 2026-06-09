const LABELS: Record<string, string> = {
  pizzeria: "Pizzeria",
  "snack-fastfood": "Snack / Fast-food",
  "brasserie-traditionnel": "Brasserie / Traditionnel",
  "boulangerie-patisserie": "Boulangerie / Pâtisserie",
  "bar-cafe": "Bar / Café",
  "glacier-crepe-gaufre": "Glacier / Crêpe / Gaufre",
};

/** Libellé FR lisible d'un type d'établissement (template_slug). */
export function getEstablishmentTypeLabelFr(slug: string | null | undefined): string {
  if (!slug) return "Établissement";
  return LABELS[slug] ?? "Établissement";
}
