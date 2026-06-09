import type { HcrEmployeeStatus } from "./types";

export type ConventionIdcc = "1974" | "1501" | "1266" | "843";

export interface ConventionTrialPeriodRule {
  defaultMonths: number;
  maxMonths: number;
  renewable: boolean;
  legalText: string;
}

export interface ConventionOvertimeBand {
  fromHour: number;
  toHour: number | null;
  premiumPercent: number;
  premiumPercentWithModulation?: number;
}

export interface ConventionFeatures {
  allowTrialRenewal: boolean;
  defaultPlanningNoticeDays: number;
  minMutuelleEmployerShare: number;
  defaultAbsenceJustificationHours: number;
  preavisCalculMode: "auto" | "custom_allowed";
}

export interface ConventionRegistryEntry {
  idcc: ConventionIdcc;
  shortLabel: string;
  fullLabel: string;
  headerLabel: string;
  overtimeBands: ConventionOvertimeBand[];
  trialPeriodsCdi: Record<HcrEmployeeStatus, ConventionTrialPeriodRule>;
  mealOrBenefitArticle: {
    kind: "hcr_meal_benefit" | "fast_food_meal_allowance" | "collective_13th_month" | "bakery_specific_premiums";
    template: string;
    requiredVariables?: string[];
  };
  constraints: {
    partTimeMinimumWeeklyHours?: number;
    minimumShiftDurationHours?: number;
    maxDailyBreakHours?: number;
    nightWorkStart?: string;
    nightWorkEnd?: string;
    nightPremiumPercent?: number;
    sundayPremiumPercent?: number;
  };
  features: ConventionFeatures;
  legalNotes: string[];
}

export const CONVENTION_REGISTRY: Record<ConventionIdcc, ConventionRegistryEntry> = {
  "1974": {
    idcc: "1974",
    shortLabel: "HCR",
    fullLabel: "Hôtels, Cafés, Restaurants",
    headerLabel: "CONVENTION COLLECTIVE NATIONALE DES HÔTELS, CAFÉS, RESTAURANTS (IDCC 1974)",
    overtimeBands: [
      { fromHour: 36, toHour: 39, premiumPercent: 25, premiumPercentWithModulation: 10 },
      { fromHour: 40, toHour: 43, premiumPercent: 20 },
      { fromHour: 44, toHour: null, premiumPercent: 50 },
    ],
    trialPeriodsCdi: {
      employee: { defaultMonths: 2, maxMonths: 2, renewable: true, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 2 mois." },
      supervisor: { defaultMonths: 3, maxMonths: 3, renewable: true, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 3 mois." },
      executive: { defaultMonths: 4, maxMonths: 4, renewable: true, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 4 mois." },
    },
    mealOrBenefitArticle: {
      kind: "hcr_meal_benefit",
      template: "Le Salarié bénéficiera de l'avantage en nature nourriture obligatoire, évalué selon le Minimum Garanti URSSAF en vigueur, dès lors qu'il est présent dans l'établissement au moment des services de repas.",
    },
    constraints: {},
    features: {
      allowTrialRenewal: true,
      defaultPlanningNoticeDays: 3,
      minMutuelleEmployerShare: 50,
      defaultAbsenceJustificationHours: 48,
      preavisCalculMode: "auto",
    },
    legalNotes: [
      "Heures Sup : 36e-39e à 25% (10% si modulation), 40e-43e à 20%, >43e à 50%.",
      "Repas : Avantage en nature obligatoire (Minimum Garanti URSSAF).",
    ],
  },
  "1501": {
    idcc: "1501",
    shortLabel: "Restauration Rapide",
    fullLabel: "Restauration Rapide",
    headerLabel: "CONVENTION COLLECTIVE NATIONALE DE LA RESTAURATION RAPIDE (IDCC 1501)",
    overtimeBands: [
      { fromHour: 36, toHour: 43, premiumPercent: 25 },
      { fromHour: 44, toHour: null, premiumPercent: 50 },
    ],
    trialPeriodsCdi: {
      employee: { defaultMonths: 1, maxMonths: 1, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 1 mois ferme." },
      supervisor: { defaultMonths: 3, maxMonths: 3, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 3 mois ferme." },
      executive: { defaultMonths: 4, maxMonths: 4, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 4 mois ferme." },
    },
    mealOrBenefitArticle: {
      kind: "fast_food_meal_allowance",
      requiredVariables: ["MontantPanier"],
      template: "Le Salarié bénéficiera d'une indemnité forfaitaire de panier de repas d'un montant de {MontantPanier} € par jour travaillé, conformément aux conditions d'organisation des shifts de l'établissement.",
    },
    constraints: { partTimeMinimumWeeklyHours: 24, minimumShiftDurationHours: 2 },
    features: {
      allowTrialRenewal: false,
      defaultPlanningNoticeDays: 3,
      minMutuelleEmployerShare: 50,
      defaultAbsenceJustificationHours: 48,
      preavisCalculMode: "custom_allowed",
    },
    legalNotes: [
      "Heures Sup : 25% dès la 36e heure, 50% au-delà de la 43e heure.",
      "Temps partiel : Minimum 24h/semaine, shifts de minimum 2h.",
    ],
  },
  "1266": {
    idcc: "1266",
    shortLabel: "Restauration Collective",
    fullLabel: "Restauration Collective",
    headerLabel: "CONVENTION COLLECTIVE NATIONALE DE LA RESTAURATION COLLECTIVE (IDCC 1266)",
    overtimeBands: [
      { fromHour: 36, toHour: 43, premiumPercent: 25 },
      { fromHour: 44, toHour: null, premiumPercent: 50 },
    ],
    trialPeriodsCdi: {
      employee: { defaultMonths: 2, maxMonths: 2, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 2 mois." },
      supervisor: { defaultMonths: 3, maxMonths: 3, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 3 mois." },
      executive: { defaultMonths: 4, maxMonths: 4, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 4 mois." },
    },
    mealOrBenefitArticle: {
      kind: "collective_13th_month",
      template: "Conformément aux dispositions de la CCN de la Restauration Collective, le Salarié bénéficiera du versement d'un 13e mois de salaire, calculé au prorata de son temps de travail effectif après l'acquisition d'un an d'ancienneté continue au sein de l'établissement.",
    },
    constraints: { maxDailyBreakHours: 2 },
    features: {
      allowTrialRenewal: false,
      defaultPlanningNoticeDays: 7,
      minMutuelleEmployerShare: 50,
      defaultAbsenceJustificationHours: 48,
      preavisCalculMode: "auto",
    },
    legalNotes: [
      "13e Mois : Obligatoire après 1 an d'ancienneté continue.",
      "Coupures : Plafonnées à un maximum de 2h par jour.",
    ],
  },
  "843": {
    idcc: "843",
    shortLabel: "Boulangerie-Pâtisserie",
    fullLabel: "Boulangerie-Pâtisserie Artisanale",
    headerLabel: "CONVENTION COLLECTIVE NATIONALE DE LA BOULANGERIE-PÂTISSERIE ARTISANALE (IDCC 843)",
    overtimeBands: [
      { fromHour: 36, toHour: 43, premiumPercent: 25 },
      { fromHour: 44, toHour: null, premiumPercent: 50 },
    ],
    trialPeriodsCdi: {
      employee: { defaultMonths: 1, maxMonths: 1, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 1 mois ferme." },
      supervisor: { defaultMonths: 2, maxMonths: 2, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 2 mois ferme." },
      executive: { defaultMonths: 3, maxMonths: 3, renewable: false, legalText: "Le présent contrat est conclu sous réserve d'une période d'essai de 3 mois ferme." },
    },
    mealOrBenefitArticle: {
      kind: "bakery_specific_premiums",
      template: "Les heures de travail effectuées de nuit entre 21h00 et 06h00 donneront lieu à une majoration horaire conventionnelle de 25%. Les heures de travail effectuées le dimanche donneront lieu à une majoration spécifique minimale de 20% du salaire brut horaire.",
    },
    constraints: { nightWorkStart: "21:00", nightWorkEnd: "06:00", nightPremiumPercent: 25, sundayPremiumPercent: 20 },
    features: {
      allowTrialRenewal: false,
      defaultPlanningNoticeDays: 3,
      minMutuelleEmployerShare: 50,
      defaultAbsenceJustificationHours: 48,
      preavisCalculMode: "custom_allowed",
    },
    legalNotes: [
      "Travail de nuit : Heures majorées à 25% entre 21h et 6h.",
      "Dimanche : Majoration spécifique de 20% minimum.",
    ],
  },
};

export const DEFAULT_CONVENTION_IDCC: ConventionIdcc = "1974";

export function getConventionConfig(idcc: string | null | undefined): ConventionRegistryEntry {
  if (idcc === "1974" || idcc === "1501" || idcc === "1266" || idcc === "843") {
    return CONVENTION_REGISTRY[idcc];
  }

  return CONVENTION_REGISTRY[DEFAULT_CONVENTION_IDCC];
}
