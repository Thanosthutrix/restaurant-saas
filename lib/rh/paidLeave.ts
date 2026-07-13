import { round2 } from "./payslipMonth";

/** Acquisition mensuelle standard (25 jours ouvrables / 12 mois). */
export const MONTHLY_LEAVE_ACCRUAL_DAYS = round2(25 / 12);

export type PaidLeaveSnapshot = {
  acquiredThisMonth: number;
  takenThisMonth: number;
  balanceDays: number;
  unit: "ouvrables";
};

export function buildPaidLeaveSnapshot(params: {
  balanceDays: number;
  takenThisMonth?: number;
}): PaidLeaveSnapshot {
  const taken = params.takenThisMonth ?? 0;
  return {
    acquiredThisMonth: MONTHLY_LEAVE_ACCRUAL_DAYS,
    takenThisMonth: round2(taken),
    balanceDays: round2(params.balanceDays),
    unit: "ouvrables",
  };
}

export function nextBalanceAfterMonth(currentBalance: number, takenThisMonth = 0): number {
  return round2(Math.max(0, currentBalance + MONTHLY_LEAVE_ACCRUAL_DAYS - takenThisMonth));
}
