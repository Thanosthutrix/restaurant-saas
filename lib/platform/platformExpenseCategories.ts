/** Postes comptables pour la société éditrice Ubion (SaaS). */

export const PLATFORM_EXPENSE_CATEGORIES = [
  { value: "infra_hebergement", label: "Hébergement & infrastructure" },
  { value: "logiciels_saas", label: "Logiciels & abonnements SaaS" },
  { value: "marketing", label: "Marketing & communication" },
  { value: "rh_personnel", label: "Personnel & RH" },
  { value: "prestataires", label: "Prestataires (comptable, juridique…)" },
  { value: "bureaux", label: "Bureaux, déplacements & frais généraux" },
  { value: "impots_taxes", label: "Impôts, taxes & cotisations" },
  { value: "financier", label: "Charges financières" },
  { value: "divers", label: "Divers" },
] as const;

export type PlatformExpenseCategory = (typeof PLATFORM_EXPENSE_CATEGORIES)[number]["value"];

export const PLATFORM_EXPENSE_CATEGORY_VALUES: readonly PlatformExpenseCategory[] =
  PLATFORM_EXPENSE_CATEGORIES.map((c) => c.value);

export function isPlatformExpenseCategory(
  value: string | null | undefined
): value is PlatformExpenseCategory {
  return value != null && (PLATFORM_EXPENSE_CATEGORY_VALUES as readonly string[]).includes(value);
}

export function getPlatformExpenseCategoryLabel(value: PlatformExpenseCategory): string {
  return PLATFORM_EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

const KEYWORD_RULES: { category: PlatformExpenseCategory; patterns: RegExp }[] = [
  {
    category: "infra_hebergement",
    patterns: /\b(vercel|supabase|aws|amazon|google\s?cloud|azure|cloudflare|ovh|scaleway|hetzner|héberg|heberg|serveur|domaine)\b/i,
  },
  {
    category: "logiciels_saas",
    patterns: /\b(stripe|github|notion|figma|slack|openai|anthropic|cursor|saas|abonnement|licence|software)\b/i,
  },
  {
    category: "marketing",
    patterns: /\b(meta|facebook|google\s?ads|linkedin|publicit|marketing|agence|community)\b/i,
  },
  {
    category: "rh_personnel",
    patterns: /\b(urssaf|mutuelle|pr[eé]voyance|salaire|paie|int[eé]rim|recrutement|indeed)\b/i,
  },
  {
    category: "prestataires",
    patterns: /\b(comptab|expert[-\s]?comptable|avocat|juridique|cabinet|conseil)\b/i,
  },
  {
    category: "bureaux",
    patterns: /\b(loyer|bail|bureau|cowork|d[eé]placement|transport|restaurant|repas)\b/i,
  },
  {
    category: "impots_taxes",
    patterns: /\b(imp[oô]ts?|dgfip|cfe|tva|taxe|tr[eé]sor\s?public)\b/i,
  },
  {
    category: "financier",
    patterns: /\b(banque|cr[eé]dit|emprunt|int[eé]r[eê]ts|frais\s?bancaires)\b/i,
  },
];

export function guessPlatformExpenseCategory(text: string | null | undefined): PlatformExpenseCategory {
  const t = (text ?? "").trim();
  if (t) {
    for (const rule of KEYWORD_RULES) {
      if (rule.patterns.test(t)) return rule.category;
    }
  }
  return "divers";
}
