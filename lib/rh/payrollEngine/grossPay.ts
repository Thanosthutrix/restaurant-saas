import { monthlyContractHours, round2 } from "../payslipMonth";
import { OVERTIME_PREMIUM_PCT } from "./constants2026";

export type GrossBreakdown = {
  normalHours: number;
  overtimeHours: number;
  grossBase: number;
  grossOvertime: number;
  grossTotal: number;
};

export function computeGrossFromHours(params: {
  validatedHours: number;
  hourlyGrossRate: number;
  targetWeeklyHours: number | null;
}): GrossBreakdown {
  const monthlyContract = monthlyContractHours(params.targetWeeklyHours);
  let normalHours = params.validatedHours;
  let overtimeHours = 0;

  if (monthlyContract != null && monthlyContract > 0) {
    normalHours = Math.min(params.validatedHours, monthlyContract);
    overtimeHours = Math.max(0, params.validatedHours - monthlyContract);
  }

  normalHours = round2(normalHours);
  overtimeHours = round2(overtimeHours);

  const grossBase = round2(normalHours * params.hourlyGrossRate);
  const grossOvertime = round2(
    overtimeHours * params.hourlyGrossRate * (1 + OVERTIME_PREMIUM_PCT / 100)
  );

  return {
    normalHours,
    overtimeHours,
    grossBase,
    grossOvertime,
    grossTotal: round2(grossBase + grossOvertime),
  };
}
