import type { PayslipEmployeeSnapshot } from "../payslipTypes";
import {
  buildDsnEnvelope,
  buildDsnFooter,
  buildEstablishmentBlock,
  buildIndividualHeader,
  finalizeDsnContent,
} from "./dsnEnvelope";
import { cleanNir, dsnLine, formatDsnDateYmd } from "./dsnFormat";
import {
  DSN_SIGNALEMENT_NATURE,
  type DsnSignalementBuildInput,
  type DsnSignalementBuildResult,
  type DsnSignalementKind,
} from "./dsnSignalementTypes";

function pushLines(lines: string[], rubriques: [string, string | number][]) {
  for (const [r, v] of rubriques) lines.push(dsnLine(r, v));
}

function periodYmFromDate(ymd: string): string {
  return ymd.slice(0, 7);
}

function employeeNames(emp: PayslipEmployeeSnapshot): { lastName: string; firstName: string } {
  const lastName = (emp.lastName ?? emp.displayName.split(" ").slice(-1)[0] ?? "INCONNU").toUpperCase();
  const firstName = (emp.firstName ?? emp.displayName.split(" ")[0] ?? "INCONNU").toUpperCase();
  return { lastName, firstName };
}

function buildArretBlock(
  lines: string[],
  params: {
    motifCode: string;
    lastWorkedDay: string;
    expectedEndDate?: string | null;
    subrogation: boolean;
    returnDate?: string | null;
    isReprise: boolean;
  }
) {
  if (params.isReprise) {
    pushLines(lines, [
      ["S21.G00.60.002", formatDsnDateYmd(params.lastWorkedDay)],
      ["S21.G00.60.010", formatDsnDateYmd(params.returnDate!)],
      ["S21.G00.60.011", params.motifCode],
    ]);
    return;
  }

  const rubriques: [string, string | number][] = [
    ["S21.G00.60.001", params.motifCode],
    ["S21.G00.60.002", formatDsnDateYmd(params.lastWorkedDay)],
  ];
  if (params.expectedEndDate) {
    rubriques.push(["S21.G00.60.003", formatDsnDateYmd(params.expectedEndDate)]);
  }
  if (params.subrogation) {
    rubriques.push(["S21.G00.60.004", "01"]);
  }
  pushLines(lines, rubriques);
}

function buildFinContratBlock(
  lines: string[],
  contractEndDate: string,
  motifCode: string
) {
  pushLines(lines, [
    ["S21.G00.62.001", formatDsnDateYmd(contractEndDate)],
    ["S21.G00.62.002", motifCode],
  ]);
}

function natureSlug(kind: DsnSignalementKind): string {
  switch (kind) {
    case "arret_travail":
      return "ARRET";
    case "reprise_arret":
      return "REPRISE";
    case "fin_contrat":
      return "FCTU";
  }
}

export function buildSignalementDsn(input: DsnSignalementBuildInput): DsnSignalementBuildResult {
  const { signalement, mode } = input;
  const warnings: string[] = [];
  const emp = signalement.employeeSnapshot;
  const employer = signalement.employerSnapshot;
  const kind = signalement.kind;
  const nature = DSN_SIGNALEMENT_NATURE[kind];

  const eventYmd = signalement.eventDate;
  const periodYm = periodYmFromDate(eventYmd);

  const nir = emp.socialSecurityNumber ? cleanNir(emp.socialSecurityNumber) : null;
  if (!nir) {
    warnings.push("NIR manquant — le fichier utilisera un identifiant provisoire.");
  }

  const { lastName, firstName } = employeeNames(emp);
  const contractNum = input.contractNum ?? "00001";

  const envelope = buildDsnEnvelope({
    mode,
    nature,
    periodYm,
    siret: employer.siret,
    legalName: employer.legalName,
    contactEmail: input.contactEmail,
    contactName: input.contactName,
  });

  const lines = [...envelope.lines];

  pushLines(lines, buildEstablishmentBlock(employer, envelope.siret14, 1));

  pushLines(
    lines,
    buildIndividualHeader({
      nir: nir ?? "000000000000000",
      lastName,
      firstName,
      contractNum,
      contractType: emp.contractType,
      contractStartYmd: input.contractStartYmd,
      weeklyHours: emp.targetWeeklyHours,
    })
  );

  if (kind === "arret_travail") {
    if (!signalement.lastWorkedDay) {
      throw new Error("Date du dernier jour travaillé obligatoire pour un arrêt.");
    }
    buildArretBlock(lines, {
      motifCode: signalement.motifCode,
      lastWorkedDay: signalement.lastWorkedDay,
      expectedEndDate: signalement.expectedEndDate,
      subrogation: signalement.subrogation,
      isReprise: false,
    });
  } else if (kind === "reprise_arret") {
    if (!signalement.returnDate) {
      throw new Error("Date de reprise obligatoire.");
    }
    if (!signalement.lastWorkedDay) {
      throw new Error("Date du dernier jour travaillé (arrêt initial) obligatoire.");
    }
    buildArretBlock(lines, {
      motifCode: signalement.motifCode,
      lastWorkedDay: signalement.lastWorkedDay,
      returnDate: signalement.returnDate,
      subrogation: false,
      isReprise: true,
    });
  } else if (kind === "fin_contrat") {
    if (!signalement.contractEndDate) {
      throw new Error("Date de fin de contrat obligatoire.");
    }
    buildFinContratBlock(lines, signalement.contractEndDate, signalement.motifCode);
  }

  lines.push(...buildDsnFooter(1));

  if (!employer.apeCode) {
    warnings.push("Code APE non renseigné — 5610A utilisé par défaut.");
  }

  const content = finalizeDsnContent(lines);
  const siretShort = envelope.siren;
  const filename = `DSN_${natureSlug(kind)}_${eventYmd}_${siretShort}_${mode === "test" ? "TEST" : "REEL"}.dsn`;

  return {
    content,
    filename,
    lineCount: lines.length,
    warnings,
  };
}
