import type { PayslipEmployeeSnapshot, PayslipEmployerSnapshot } from "../payslipTypes";

export type DsnSignalementKind = "arret_travail" | "reprise_arret" | "fin_contrat";

export type DsnSignalementStatus = "draft" | "exported";

export const DSN_SIGNALEMENT_KIND_LABELS: Record<DsnSignalementKind, string> = {
  arret_travail: "Arrêt de travail",
  reprise_arret: "Reprise après arrêt",
  fin_contrat: "Fin de contrat (FCTU)",
};

export const DSN_SIGNALEMENT_NATURE: Record<DsnSignalementKind, "04" | "05" | "07"> = {
  arret_travail: "04",
  reprise_arret: "05",
  fin_contrat: "07",
};

export type DsnSignalementRow = {
  id: string;
  restaurantId: string;
  staffMemberId: string;
  kind: DsnSignalementKind;
  status: DsnSignalementStatus;
  eventDate: string;
  lastWorkedDay: string | null;
  expectedEndDate: string | null;
  returnDate: string | null;
  contractEndDate: string | null;
  motifCode: string;
  subrogation: boolean;
  linkedArretId: string | null;
  employeeSnapshot: PayslipEmployeeSnapshot;
  employerSnapshot: PayslipEmployerSnapshot;
  notes: string | null;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DsnSignalementInput = {
  restaurantId: string;
  staffMemberId: string;
  kind: DsnSignalementKind;
  eventDate: string;
  lastWorkedDay?: string | null;
  expectedEndDate?: string | null;
  returnDate?: string | null;
  contractEndDate?: string | null;
  motifCode: string;
  subrogation?: boolean;
  linkedArretId?: string | null;
  notes?: string | null;
  employeeSnapshot: PayslipEmployeeSnapshot;
  employerSnapshot: PayslipEmployerSnapshot;
};

export type DsnSignalementBuildInput = {
  signalement: DsnSignalementRow;
  mode: "test" | "real";
  contactEmail?: string;
  contactName?: string;
  contractStartYmd: string;
  contractNum?: string;
};

export type DsnSignalementBuildResult = {
  content: string;
  filename: string;
  lineCount: number;
  warnings: string[];
};
