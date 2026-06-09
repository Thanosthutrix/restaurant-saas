import type {
  HcrCddReason,
  HcrClauseKey,
  HcrEchelon,
  HcrEmployeeStatus,
  HcrJobCode,
  HcrLevel,
} from "./types";
import { getConventionConfig } from "./conventionRegistry";

export const HCR_COLLECTIVE_AGREEMENT = {
  label: "Hôtels, cafés, restaurants",
  idcc: "1974",
  requestedIdccFallback: "1979",
  revisionDate: "2026-06-08",
  warning:
    "Vérifier l'IDCC, les minima conventionnels et le minimum garanti avant toute mise en production.",
} as const;

export const HCR_LEGAL_REFERENCES = {
  laborCode: "Code du travail",
  collectiveAgreement: "Convention collective nationale HCR",
  sourceWarning:
    "Les clauses types ne remplacent pas la revue d'un conseil juridique, notamment pour les CDD et clauses restrictives.",
} as const;

export interface HcrJobPreset {
  code: HcrJobCode;
  label: string;
  defaultStatus: HcrEmployeeStatus;
  defaultLevel: HcrLevel;
  defaultEchelon: HcrEchelon;
}

export const HCR_JOB_PRESETS: readonly HcrJobPreset[] = [
  { code: "server", label: "Serveur", defaultStatus: "employee", defaultLevel: "1", defaultEchelon: "2" },
  { code: "commis", label: "Commis de cuisine", defaultStatus: "employee", defaultLevel: "1", defaultEchelon: "1" },
  { code: "cook", label: "Cuisinier", defaultStatus: "employee", defaultLevel: "2", defaultEchelon: "1" },
  { code: "chefDePartie", label: "Chef de partie", defaultStatus: "employee", defaultLevel: "3", defaultEchelon: "1" },
  { code: "headChef", label: "Chef de cuisine", defaultStatus: "supervisor", defaultLevel: "4", defaultEchelon: "1" },
  { code: "manager", label: "Manager / Responsable", defaultStatus: "supervisor", defaultLevel: "4", defaultEchelon: "2" },
] as const;

export type HcrMinimumWageKey = `${HcrLevel}-${HcrEchelon}`;

export const HCR_MINIMUM_HOURLY_WAGES_GROSS: Partial<Record<HcrMinimumWageKey, number>> = {
  "1-1": 11.88,
  "1-2": 11.9,
  "2-1": 12,
  "3-1": 12.5,
  "4-1": 13.5,
  "4-2": 14,
  "5-elite": 16,
} as const;

export const HCR_TRIAL_PERIODS_BY_STATUS = {
  cdi: {
    employee: { months: 2, label: "2 mois" },
    supervisor: { months: 3, label: "3 mois" },
    executive: { months: 4, label: "4 mois" },
  },
  cdd: {
    shortContract: "1 jour par semaine de contrat, dans la limite de 2 semaines",
    longContract: "1 mois maximum pour les contrats de plus de 6 mois",
  },
} as const;

export const HCR_CDD_REASONS: Record<HcrCddReason, { label: string; requiresReplacementName?: boolean }> = {
  temporaryIncrease: { label: "Accroissement temporaire d'activité" },
  employeeReplacement: { label: "Remplacement d'un salarié absent", requiresReplacementName: true },
  seasonalJob: { label: "Emploi saisonnier" },
};

export const HCR_OVERTIME_RULES = {
  hours36To39: { from: 36, to: 39, premiumPercent: 10 },
  hours40To43: { from: 40, to: 43, premiumPercent: 20 },
  beyond43: { from: 44, premiumPercent: 50 },
} as const;

export const HCR_MEAL_BENEFIT = {
  label: "Avantage en nature repas HCR",
  minimumGuaranteedReference: "Minimum garanti en vigueur à la date de paie",
} as const;

export const HCR_CLAUSE_LABELS: Record<HcrClauseKey, string> = {
  trialPeriod: "Période d'essai",
  workingTimeModulation: "Modulation du temps de travail",
  mealBenefits: "Avantages en nature repas",
  overtimePay: "Heures supplémentaires",
  workClothes: "Tenue de travail",
  nonCompete: "Non-concurrence",
};

export const HCR_CLAUSE_TEMPLATES: Record<HcrClauseKey, string> = {
  trialPeriod:
    "ARTICLE 4 — PÉRIODE D'ESSAI\nLe présent contrat est conclu sous réserve d'une période d'essai de {DureeEssaiSaisie} {UniteEssai} (jours/mois). Durant cette période, chacune des parties pourra rompre librement le contrat, sans indemnité d'aucune sorte, sous réserve du respect du délai de prévenance légal prévu par les articles L. 1221-25 et L. 1221-26 du Code du travail.",
  workingTimeModulation:
    "ARTICLE 6 — HORAIRES ET VARIABILITÉ DU PLANNING\nEn raison des impératifs du secteur de la restauration, les horaires et jours travaillés sont variables d'une semaine sur l'autre. Les plannings hebdomadaires seront notifiés au Salarié en respectant un délai de prévenance de 3 jours, sauf urgence ou circonstances exceptionnelles liées à des variations imprévisibles de l'activité.",
  mealBenefits:
    "ARTICLE 7 — AVANTAGES EN NATURE (NOURRITURE)\nConformément à la réglementation HCR en vigueur, si le Salarié est présent au moment des repas pendant ses horaires de service, il bénéficiera de l'attribution de repas gratuits, évalués forfaitairement selon le barème du Minimum Garanti (MG) de l'URSSAF.",
  overtimePay:
    "ARTICLE 8 — ENCADREMENT DES HEURES SUPPLÉMENTAIRES\nAucune heure supplémentaire ne pourra être effectuée par le Salarié sans l’accord préalable, exprès et écrit de la Direction. Le Salarié ne pourra se prévaloir d'heures supplémentaires accomplies de sa propre initiative sans ordre écrit ou validation écrite a posteriori.",
  workClothes:
    "ARTICLE 9 — TENUE DE TRAVAIL, IMAGE ET HYGIÈNE\nLe Salarié s'engage à se présenter à son poste de travail dans un état de propreté irréprochable et à porter la tenue de travail conforme aux exigences d'hygiène et de sécurité de l'établissement (normes HACCP). Le Salarié s’engage à prendre soin du matériel professionnel mis à sa disposition.{TenueTravail}",
  nonCompete:
    "ARTICLE 10 — OBLIGATION DE DISCRÉTION AND NON-CONCURRENCE\nLe Salarié s'engage à observer une discrétion absolue concernant les secrets commerciaux de l'établissement. De plus, il s'interdit, en cas de rupture du présent contrat, d'exercer une activité concurrente directe dans un rayon géographique limité au département de l'établissement, pendant une durée de 12 mois.\nCette obligation de non-concurrence donnera lieu à une contrepartie financière de {ContrepartieNonConcurrence}.",
};

export function minimumHourlyWageFor(level: HcrLevel, echelon: HcrEchelon): number | null {
  return HCR_MINIMUM_HOURLY_WAGES_GROSS[`${level}-${echelon}`] ?? null;
}

export const HCR_LEGAL_MONTHLY_HOURS = 151.67;
export const HCR_MONTHLY_MULTIPLIER = 52 / 12;

export interface HcrMonthlyCompensation {
  weeklyHours: number;
  totalMonthlyHours: number;
  overtimeWeeklyHours: number;
  overtimeMonthlyHours: number;
  overtimePremiumPercent: number;
  baseGross: number;
  overtimeGross: number;
  monthlyGross: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateMonthlyCompensation(
  hourlyRateGross: number,
  weeklyHours: number,
  hasWorkingTimeModulation = false,
  conventionIdcc = "1974"
): HcrMonthlyCompensation {
  const safeHourlyRate = Number.isFinite(hourlyRateGross) ? hourlyRateGross : 0;
  const safeWeeklyHours = Number.isFinite(weeklyHours) ? weeklyHours : 0;
  const overtimeWeeklyHours = Math.max(0, safeWeeklyHours - 35);
  const convention = getConventionConfig(conventionIdcc);
  const firstOvertimeBand = convention.overtimeBands[0];
  const overtimePremiumPercent =
    hasWorkingTimeModulation && firstOvertimeBand?.premiumPercentWithModulation != null
      ? firstOvertimeBand.premiumPercentWithModulation
      : firstOvertimeBand?.premiumPercent ?? 25;
  const totalMonthlyHours = roundHours(safeWeeklyHours * HCR_MONTHLY_MULTIPLIER);
  const overtimeMonthlyHours = roundHours(overtimeWeeklyHours * HCR_MONTHLY_MULTIPLIER);
  const baseMonthlyHours = overtimeWeeklyHours > 0 ? HCR_LEGAL_MONTHLY_HOURS : totalMonthlyHours;
  const baseGross = roundMoney(safeHourlyRate * baseMonthlyHours);
  const overtimeGross = roundMoney(safeHourlyRate * (1 + overtimePremiumPercent / 100) * overtimeMonthlyHours);
  return {
    weeklyHours: safeWeeklyHours,
    totalMonthlyHours,
    overtimeWeeklyHours,
    overtimeMonthlyHours,
    overtimePremiumPercent,
    baseGross,
    overtimeGross,
    monthlyGross: roundMoney(baseGross + overtimeGross),
  };
}

export function monthlyGrossFromHourly(
  hourlyRateGross: number,
  weeklyHours: number,
  hasWorkingTimeModulation = false,
  conventionIdcc = "1974"
): number {
  return calculateMonthlyCompensation(hourlyRateGross, weeklyHours, hasWorkingTimeModulation, conventionIdcc).monthlyGross;
}
