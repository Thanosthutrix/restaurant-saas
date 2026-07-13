import { round2 } from "../payslipMonth";
import {
  AF_REDUCED_THRESHOLD_2026,
  CSG_ASSIETTE_FACTOR,
  CSG_PMSS_MULTIPLIER,
  PMSS_2026,
} from "./constants2026";

export type ContributionBases = {
  grossTotal: number;
  cappedPmss: number;
  capped4Pmss: number;
  agircT1: number;
  csgAssiette: number;
};

export function computeContributionBases(grossTotal: number): ContributionBases {
  const cappedPmss = round2(Math.min(grossTotal, PMSS_2026));
  const capped4Pmss = round2(Math.min(grossTotal, PMSS_2026 * CSG_PMSS_MULTIPLIER));
  const csgAssiette =
    grossTotal <= PMSS_2026 * CSG_PMSS_MULTIPLIER
      ? round2(grossTotal * CSG_ASSIETTE_FACTOR)
      : round2(grossTotal);
  return {
    grossTotal: round2(grossTotal),
    cappedPmss,
    capped4Pmss,
    agircT1: cappedPmss,
    csgAssiette,
  };
}

export function allocationsFamilialesRatePct(grossTotal: number): number {
  return grossTotal <= AF_REDUCED_THRESHOLD_2026 ? 3.45 : 5.25;
}

export function fnalRatePct(staffHeadcount: number): number {
  return staffHeadcount >= 50 ? 0.5 : 0.1;
}

/** Formation professionnelle + apprentissage selon effectif */
export function formationRates(staffHeadcount: number): {
  cfpPct: number;
  taxeApprentissagePct: number;
} {
  if (staffHeadcount < 11) {
    return { cfpPct: 0.55, taxeApprentissagePct: 0 };
  }
  return { cfpPct: 1, taxeApprentissagePct: 0.68 };
}

export type ContributionLineDef = {
  code: string;
  label: string;
  section: "employee_contrib" | "employer_contrib";
  ratePct: number;
  base: keyof ContributionBases;
};

export function employeeContributionDefs(): ContributionLineDef[] {
  return [
    {
      code: "vieillesse_plaf",
      label: "Retraite sécurité sociale plafonnée",
      section: "employee_contrib",
      ratePct: 6.9,
      base: "cappedPmss",
    },
    {
      code: "vieillesse_deplaf",
      label: "Retraite sécurité sociale déplafonnée",
      section: "employee_contrib",
      ratePct: 0.4,
      base: "grossTotal",
    },
    {
      code: "agirc_arrco_t1",
      label: "Retraite complémentaire AGIRC-ARRCO tranche 1",
      section: "employee_contrib",
      ratePct: 3.15,
      base: "agircT1",
    },
    {
      code: "csg_deduct",
      label: "CSG déductible du revenu imposable",
      section: "employee_contrib",
      ratePct: 6.8,
      base: "csgAssiette",
    },
    {
      code: "csg_crds",
      label: "CSG/CRDS non déductible",
      section: "employee_contrib",
      ratePct: 2.9,
      base: "csgAssiette",
    },
  ];
}

export type EmployerContribContext = {
  bases: ContributionBases;
  staffHeadcount: number;
  atmpRatePct: number;
};

export function employerContributionDefs(ctx: EmployerContribContext): ContributionLineDef[] {
  const afRate = allocationsFamilialesRatePct(ctx.bases.grossTotal);
  const fnal = fnalRatePct(ctx.staffHeadcount);
  const formation = formationRates(ctx.staffHeadcount);

  return [
    {
      code: "maladie",
      label: "Assurance maladie, maternité, invalidité, décès",
      section: "employer_contrib",
      ratePct: 13,
      base: "grossTotal",
    },
    {
      code: "vieillesse_plaf",
      label: "Retraite sécurité sociale plafonnée",
      section: "employer_contrib",
      ratePct: 8.55,
      base: "cappedPmss",
    },
    {
      code: "vieillesse_deplaf",
      label: "Retraite sécurité sociale déplafonnée",
      section: "employer_contrib",
      ratePct: 2.02,
      base: "grossTotal",
    },
    {
      code: "allocations_familiales",
      label: `Allocations familiales (${afRate.toFixed(2)} %)`,
      section: "employer_contrib",
      ratePct: afRate,
      base: "grossTotal",
    },
    {
      code: "agirc_arrco_t1",
      label: "Retraite complémentaire AGIRC-ARRCO tranche 1",
      section: "employer_contrib",
      ratePct: 4.72,
      base: "agircT1",
    },
    {
      code: "atmp",
      label: "Accidents du travail — maladies professionnelles",
      section: "employer_contrib",
      ratePct: ctx.atmpRatePct,
      base: "grossTotal",
    },
    {
      code: "chomage",
      label: "Assurance chômage",
      section: "employer_contrib",
      ratePct: 4.05,
      base: "capped4Pmss",
    },
    {
      code: "ags",
      label: "AGS (garantie des salaires)",
      section: "employer_contrib",
      ratePct: 0.15,
      base: "capped4Pmss",
    },
    {
      code: "fnal",
      label: `FNAL (${fnal.toFixed(2)} %)`,
      section: "employer_contrib",
      ratePct: fnal,
      base: "grossTotal",
    },
    {
      code: "cfp",
      label: "Contribution formation professionnelle",
      section: "employer_contrib",
      ratePct: formation.cfpPct,
      base: "grossTotal",
    },
    ...(formation.taxeApprentissagePct > 0
      ? [
          {
            code: "taxe_apprentissage",
            label: "Taxe d'apprentissage",
            section: "employer_contrib" as const,
            ratePct: formation.taxeApprentissagePct,
            base: "grossTotal" as const,
          },
        ]
      : []),
  ];
}

export function contributionAmount(base: number, ratePct: number): number {
  return round2((base * ratePct) / 100);
}

/** Cotisations salariales déductibles pour le net imposable (hors CSG/CRDS non déductible) */
export function deductibleEmployeeContribs(lines: { code: string; amount: number }[]): number {
  const deductibleCodes = new Set([
    "vieillesse_plaf",
    "vieillesse_deplaf",
    "agirc_arrco_t1",
    "csg_deduct",
  ]);
  return round2(
    lines
      .filter((l) => deductibleCodes.has(l.code))
      .reduce((s, l) => s + Math.abs(l.amount), 0)
  );
}
