/**
 * Libellés d’affichage des commandes table (salle / caisse / ticket).
 * Ex. "12 · Martin Dupont" (sans le préfixe « Table ») pour les listes qui ajoutent « Table ».
 */

/** Ligne courte : "12" ou "12 · Nom" (sert aussi dans la caisse : affichage `Table ${ligne}`). */
export function diningTableTicketLineLabel(
  tableLabel: string,
  customerDisplayName: string | null | undefined
): string {
  const t = (tableLabel || "—").trim();
  const n = customerDisplayName?.trim();
  return n ? `${t} · ${n}` : t;
}

/** Titre complet pour le bandeau du ticket / sous-titre de page : "Table 12 · Nom". */
export function diningTableTicketTitle(
  tableLabel: string,
  customerDisplayName: string | null | undefined
): string {
  return `Table ${diningTableTicketLineLabel(tableLabel, customerDisplayName)}`;
}
