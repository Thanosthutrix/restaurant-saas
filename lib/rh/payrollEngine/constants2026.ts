/**
 * Paramètres légaux paie France métropolitaine — 1er janvier 2026.
 * Sources : URSSAF (PMSS), MSA Notice Générale des Taux 01.01.2026.
 */

export const PAYROLL_ENGINE_VERSION = "2026.01";

/** Plafond annuel de la Sécurité sociale */
export const PASS_2026 = 48_060;
/** Plafond mensuel de la Sécurité sociale */
export const PMSS_2026 = 4_005;

export const SMIC_HOURLY_2026 = 12.02;
export const SMIC_MONTHLY_2026 = 1_823.03;
export const SMIC_WEEKLY_HOURS = 35;

/** 3,5 × SMIC mensuel — seuil allocations familiales réduit */
export const AF_REDUCED_THRESHOLD_2026 = SMIC_MONTHLY_2026 * 3.5;

/** Assiette CSG/CRDS : 98,25 % du brut jusqu'à 4 PMSS ; au-delà, totalité du brut */
export const CSG_ASSIETTE_FACTOR = 0.9825;
export const CSG_PMSS_MULTIPLIER = 4;

/** Majoration heures supplémentaires (hors convention spécifique) */
export const OVERTIME_PREMIUM_PCT = 25;

/** Taux AT/MP par défaut restauration (NAF 56.10) — à personnaliser via réglage établissement */
export const DEFAULT_ATMP_RATE_PCT = 2.3;

/** IDCC HCR */
export const HCR_IDCC = "1979";

export const PAYROLL_LEGAL_NOTICE =
  "Bulletin établi par l'employeur conformément à l'article L. 3243-1 du Code du travail. Barème cotisations France métropolitaine au 01/01/2026.";
