import { HCR_IDCC } from "../payrollEngine/constants2026";
import type { PayslipPeriodBundle, PayslipRow } from "../payslipTypes";
import { contractNatureCode, DSN_BASE_CODE, mapPayslipLineToDsnCotisation } from "./dsnCodes";
import {
  cleanNir,
  DSN_EDITOR_NAME,
  DSN_NORM_VERSION,
  DSN_SOFTWARE_NAME,
  dsnLine,
  formatAmount,
  formatDsnMonth,
  monthBoundsDsn,
  parseSiret,
} from "./dsnFormat";

export type DsnBuildMode = "test" | "real";

export type DsnBuildResult = {
  content: string;
  filename: string;
  lineCount: number;
  payslipCount: number;
  totalGross: number;
  totalEmployerContrib: number;
  warnings: string[];
};

export type DsnBuildInput = {
  bundle: PayslipPeriodBundle;
  mode: DsnBuildMode;
  contactEmail?: string;
  contactName?: string;
};

function pushLines(lines: string[], rubriques: [string, string | number][]) {
  for (const [r, v] of rubriques) lines.push(dsnLine(r, v));
}

function buildIndividual(
  lines: string[],
  payslip: PayslipRow,
  periodYm: string,
  linesByPayslip: Record<string, import("../payslipTypes").PayslipLineRow[]>,
  contractIndex: number
): string[] {
  const warnings: string[] = [];
  const emp = payslip.employeeSnapshot;
  const pay = payslip.paySnapshot;
  const employer = payslip.employerSnapshot;
  const { start, end } = monthBoundsDsn(periodYm);

  const nir = emp.socialSecurityNumber ? cleanNir(emp.socialSecurityNumber) : null;
  if (!nir) warnings.push(`NIR manquant pour ${emp.displayName}`);

  const lastName = (emp.lastName ?? emp.displayName.split(" ").slice(-1)[0] ?? "INCONNU").toUpperCase();
  const firstName = (emp.firstName ?? emp.displayName.split(" ")[0] ?? "INCONNU").toUpperCase();
  const contractNum = String(contractIndex).padStart(5, "0");

  pushLines(lines, [
    ["S21.G00.30.001", nir ?? "000000000000000"],
    ["S21.G00.30.002", lastName],
    ["S21.G00.30.004", firstName],
  ]);

  pushLines(lines, [
    ["S21.G00.40.001", contractNum],
    ["S21.G00.40.007", contractNatureCode(emp.contractType)],
    ["S21.G00.40.009", start],
    ["S21.G00.40.011", emp.targetWeeklyHours != null ? formatAmount(emp.targetWeeklyHours) : "35.00"],
    ["S21.G00.40.014", "10"],
  ]);

  if (pay) {
    pushLines(lines, [
      ["S21.G00.51.001", start],
      ["S21.G00.51.002", end],
      ["S21.G00.51.011", pay.grossTotal],
      ["S21.G00.51.012", "001"],
    ]);

    if (payslip.hoursValidated != null && payslip.hoursValidated > 0) {
      pushLines(lines, [
        ["S21.G00.53.001", "01"],
        ["S21.G00.53.002", "10"],
        ["S21.G00.53.003", formatAmount(payslip.hoursValidated)],
      ]);
    }

    pushLines(lines, [
      ["S21.G00.78.001", DSN_BASE_CODE.brutDeplaf],
      ["S21.G00.78.002", start],
      ["S21.G00.78.003", end],
      ["S21.G00.78.004", pay.bases.grossTotal],
      ["S21.G00.78.006", contractNum],
    ]);

    if (pay.bases.cappedPmss > 0) {
      pushLines(lines, [
        ["S21.G00.78.001", DSN_BASE_CODE.brutPlaf],
        ["S21.G00.78.002", start],
        ["S21.G00.78.003", end],
        ["S21.G00.78.004", pay.bases.cappedPmss],
        ["S21.G00.78.006", contractNum],
      ]);
    }

    if (pay.bases.csgAssiette > 0) {
      pushLines(lines, [
        ["S21.G00.78.001", DSN_BASE_CODE.csg],
        ["S21.G00.78.002", start],
        ["S21.G00.78.003", end],
        ["S21.G00.78.004", pay.bases.csgAssiette],
        ["S21.G00.78.006", contractNum],
      ]);
    }

    const payslipLines = linesByPayslip[payslip.id] ?? [];
    for (const line of payslipLines) {
      if (line.section !== "employee_contrib" && line.section !== "employer_contrib" && line.section !== "deduction") {
        continue;
      }
      const mapped = mapPayslipLineToDsnCotisation(line);
      if (!mapped) continue;
      pushLines(lines, [
        ["S21.G00.81.001", mapped.code],
        ["S21.G00.81.002", start],
        ["S21.G00.81.003", mapped.base],
        ["S21.G00.81.004", mapped.amount],
        ["S21.G00.81.006", contractNum],
      ]);
    }

    if (pay.pasAmount > 0) {
      pushLines(lines, [
        ["S21.G00.70.001", pay.pasRatePct != null ? formatAmount(pay.pasRatePct) : "0.00"],
        ["S21.G00.70.002", "02"],
        ["S21.G00.70.004", pay.pasAmount],
      ]);
    }

    pushLines(lines, [
      ["S21.G00.85.001", end],
      ["S21.G00.85.002", pay.netImposable],
      ["S21.G00.85.003", pay.netPayable],
      ["S21.G00.85.004", pay.pasAmount],
    ]);
  }

  if (emp.paidLeave) {
    warnings.push(
      `Congés payés ${emp.displayName} : solde ${emp.paidLeave.balanceDays} j (voir bulletin).`
    );
  }

  return warnings;
}

export function buildMonthlyDsn(input: DsnBuildInput): DsnBuildResult {
  const { bundle, mode } = input;
  const warnings: string[] = [];
  const lines: string[] = [];
  const periodYm = bundle.period.periodMonth;
  const { start, end } = monthBoundsDsn(periodYm);

  const employer = bundle.payslips[0]?.employerSnapshot;
  const siretParsed = employer?.siret ? parseSiret(employer.siret) : null;
  if (!siretParsed) {
    throw new Error("SIRET employeur invalide — 14 chiffres requis pour la DSN.");
  }
  if (bundle.period.status !== "finalized") {
    throw new Error("Finalisez la période de paie avant d'exporter la DSN.");
  }
  if (bundle.payslips.length === 0) {
    throw new Error("Aucun bulletin dans cette période.");
  }

  let totalGross = 0;
  let totalEmployer = 0;
  for (const p of bundle.payslips) {
    totalGross += p.grossTotal ?? 0;
    totalEmployer += p.employerContribTotal ?? 0;
  }

  pushLines(lines, [
    ["S10.G00.00.001", DSN_SOFTWARE_NAME],
    ["S10.G00.00.002", DSN_EDITOR_NAME],
    ["S10.G00.00.003", "1.0.0"],
    ["S10.G00.00.005", mode === "test" ? "01" : "02"],
    ["S10.G00.00.006", DSN_NORM_VERSION],
    ["S10.G00.00.007", "01"],
    ["S10.G00.00.008", "01"],
    ["S10.G00.01.001", siretParsed.siren],
    ["S10.G00.01.002", siretParsed.nic],
    ["S10.G00.01.005", employer?.legalName ?? "ETABLISSEMENT"],
    ["S10.G00.02.001", input.contactName ?? employer?.legalName ?? "DECLARANT"],
    ["S10.G00.02.002", input.contactEmail ?? "paie@etablissement.fr"],
  ]);

  pushLines(lines, [
    ["S20.G00.05.001", "01"],
    ["S20.G00.05.002", "01"],
    ["S20.G00.05.003", "11"],
    ["S20.G00.05.004", "01"],
    ["S20.G00.05.005", formatDsnMonth(periodYm)],
    ["S20.G00.05.010", siretParsed.siret14],
  ]);

  pushLines(lines, [
    ["S21.G00.06.001", siretParsed.siret14],
    ["S21.G00.06.002", bundle.payslips.length],
    ["S21.G00.06.003", employer?.apeCode ?? "5610A"],
    ["S21.G00.06.004", employer?.collectiveAgreementIdcc ?? HCR_IDCC],
    ["S21.G00.06.005", employer?.address ?? ""],
  ]);

  pushLines(lines, [
    ["S21.G00.22.001", "01"],
    ["S21.G00.22.003", start],
    ["S21.G00.22.004", end],
    ["S21.G00.22.005", totalEmployer],
  ]);

  bundle.payslips.forEach((payslip, index) => {
    const w = buildIndividual(lines, payslip, periodYm, bundle.linesByPayslip, index + 1);
    warnings.push(...w);
  });

  pushLines(lines, [
    ["S80.G01.00.001", String(bundle.payslips.length).padStart(3, "0")],
    ["S89.G00.91.001", String(bundle.payslips.length).padStart(3, "0")],
    ["S89.G00.91.002", formatAmount(totalGross)],
    ["S90.G00.90.001", "001"],
  ]);

  if (!employer?.apeCode) {
    warnings.push("Code APE non renseigné — 5610A utilisé par défaut (restauration).");
  }

  const content = lines.join("\r\n") + "\r\n";
  const filename = `DSN_${periodYm}_${siretParsed.siren}_${mode === "test" ? "TEST" : "REEL"}.dsn`;

  return {
    content,
    filename,
    lineCount: lines.length,
    payslipCount: bundle.payslips.length,
    totalGross: Math.round(totalGross * 100) / 100,
    totalEmployerContrib: Math.round(totalEmployer * 100) / 100,
    warnings,
  };
}
