import { HCR_IDCC } from "../payrollEngine/constants2026";
import type { PayslipEmployerSnapshot } from "../payslipTypes";
import { contractNatureCode } from "./dsnCodes";
import {
  DSN_EDITOR_NAME,
  DSN_NORM_VERSION,
  DSN_SOFTWARE_NAME,
  dsnLine,
  formatDsnDateYmd,
  formatDsnMonth,
  parseSiret,
} from "./dsnFormat";

export type DsnDeclarationNature = "01" | "04" | "05" | "07";

export const DSN_NATURE_LABELS: Record<DsnDeclarationNature, string> = {
  "01": "DSN mensuelle",
  "04": "Signalement arrêt de travail",
  "05": "Signalement reprise arrêt",
  "07": "Signalement fin de contrat (FCTU)",
};

export type DsnEnvelopeInput = {
  mode: "test" | "real";
  nature: DsnDeclarationNature;
  periodYm: string;
  siret: string;
  legalName: string;
  contactName?: string;
  contactEmail?: string;
};

function pushLines(lines: string[], rubriques: [string, string | number][]) {
  for (const [r, v] of rubriques) lines.push(dsnLine(r, v));
}

export function buildDsnEnvelope(input: DsnEnvelopeInput): {
  lines: string[];
  siret14: string;
  siren: string;
} {
  const parsed = parseSiret(input.siret);
  if (!parsed) throw new Error("SIRET invalide pour la DSN.");

  const lines: string[] = [];
  pushLines(lines, [
    ["S10.G00.00.001", DSN_SOFTWARE_NAME],
    ["S10.G00.00.002", DSN_EDITOR_NAME],
    ["S10.G00.00.003", "1.0.0"],
    ["S10.G00.00.005", input.mode === "test" ? "01" : "02"],
    ["S10.G00.00.006", DSN_NORM_VERSION],
    ["S10.G00.00.007", "01"],
    ["S10.G00.00.008", "01"],
    ["S10.G00.01.001", parsed.siren],
    ["S10.G00.01.002", parsed.nic],
    ["S10.G00.01.005", input.legalName],
    ["S10.G00.02.001", input.contactName ?? input.legalName],
    ["S10.G00.02.002", input.contactEmail ?? "paie@etablissement.fr"],
  ]);

  pushLines(lines, [
    ["S20.G00.05.001", input.nature],
    ["S20.G00.05.002", "01"],
    ["S20.G00.05.003", "11"],
    ["S20.G00.05.004", "01"],
    ["S20.G00.05.005", formatDsnMonth(input.periodYm)],
    ["S20.G00.05.010", parsed.siret14],
  ]);

  return { lines, siret14: parsed.siret14, siren: parsed.siren };
}

export function buildEstablishmentBlock(
  employer: PayslipEmployerSnapshot,
  siret14: string,
  headcount = 1
): [string, string | number][] {
  return [
    ["S21.G00.06.001", siret14],
    ["S21.G00.06.002", headcount],
    ["S21.G00.06.003", employer.apeCode ?? "5610A"],
    ["S21.G00.06.004", employer.collectiveAgreementIdcc ?? HCR_IDCC],
    ["S21.G00.06.005", employer.address ?? ""],
  ];
}

export function buildIndividualHeader(params: {
  nir: string;
  lastName: string;
  firstName: string;
  contractNum: string;
  contractType: string | null;
  contractStartYmd: string;
  weeklyHours: number | null;
}): [string, string | number][] {
  return [
    ["S21.G00.30.001", params.nir],
    ["S21.G00.30.002", params.lastName.toUpperCase()],
    ["S21.G00.30.004", params.firstName.toUpperCase()],
    ["S21.G00.40.001", params.contractNum],
    ["S21.G00.40.007", contractNatureCode(params.contractType)],
    ["S21.G00.40.009", formatDsnDateYmd(params.contractStartYmd)],
    ["S21.G00.40.011", params.weeklyHours != null ? params.weeklyHours.toFixed(2) : "35.00"],
    ["S21.G00.40.014", "10"],
  ];
}

export function buildDsnFooter(individualCount = 1): string[] {
  const lines: string[] = [];
  pushLines(lines, [
    ["S80.G01.00.001", String(individualCount).padStart(3, "0")],
    ["S89.G00.91.001", String(individualCount).padStart(3, "0")],
    ["S90.G00.90.001", "001"],
  ]);
  return lines;
}

export function finalizeDsnContent(lines: string[]): string {
  return lines.join("\r\n") + "\r\n";
}
