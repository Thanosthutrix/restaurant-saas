import type { ExpenseCategory } from "@/lib/pocket/expenseCategories";

export type AdministratifSectorId =
  | "locaux_energies"
  | "personnel"
  | "impots_taxes"
  | "banque_assurances"
  | "structure_operationnelle"
  | "autres";

export type ChargePreset = {
  label: string;
  periodicity: "monthly" | "quarterly" | "yearly";
};

export type AdministratifSectorConfig = {
  id: AdministratifSectorId;
  label: string;
  subtitle: string;
  /** Explication en langage restaurateur */
  helper: string;
  tone: string;
  tile: string;
  /** Filtre des charges existantes (postes bilan) */
  chargeCategories: ExpenseCategory[];
  /** Filtre des factures existantes */
  invoiceCategories: ExpenseCategory[];
  /** Poste enregistré pour une nouvelle charge ou facture */
  saveCategory: ExpenseCategory;
  showCharges: boolean;
  showInvestments: boolean;
  showInvoices: boolean;
  chargePresets: ChargePreset[];
  chargesTitle: string;
  chargesHint: string;
  invoicesTitle: string;
  invoicesHint: string;
  investmentsTitle?: string;
  investmentsHint?: string;
};

export const ADMINISTRATIF_SECTORS: AdministratifSectorConfig[] = [
  {
    id: "locaux_energies",
    label: "Locaux & énergies",
    subtitle: "Loyer, électricité, gaz, eau",
    helper: "Tout ce qui concerne votre local : le bail, les factures EDF, Engie, eau…",
    tone: "bg-sky-50 text-sky-700",
    tile: "tile-sky",
    chargeCategories: ["locaux"],
    invoiceCategories: ["locaux"],
    saveCategory: "locaux",
    showCharges: true,
    showInvestments: false,
    showInvoices: true,
    chargePresets: [
      { label: "Loyer ou bail", periodicity: "monthly" },
      { label: "Charges de copropriété", periodicity: "quarterly" },
    ],
    chargesTitle: "Paiements réguliers",
    chargesHint: "À renseigner si vous n'avez pas de facture (ex. virement au propriétaire chaque mois).",
    invoicesTitle: "Factures reçues",
    invoicesHint: "Déposez ici les factures EDF, gaz, eau, assurance du local…",
  },
  {
    id: "personnel",
    label: "Personnel",
    subtitle: "Mutuelle, prévoyance, médecine du travail",
    helper: "Les cotisations autour de vos salariés — pas les salaires eux-mêmes (gérés dans Équipe).",
    tone: "bg-rose-50 text-rose-700",
    tile: "tile-rose",
    chargeCategories: ["rh"],
    invoiceCategories: ["rh"],
    saveCategory: "rh",
    showCharges: true,
    showInvestments: false,
    showInvoices: true,
    chargePresets: [
      { label: "Mutuelle entreprise", periodicity: "monthly" },
      { label: "Prévoyance", periodicity: "monthly" },
    ],
    chargesTitle: "Cotisations employeur",
    chargesHint: "Montants prélevés chaque mois pour la mutuelle, la prévoyance, etc.",
    invoicesTitle: "Factures RH",
    invoicesHint: "Factures de mutuelle, médecine du travail, formation…",
  },
  {
    id: "impots_taxes",
    label: "Impôts & taxes",
    subtitle: "CFE, SACEM, taxes diverses",
    helper: "Les impôts et taxes qui ne passent pas par l'URSSAF des salaires.",
    tone: "bg-violet-50 text-violet-700",
    tile: "tile-violet",
    chargeCategories: ["impots_taxes"],
    invoiceCategories: ["impots_taxes"],
    saveCategory: "impots_taxes",
    showCharges: true,
    showInvestments: false,
    showInvoices: true,
    chargePresets: [
      { label: "CFE", periodicity: "yearly" },
      { label: "SACEM", periodicity: "yearly" },
    ],
    chargesTitle: "Taxes connues à l'avance",
    chargesHint: "Pour les montants fixes annuels ou trimestriels sans facture déposée.",
    invoicesTitle: "Avis et factures fiscales",
    invoicesHint: "Avis d'imposition, factures SACEM, taxes locales…",
  },
  {
    id: "banque_assurances",
    label: "Banque & assurances",
    subtitle: "Assurances, frais bancaires, emprunts",
    helper: "Vos contrats d'assurance et les échéances de prêt ou crédit-bail.",
    tone: "bg-copper-50 text-copper-700",
    tile: "tile-copper",
    chargeCategories: ["financier"],
    invoiceCategories: ["marketing_banque", "financier"],
    saveCategory: "marketing_banque",
    showCharges: true,
    showInvestments: false,
    showInvoices: true,
    chargePresets: [
      { label: "Échéance d'emprunt", periodicity: "monthly" },
      { label: "Assurance multirisque", periodicity: "yearly" },
      { label: "Frais bancaires", periodicity: "monthly" },
    ],
    chargesTitle: "Échéances sans facture",
    chargesHint: "Mensualité d'emprunt, assurance payée par virement, abonnement bancaire…",
    invoicesTitle: "Factures banque & assurance",
    invoicesHint: "Factures d'assureur, relevés de frais bancaires, crédit-bail…",
  },
  {
    id: "structure_operationnelle",
    label: "Structure opérationnelle",
    subtitle: "Équipement, travaux, gros investissements",
    helper: "Le matériel durable de votre restaurant : cuisine, salle, agencement — avec amortissement si besoin.",
    tone: "bg-emerald-50 text-emerald-700",
    tile: "tile-emerald",
    chargeCategories: ["entretien"],
    invoiceCategories: ["entretien"],
    saveCategory: "entretien",
    showCharges: true,
    showInvestments: true,
    showInvoices: true,
    chargePresets: [
      { label: "Contrat de maintenance", periodicity: "yearly" },
      { label: "Location longue durée", periodicity: "monthly" },
    ],
    chargesTitle: "Contrats et entretien",
    chargesHint: "Maintenance hotte, contrat frigoriste, location de matériel…",
    investmentsTitle: "Gros achats & amortissement",
    investmentsHint:
      "Un four, un plan de travail, des travaux : indiquez le prix et la durée pour estimer le coût mensuel.",
    invoicesTitle: "Factures d'équipement",
    invoicesHint: "Factures d'achat de matériel, travaux, installation…",
  },
  {
    id: "autres",
    label: "Autres dépenses",
    subtitle: "Comptable, logiciels, marketing…",
    helper: "Tout le reste : expert-comptable, logiciels, plateformes, publicité.",
    tone: "bg-amber-50 text-amber-700",
    tile: "tile-amber",
    chargeCategories: ["prestataires"],
    invoiceCategories: ["prestataires", "marketing_banque"],
    saveCategory: "prestataires",
    showCharges: true,
    showInvestments: false,
    showInvoices: true,
    chargePresets: [
      { label: "Expert-comptable", periodicity: "monthly" },
      { label: "Abonnement logiciel", periodicity: "monthly" },
    ],
    chargesTitle: "Abonnements & prestataires",
    chargesHint: "Honoraires comptables, SaaS, abonnements récurrents sans facture systématique.",
    invoicesTitle: "Factures diverses",
    invoicesHint: "Factures comptable, Zenchef, Uber Eats, publicité…",
  },
];

const BANK_INSURANCE_RE =
  /\b(banque|crédit|credit|assurance|axa|maif|maaf|allianz|generali|groupama|lcl|bnp|socgen|société générale|caisse d'épargne|crédit agricole|mutuel|crédit-bail|credit-bail|leasing)\b/i;

const MARKETING_DELIVERY_RE =
  /\b(uber\s?eats|deliveroo|just\s?eat|meta|google\s?ads|facebook|thefork|lafourchette|tiktok|instagram)\b/i;

export function getAdministratifSector(id: AdministratifSectorId): AdministratifSectorConfig {
  const sector = ADMINISTRATIF_SECTORS.find((s) => s.id === id);
  if (!sector) throw new Error(`Secteur administratif inconnu: ${id}`);
  return sector;
}

/** Classe une facture dans l'un des 6 espaces (exclut matières premières). */
export function resolveInvoiceAdministratifSector(
  expenseCategory: ExpenseCategory,
  supplierName: string
): AdministratifSectorId | null {
  if (expenseCategory === "matieres") return null;

  if (expenseCategory === "locaux") return "locaux_energies";
  if (expenseCategory === "rh") return "personnel";
  if (expenseCategory === "impots_taxes") return "impots_taxes";
  if (expenseCategory === "entretien") return "structure_operationnelle";
  if (expenseCategory === "prestataires") return "autres";
  if (expenseCategory === "financier") return "banque_assurances";

  if (expenseCategory === "marketing_banque") {
    const name = supplierName.trim();
    if (BANK_INSURANCE_RE.test(name)) return "banque_assurances";
    if (MARKETING_DELIVERY_RE.test(name)) return "autres";
    return "autres";
  }

  return "autres";
}

/** Classe une charge fixe dans l'espace administratif. */
export function resolveChargeAdministratifSector(expenseCategory: ExpenseCategory): AdministratifSectorId | null {
  if (expenseCategory === "matieres") return null;
  for (const sector of ADMINISTRATIF_SECTORS) {
    if (sector.chargeCategories.includes(expenseCategory)) return sector.id;
  }
  return "autres";
}

/** Tous les investissements vivent dans Structure opérationnelle. */
export function resolveInvestmentAdministratifSector(): AdministratifSectorId {
  return "structure_operationnelle";
}

export function administratifSectorIds(): AdministratifSectorId[] {
  return ADMINISTRATIF_SECTORS.map((s) => s.id);
}
