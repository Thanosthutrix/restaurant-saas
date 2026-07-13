import type { EmployerProfile } from "./employerProfile";
import { PAYROLL_LEGAL_NOTICE } from "./payrollEngine/constants2026";

export type PayrollPeriodSettings = {
  atmpRatePct: number;
  apeCode: string | null;
};

export type PayrollPeriodStatus = "draft" | "imported" | "hours_validated" | "computed" | "finalized";
export type PayslipStatus = "draft" | "hours_validated" | "computed" | "finalized";
export type HoursSource = "planned" | "attendance";
export type PayslipLineSection = "earning" | "employee_contrib" | "employer_contrib" | "deduction" | "info";

export type PayrollPeriodRow = {
  id: string;
  restaurantId: string;
  periodMonth: string;
  status: PayrollPeriodStatus;
  hoursSource: HoursSource;
  importedAt: string | null;
  hoursValidatedAt: string | null;
  computedAt: string | null;
  finalizedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

import type { PaidLeaveSnapshot } from "./paidLeave";

export type PayslipEmployeeSnapshot = {
  staffMemberId: string;
  displayName: string;
  roleLabel: string | null;
  contractType: string | null;
  socialSecurityNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  targetWeeklyHours: number | null;
  monthlyContractHours: number | null;
  paidLeave?: PaidLeaveSnapshot | null;
};

export type PayslipEmployerSnapshot = {
  legalName: string;
  siret: string;
  urssafOffice: string;
  address: string;
  collectiveAgreementIdcc: string;
  healthProvider: string;
  retirementFund: string;
  apeCode: string | null;
};

export type PayslipPaySnapshot = {
  engineVersion: string;
  pmss: number;
  pass: number;
  smicHourly: number;
  atmpRatePct: number;
  staffHeadcount: number;
  payrollEmployerPct: number;
  normalHours: number;
  overtimeHours: number;
  hourlyGrossRate: number;
  grossBase: number;
  grossOvertimePremium: number;
  grossTotal: number;
  bases: {
    grossTotal: number;
    cappedPmss: number;
    capped4Pmss: number;
    agircT1: number;
    csgAssiette: number;
  };
  employeeContribTotal: number;
  netImposable: number;
  pasRatePct: number | null;
  pasAmount: number;
  netBeforeTax: number;
  netPayable: number;
  employerContribTotal: number;
  employerCostTotal: number;
  bilanLoadedCost: number;
  computedAt: string;
  legalNotice: string;
};

export type PayslipBenefitsSnapshot = {
  mutuelleEmployerSharePct: number;
  mutuelleMonthlyEmployerTotal: number;
  mutuelleMonthlyEmployeeTotal: number;
  mutuellePerEmployeeEmployer: number;
  mutuellePerEmployeeEmployee: number;
  prevoyanceMonthlyEmployerTotal: number;
  prevoyancePerEmployeeEmployer: number;
  administratifChargeIds: string[];
  sourceNote: string;
};

export type PayslipAlert = {
  code: string;
  level: "error" | "warning" | "info";
  message: string;
};

export type PayslipRow = {
  id: string;
  payrollPeriodId: string;
  restaurantId: string;
  staffMemberId: string;
  status: PayslipStatus;
  hoursImported: number | null;
  hoursValidated: number | null;
  hourlyGrossRate: number | null;
  grossTotal: number | null;
  netBeforeTax: number | null;
  employeeContribTotal: number | null;
  employerContribTotal: number | null;
  employerCostTotal: number | null;
  employeeSnapshot: PayslipEmployeeSnapshot;
  employerSnapshot: PayslipEmployerSnapshot;
  paySnapshot: PayslipPaySnapshot | null;
  benefitsSnapshot: PayslipBenefitsSnapshot | null;
  alerts: PayslipAlert[];
  hcrContractId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayslipHourLineRow = {
  id: string;
  payslipId: string;
  workShiftId: string | null;
  day: string;
  label: string;
  plannedHours: number;
  attendanceHours: number | null;
  validatedHours: number;
  isManualOverride: boolean;
  sortOrder: number;
};

export type PayslipLineRow = {
  id: string;
  payslipId: string;
  section: PayslipLineSection;
  code: string;
  label: string;
  baseAmount: number | null;
  rate: number | null;
  amount: number;
  sortOrder: number;
};

export type PayslipPeriodBundle = {
  period: PayrollPeriodRow;
  payslips: PayslipRow[];
  hourLinesByPayslip: Record<string, PayslipHourLineRow[]>;
  linesByPayslip: Record<string, PayslipLineRow[]>;
};

export function employerProfileToPayslipSnapshot(
  profile: EmployerProfile,
  settings?: PayrollPeriodSettings
): PayslipEmployerSnapshot {
  return {
    legalName: profile.legalName || profile.companyName,
    siret: profile.siret,
    urssafOffice: profile.urssafOffice,
    address: profile.address,
    collectiveAgreementIdcc: profile.collectiveAgreementIdcc,
    healthProvider: profile.healthProvider,
    retirementFund: profile.retirementFund,
    apeCode: settings?.apeCode ?? profile.apeCode ?? null,
  };
}

export const PAYSLIP_LEGAL_NOTICE = PAYROLL_LEGAL_NOTICE;

export const PERIOD_STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  draft: "Brouillon",
  imported: "Heures importées",
  hours_validated: "Heures validées",
  computed: "Bulletins émis",
  finalized: "Bulletins finalisés",
};
