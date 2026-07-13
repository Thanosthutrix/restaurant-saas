import { round2 } from "../payslipMonth";

/** Assiette PAS = net imposable (brut − cotisations salariales déductibles) */
export function computePasAmount(netImposable: number, pasRatePct: number | null): number {
  if (pasRatePct == null || !Number.isFinite(pasRatePct) || pasRatePct <= 0) return 0;
  return round2((netImposable * pasRatePct) / 100);
}

export function computeNetImposable(grossTotal: number, deductibleContribs: number): number {
  return round2(Math.max(0, grossTotal - deductibleContribs));
}
