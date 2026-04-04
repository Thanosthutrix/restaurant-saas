export type MenuSuggestionMode = "prepared" | "resale" | "ignore";

export type MenuSuggestionItem = {
  raw_label: string;
  normalized_label: string;
  suggested_mode: MenuSuggestionMode;
  confidence?: number;
  /** Prix de vente TTC affiché sur la carte (€), si lisible. */
  selling_price_ttc?: number | null;
  /** Taux TVA % (ex. 5.5, 10, 20). Si omis, défaut 10 % (préparé) ou 20 % (revente). */
  selling_vat_rate_pct?: number | null;
  /** @deprecated Ancien champ analyse — traité comme TTC si selling_price_ttc absent. */
  selling_price_ht?: number | null;
  /** Ingrédients explicitement mentionnés ou fortement probables (pas de quantités, pas d’invention). */
  suggested_ingredients: string[];
};
