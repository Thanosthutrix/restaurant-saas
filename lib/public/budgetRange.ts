/** Fourchette de budget dérivée du prix moyen des plats publics (€ TTC). */
export function formatBudgetRange(avgPriceTtc: number | null | undefined): string {
  if (avgPriceTtc == null || !Number.isFinite(avgPriceTtc) || avgPriceTtc <= 0) {
    return "Budget non renseigné";
  }
  if (avgPriceTtc < 18) return "€ · Économique";
  if (avgPriceTtc < 35) return "€€ · Modéré";
  return "€€€ · Premium";
}
