import { getConventionConfig } from "./conventionRegistry";
import type { HcrContractDraft } from "./types";

export type HcrTrialPeriodUnit = "jours" | "mois";

export interface HcrTrialPeriodLimit {
  defaultValue: number;
  maxValue: number;
  unit: HcrTrialPeriodUnit;
  label: string;
  canCalculate: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetweenInclusive(startYmd: string | undefined, endYmd: string | undefined): number | null {
  if (!startYmd || !endYmd) return null;
  const start = new Date(`${startYmd}T00:00:00`);
  const end = new Date(`${endYmd}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function calculateTrialPeriodLimit(draft: HcrContractDraft): HcrTrialPeriodLimit {
  if (draft.contractKind === "cdi") {
    const convention = getConventionConfig(draft.employer.collectiveAgreementIdcc);
    const rule = convention.trialPeriodsCdi[draft.jobAndPay.status];
    return {
      defaultValue: rule.defaultMonths,
      maxValue: rule.maxMonths,
      unit: "mois",
      label: `Maximum conventionnel ${convention.shortLabel} : ${rule.maxMonths} mois`,
      canCalculate: true,
    };
  }

  if (draft.contractKind === "extra") {
    return { defaultValue: 0, maxValue: 1, unit: "jours", label: "Maximum autorisé : 1 jour pour un Extra", canCalculate: true };
  }

  const durationDays = daysBetweenInclusive(draft.termDetails?.startDate, draft.termDetails?.endDate);
  if (durationDays == null) {
    return {
      defaultValue: 0,
      maxValue: 0,
      unit: "jours",
      label: "Date de début et date de fin requises pour calculer le plafond CDD/saisonnier",
      canCalculate: false,
    };
  }

  if (durationDays <= 183) {
    const weeks = Math.ceil(durationDays / 7);
    const maxValue = Math.min(weeks, 14);
    return {
      defaultValue: maxValue,
      maxValue,
      unit: "jours",
      label: `Maximum légal calculé : ${maxValue} jour(s) ouvrable(s)`,
      canCalculate: true,
    };
  }

  return { defaultValue: 1, maxValue: 1, unit: "mois", label: "Maximum légal : 1 mois pour un CDD/saisonnier de plus de 6 mois", canCalculate: true };
}
