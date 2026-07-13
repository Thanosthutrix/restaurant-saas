import { computeGrossFromHours } from "./payrollEngine/grossPay";
import {
  computeContributionBases,
  contributionAmount,
  deductibleEmployeeContribs,
  employeeContributionDefs,
  employerContributionDefs,
} from "./payrollEngine/contributionEngine";
import {
  DEFAULT_ATMP_RATE_PCT,
  OVERTIME_PREMIUM_PCT,
  PAYROLL_ENGINE_VERSION,
  PAYROLL_LEGAL_NOTICE,
  PMSS_2026,
  PASS_2026,
  SMIC_HOURLY_2026,
} from "./payrollEngine/constants2026";
import { computeNetImposable, computePasAmount } from "./payrollEngine/pas";
import { round2 } from "./payslipMonth";
import type {
  PayslipAlert,
  PayslipBenefitsSnapshot,
  PayslipLineRow,
  PayslipPaySnapshot,
} from "./payslipTypes";

export type ComputePayslipInput = {
  validatedHours: number;
  hourlyGrossRate: number;
  targetWeeklyHours: number | null;
  payrollEmployerPct: number;
  benefits: PayslipBenefitsSnapshot | null;
  staffHeadcount: number;
  atmpRatePct: number;
  pasRatePct: number | null;
};

export type ComputePayslipResult = {
  paySnapshot: PayslipPaySnapshot;
  lines: Omit<PayslipLineRow, "id" | "payslipId">[];
  alerts: PayslipAlert[];
};

export function computePayslipAmounts(input: ComputePayslipInput): ComputePayslipResult {
  const alerts: PayslipAlert[] = [];
  const gross = computeGrossFromHours({
    validatedHours: input.validatedHours,
    hourlyGrossRate: input.hourlyGrossRate,
    targetWeeklyHours: input.targetWeeklyHours,
  });

  if (input.hourlyGrossRate <= 0) {
    alerts.push({
      code: "missing_rate",
      level: "error",
      message: "Taux horaire brut manquant — renseignez-le dans Équipe ou le contrat HCR.",
    });
  } else if (input.hourlyGrossRate < SMIC_HOURLY_2026) {
    alerts.push({
      code: "below_smic",
      level: "error",
      message: `Taux horaire (${input.hourlyGrossRate.toFixed(2)} €) inférieur au SMIC 2026 (${SMIC_HOURLY_2026.toFixed(2)} €/h).`,
    });
  }

  if (input.validatedHours <= 0) {
    alerts.push({
      code: "zero_hours",
      level: "warning",
      message: "Aucune heure validée pour ce salarié sur la période.",
    });
  }

  if (input.benefits && input.benefits.administratifChargeIds.length === 0) {
    alerts.push({
      code: "no_rh_charges",
      level: "warning",
      message: "Mutuelle non liée : renseignez les charges dans Administratif > Personnel.",
    });
  }

  if (input.pasRatePct == null) {
    alerts.push({
      code: "missing_pas",
      level: "warning",
      message: "Taux PAS non renseigné pour ce salarié — PAS à 0 % (à compléter dans Équipe).",
    });
  }

  const bases = computeContributionBases(gross.grossTotal);
  const lines: Omit<PayslipLineRow, "id" | "payslipId">[] = [];
  let sort = 0;

  lines.push({
    section: "earning",
    code: "salaire_base",
    label: `Salaire de base (${gross.normalHours} h × ${input.hourlyGrossRate.toFixed(2)} €)`,
    baseAmount: gross.normalHours,
    rate: input.hourlyGrossRate,
    amount: gross.grossBase,
    sortOrder: sort++,
  });

  if (gross.overtimeHours > 0) {
    lines.push({
      section: "earning",
      code: "heures_sup",
      label: `Heures supplémentaires (${gross.overtimeHours} h, +${OVERTIME_PREMIUM_PCT} %)`,
      baseAmount: gross.overtimeHours,
      rate: round2(input.hourlyGrossRate * (1 + OVERTIME_PREMIUM_PCT / 100)),
      amount: gross.grossOvertime,
      sortOrder: sort++,
    });
  }

  const employeeContribLines: { code: string; amount: number }[] = [];
  for (const def of employeeContributionDefs()) {
    const base = bases[def.base];
    const amount = contributionAmount(base, def.ratePct);
    employeeContribLines.push({ code: def.code, amount });
    lines.push({
      section: "employee_contrib",
      code: def.code,
      label: def.label,
      baseAmount: base,
      rate: def.ratePct,
      amount: -amount,
      sortOrder: sort++,
    });
  }

  const employeeContribTotal = round2(
    employeeContribLines.reduce((s, l) => s + l.amount, 0)
  );

  let mutuelleEmployee = 0;
  if (input.benefits) {
    mutuelleEmployee = input.benefits.mutuellePerEmployeeEmployee;
    if (mutuelleEmployee > 0) {
      lines.push({
        section: "deduction",
        code: "mutuelle_salarie",
        label: `Complémentaire santé — part salarié (${round2(100 - input.benefits.mutuelleEmployerSharePct)} %)`,
        baseAmount:
          input.benefits.mutuellePerEmployeeEmployer + input.benefits.mutuellePerEmployeeEmployee,
        rate: round2(100 - input.benefits.mutuelleEmployerSharePct),
        amount: -mutuelleEmployee,
        sortOrder: sort++,
      });
    }
  }

  const netBeforeTax = round2(gross.grossTotal - employeeContribTotal - mutuelleEmployee);

  const deductible = deductibleEmployeeContribs(employeeContribLines);
  const netImposable = computeNetImposable(gross.grossTotal, deductible);
  const pasAmount = computePasAmount(netImposable, input.pasRatePct);

  if (pasAmount > 0) {
    lines.push({
      section: "deduction",
      code: "pas",
      label: `Prélèvement à la source (${input.pasRatePct?.toFixed(2) ?? "0"} %)`,
      baseAmount: netImposable,
      rate: input.pasRatePct,
      amount: -pasAmount,
      sortOrder: sort++,
    });
  }

  const netPayable = round2(netBeforeTax - pasAmount);

  let employerContribTotal = 0;
  const employerDefs = employerContributionDefs({
    bases,
    staffHeadcount: input.staffHeadcount,
    atmpRatePct: input.atmpRatePct,
  });

  for (const def of employerDefs) {
    const base = bases[def.base];
    const amount = contributionAmount(base, def.ratePct);
    employerContribTotal = round2(employerContribTotal + amount);
    lines.push({
      section: "employer_contrib",
      code: def.code,
      label: def.label,
      baseAmount: base,
      rate: def.ratePct,
      amount,
      sortOrder: sort++,
    });
  }

  if (input.benefits) {
    const mutuelleEmployer = input.benefits.mutuellePerEmployeeEmployer;
    const prevoyanceEmployer = input.benefits.prevoyancePerEmployeeEmployer;
    if (mutuelleEmployer > 0) {
      lines.push({
        section: "employer_contrib",
        code: "mutuelle_patron",
        label: "Complémentaire santé — part employeur (Administratif)",
        baseAmount:
          input.benefits.mutuellePerEmployeeEmployer + input.benefits.mutuellePerEmployeeEmployee,
        rate: input.benefits.mutuelleEmployerSharePct,
        amount: mutuelleEmployer,
        sortOrder: sort++,
      });
      employerContribTotal = round2(employerContribTotal + mutuelleEmployer);
    }
    if (prevoyanceEmployer > 0) {
      lines.push({
        section: "employer_contrib",
        code: "prevoyance_patron",
        label: "Prévoyance — part employeur (Administratif)",
        baseAmount: input.benefits.prevoyanceMonthlyEmployerTotal,
        rate: null,
        amount: prevoyanceEmployer,
        sortOrder: sort++,
      });
      employerContribTotal = round2(employerContribTotal + prevoyanceEmployer);
    }
  }

  const employerCostTotal = round2(gross.grossTotal + employerContribTotal);
  const bilanLoadedCost = round2(gross.grossTotal * (1 + input.payrollEmployerPct / 100));

  const delta = Math.abs(employerCostTotal - bilanLoadedCost);
  if (delta > 5 && gross.grossTotal > 0) {
    alerts.push({
      code: "bilan_delta",
      level: "info",
      message: `Coût employeur calculé (${employerCostTotal.toFixed(2)} €) vs paramètre bilan ${input.payrollEmployerPct} % (${bilanLoadedCost.toFixed(2)} €). Ajustez le taux dans Ma poche si besoin.`,
    });
  }

  lines.push({
    section: "info",
    code: "legal_notice",
    label: PAYROLL_LEGAL_NOTICE,
    baseAmount: null,
    rate: null,
    amount: 0,
    sortOrder: sort++,
  });

  const paySnapshot: PayslipPaySnapshot = {
    engineVersion: PAYROLL_ENGINE_VERSION,
    pmss: PMSS_2026,
    pass: PASS_2026,
    smicHourly: SMIC_HOURLY_2026,
    atmpRatePct: input.atmpRatePct,
    payrollEmployerPct: input.payrollEmployerPct,
    staffHeadcount: input.staffHeadcount,
    normalHours: gross.normalHours,
    overtimeHours: gross.overtimeHours,
    hourlyGrossRate: input.hourlyGrossRate,
    grossBase: gross.grossBase,
    grossOvertimePremium: round2(gross.grossOvertime - gross.overtimeHours * input.hourlyGrossRate),
    grossTotal: gross.grossTotal,
    bases,
    employeeContribTotal,
    netImposable,
    pasRatePct: input.pasRatePct,
    pasAmount,
    netBeforeTax,
    netPayable,
    employerContribTotal,
    employerCostTotal,
    bilanLoadedCost,
    computedAt: new Date().toISOString(),
    legalNotice: PAYROLL_LEGAL_NOTICE,
  };

  return { paySnapshot, lines, alerts };
}

export { DEFAULT_ATMP_RATE_PCT };
