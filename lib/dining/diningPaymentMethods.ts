/** Moyens d’encaissement salle / caisse — fichier séparé pour import côté client sans tirer les server actions. */

export const DINING_PAYMENT_METHODS = ["card", "cash", "cheque"] as const;

export type DiningPaymentMethod = (typeof DINING_PAYMENT_METHODS)[number];

export const DINING_PAYMENT_LABEL_FR: Record<DiningPaymentMethod, string> = {
  card: "Carte bancaire",
  cash: "Espèces",
  cheque: "Chèques",
};

/** Valeur DB → clé UI (legacy `other` → chèque). */
export function parseDiningPaymentMethod(raw: string | null | undefined): DiningPaymentMethod {
  if (raw === "cash" || raw === "card" || raw === "cheque") return raw;
  if (raw === "other") return "cheque";
  return "card";
}
