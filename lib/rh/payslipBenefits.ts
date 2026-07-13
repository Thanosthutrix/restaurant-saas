import { listFixedCharges, type PocketFixedChargeRow } from "@/lib/pocket/pocketReport";
import { round2 } from "./payslipMonth";
import type { PayslipBenefitsSnapshot } from "./payslipTypes";

const MUTUELLE_RE =
  /\b(mutuelle|complémentaire santé|complementaire sante|santé|sante|harmonie|malakoff|alan|april|axa santé|swiss life)\b/i;
const PREVOYANCE_RE = /\b(prévoyance|prevoyance|décès|deces|incapacité|incapacite|invalidité|invalidite)\b/i;

export function chargeToMonthlyAmount(charge: PocketFixedChargeRow): number {
  if (!charge.active) return 0;
  const base = charge.monthlyAmount;
  if (charge.periodicity === "yearly") return round2(base / 12);
  if (charge.periodicity === "quarterly") return round2(base / 3);
  return round2(base);
}

export type RhBenefitsBreakdown = {
  mutuelleMonthlyTotal: number;
  prevoyanceMonthlyTotal: number;
  otherRhMonthlyTotal: number;
  chargeIds: string[];
  charges: { id: string; label: string; monthlyAmount: number; kind: "mutuelle" | "prevoyance" | "other" }[];
};

export function classifyRhCharge(label: string): "mutuelle" | "prevoyance" | "other" {
  if (MUTUELLE_RE.test(label)) return "mutuelle";
  if (PREVOYANCE_RE.test(label)) return "prevoyance";
  return "other";
}

export async function loadRhBenefitsFromAdministratif(restaurantId: string): Promise<RhBenefitsBreakdown> {
  const charges = await listFixedCharges(restaurantId);
  const rhCharges = charges.filter((c) => c.category === "rh" && c.active);

  let mutuelleMonthlyTotal = 0;
  let prevoyanceMonthlyTotal = 0;
  let otherRhMonthlyTotal = 0;
  const chargeIds: string[] = [];
  const mapped: RhBenefitsBreakdown["charges"] = [];

  for (const charge of rhCharges) {
    const monthly = chargeToMonthlyAmount(charge);
    if (monthly <= 0) continue;
    const kind = classifyRhCharge(charge.label);
    chargeIds.push(charge.id);
    mapped.push({ id: charge.id, label: charge.label, monthlyAmount: monthly, kind });
    if (kind === "mutuelle") mutuelleMonthlyTotal = round2(mutuelleMonthlyTotal + monthly);
    else if (kind === "prevoyance") prevoyanceMonthlyTotal = round2(prevoyanceMonthlyTotal + monthly);
    else otherRhMonthlyTotal = round2(otherRhMonthlyTotal + monthly);
  }

  return {
    mutuelleMonthlyTotal,
    prevoyanceMonthlyTotal,
    otherRhMonthlyTotal,
    chargeIds,
    charges: mapped,
  };
}

export function allocateBenefitsPerEmployee(params: {
  breakdown: RhBenefitsBreakdown;
  activeEmployeeCount: number;
  mutuelleEmployerSharePct: number;
}): PayslipBenefitsSnapshot {
  const count = Math.max(1, params.activeEmployeeCount);
  const employerShare = Math.min(100, Math.max(0, params.mutuelleEmployerSharePct));
  const employeeShare = round2(100 - employerShare);

  const mutuellePerEmployee = round2(params.breakdown.mutuelleMonthlyTotal / count);
  const mutuellePerEmployeeEmployer = round2(mutuellePerEmployee * (employerShare / 100));
  const mutuellePerEmployeeEmployee = round2(mutuellePerEmployee * (employeeShare / 100));

  const prevoyancePerEmployeeEmployer = round2(params.breakdown.prevoyanceMonthlyTotal / count);

  return {
    mutuelleEmployerSharePct: employerShare,
    mutuelleMonthlyEmployerTotal: params.breakdown.mutuelleMonthlyTotal,
    mutuelleMonthlyEmployeeTotal: round2(params.breakdown.mutuelleMonthlyTotal * (employeeShare / 100)),
    mutuellePerEmployeeEmployer,
    mutuellePerEmployeeEmployee,
    prevoyanceMonthlyEmployerTotal: params.breakdown.prevoyanceMonthlyTotal,
    prevoyancePerEmployeeEmployer,
    administratifChargeIds: params.breakdown.chargeIds,
    sourceNote:
      params.breakdown.chargeIds.length > 0
        ? "Montants issus des charges RH enregistrées dans Administratif > Personnel."
        : "Aucune charge RH enregistrée — renseignez la mutuelle dans Administratif > Personnel.",
  };
}
