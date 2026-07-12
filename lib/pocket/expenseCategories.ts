/**
 * Postes comptables des dépenses d'un restaurant — taxonomie du bilan « Ma poche ».
 * Chaque facture fournisseur est classée dans un poste (par l'IA à l'analyse,
 * corrigeable à la main), ainsi que chaque charge récurrente manuelle.
 */

export const EXPENSE_CATEGORIES = [
  { value: "matieres", label: "Matières premières & consommables" },
  { value: "rh", label: "Personnel & RH" },
  { value: "locaux", label: "Locaux, énergies & assurances" },
  { value: "entretien", label: "Entretien, maintenance & petit matériel" },
  { value: "prestataires", label: "Prestataires & frais généraux" },
  { value: "marketing_banque", label: "Ventes, marketing & banque" },
  { value: "impots_taxes", label: "Impôts, taxes & droits" },
  { value: "financier", label: "Charges financières & amortissements" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

export const EXPENSE_CATEGORY_VALUES: readonly ExpenseCategory[] = EXPENSE_CATEGORIES.map(
  (c) => c.value
);

export function isExpenseCategory(value: string | null | undefined): value is ExpenseCategory {
  return value != null && (EXPENSE_CATEGORY_VALUES as readonly string[]).includes(value);
}

export function getExpenseCategoryLabel(value: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * Classement heuristique par mots-clés (nom du fournisseur / libellé) — utilisé en
 * secours quand l'IA n'a pas fourni de poste. Par défaut : matières premières
 * (le pipeline factures historique ne servait qu'aux achats alimentaires).
 */
const KEYWORD_RULES: { category: ExpenseCategory; patterns: RegExp }[] = [
  { category: "locaux", patterns: /\b(edf|engie|total\s?energies|eni|gaz|electricit|eau|veolia|suez|saur|assurance|axa|maaf|maif|allianz|generali|groupama|loyer|bail|copropri)/i },
  { category: "impots_taxes", patterns: /\b(sacem|spre|cfe|urssaf|imp[oô]ts?|tr[eé]sor\s?public|dgfip|taxe)/i },
  { category: "marketing_banque", patterns: /\b(uber\s?eats|deliveroo|just\s?eat|edenred|swile|up\s?d[eé]jeuner|pluxee|sumup|stripe|zettle|banque|cr[eé]dit\s(agricole|mutuel)|bnp|soci[eé]t[eé]\s?g[eé]n[eé]rale|lcl|meta|google\s?ads|facebook)/i },
  { category: "entretien", patterns: /\b(hotte|extraction|bac\s?[aà]\s?graisse|maintenance|d[eé]pannage|blanchisserie|elis|initial|rentokil|d[eé]ratisation|plombier|frigoriste)/i },
  { category: "prestataires", patterns: /\b(comptab|expert[-\s]?comptable|avocat|juridique|logiciel|saas|abonnement|zenchef|thefork|lafourchette|sevenrooms|libeo|pennylane)/i },
  { category: "rh", patterns: /\b(mutuelle|pr[eé]voyance|m[eé]decine\s?du\s?travail|formation|int[eé]rim|recrutement|indeed|v[eê]tements?\s?pro)/i },
  { category: "financier", patterns: /\b(emprunt|[eé]ch[eé]ance\s?pr[eê]t|int[eé]r[eê]ts|leasing|cr[eé]dit[-\s]?bail)/i },
];

export function guessExpenseCategory(text: string | null | undefined): ExpenseCategory {
  const t = (text ?? "").trim();
  if (t) {
    for (const rule of KEYWORD_RULES) {
      if (rule.patterns.test(t)) return rule.category;
    }
  }
  return "matieres";
}
