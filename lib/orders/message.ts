/**
 * Génération du message de commande prêt à envoyer (email / copier-coller).
 */

import type { Supplier } from "@/lib/db";
import type { SuggestedLine } from "./suggestions";

export type OrderLineForMessage = {
  name: string;
  quantity: number;
  purchase_unit: string;
  supplier_sku?: string | null;
};

/**
 * Génère un texte de commande poli, prêt à envoyer au fournisseur.
 */
export function generateOrderMessage(
  supplier: Supplier,
  lines: OrderLineForMessage[],
  restaurantName: string
): string {
  const parts: string[] = [];
  parts.push("Bonjour,");
  parts.push("");
  parts.push(`Merci de nous préparer la commande suivante pour ${restaurantName} :`);
  parts.push("");

  for (const line of lines) {
    const ref = line.supplier_sku ? ` (réf. ${line.supplier_sku})` : "";
    parts.push(`- ${line.name} : ${line.quantity} ${line.purchase_unit}${ref}`);
  }

  parts.push("");
  parts.push("Cordialement");

  return parts.join("\n");
}

/**
 * Convertit les lignes suggérées en format pour le message.
 */
export function suggestedLinesToMessageLines(lines: SuggestedLine[]): OrderLineForMessage[] {
  return lines.map((l) => ({
    name: l.name,
    quantity: l.suggested_quantity_purchase,
    purchase_unit: l.purchase_unit ?? "unité(s)",
    supplier_sku: l.supplier_sku,
  }));
}
