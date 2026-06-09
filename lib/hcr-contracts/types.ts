export type HcrContractKind = "cdi" | "cdd" | "saisonnier" | "extra";

export type HcrClauseKey =
  | "trialPeriod"
  | "workingTimeModulation"
  | "mealBenefits"
  | "overtimePay"
  | "workClothes"
  | "nonCompete";

export type HcrEmployeeStatus = "employee" | "supervisor" | "executive";
export type HcrLevel = "1" | "2" | "3" | "4" | "5";
export type HcrEchelon = "1" | "2" | "3" | "4" | "elite";

export type HcrCddReason = "temporaryIncrease" | "employeeReplacement" | "seasonalJob";

export type HcrJobCode =
  | "server"
  | "commis"
  | "cook"
  | "chefDePartie"
  | "headChef"
  | "manager";

export interface HcrEmployerIdentity {
  restaurantId: string;
  companyName: string;
  legalName: string;
  legalForm: string;
  siret: string;
  urssafOffice: string;
  address: string;
  representativeName: string;
  representativeRole: string;
  collectiveAgreementIdcc: string;
  retirementFund: string;
  healthProvider: string;
}

export interface HcrEmployeeIdentity {
  staffMemberId?: string;
  firstName: string;
  lastName: string;
  address: string;
  socialSecurityNumber: string;
  nationality: string;
  birthDate?: string;
  birthPlace?: string;
}

export interface HcrJobAndPay {
  jobCode: HcrJobCode;
  jobTitle: string;
  missions: string;
  status: HcrEmployeeStatus;
  level: HcrLevel;
  echelon: HcrEchelon;
  hourlyRateGross: number;
  weeklyHours: number;
  monthlyGross: number;
}

export interface HcrTermContractDetails {
  reason: HcrCddReason | null;
  replacedEmployeeName?: string;
  replacedEmployeePosition?: string;
  startDate: string;
  endDate?: string;
  minimumDuration?: string;
  hasUncertainTerm: boolean;
  renewalClause: boolean;
  extraDates?: string;
  extraMission?: string;
  banquetDate?: string;
}

export interface HcrClauseSelection {
  trialPeriod: boolean;
  workingTimeModulation: boolean;
  mealBenefits: boolean;
  overtimePay: boolean;
  workClothes: boolean;
  nonCompete: boolean;
  logement: boolean;
  transport: boolean;
  materiel: boolean;
  exclusivite: boolean;
  image: boolean;
  dedit: boolean;
  delegation: boolean;
  videosurveillance: boolean;
  permis: boolean;
  confidentialiteRenforcee: boolean;
  tenueTravail: boolean;
  heuresComplementaires: boolean;
  forfaitJours: boolean;
  remunerationVariable: boolean;
  responsabiliteCaisse: boolean;
  charteInformatique: boolean;
  travailleurNuit: boolean;
  isPolyvalenceActive: boolean;
  mobilityZoneType: "ville" | "departement" | "radius";
  isTrialRenewable: boolean;
  planningNoticeDays: number;
  mutuelleEmployerShare: number;
  congesCalculMode: "ouvrables" | "ouvres";
  absenceJustificationHours: number;
  preavisMode: "auto" | "custom";
  trialPeriodValue: number;
  trialPeriodUnit: "jours" | "mois";
  mealBasketAmount: number;
  housingAddress?: string;
  housingValue?: number;
  housingChargesPayer?: "Salarié" | "Employeur";
  housingEvictionDays?: number;
  transportDeadline?: string;
  transportCoveragePercent?: number;
  providedEquipment?: string;
  trainingName?: string;
  trainingCenter?: string;
  trainingCost?: number;
  deditDuration?: number;
  nonCompeteDuration?: number;
  nonCompeteRadius?: number;
  nonCompeteZones?: string;
  nonCompeteCompensation?: number;
  mobilityRadius?: number;
  planningScheduleGrid?: Record<string, string>;
  customPreavisText?: string;
  delegationMissions?: string;
  cctvLocations?: string;
  requiredDriverLicense?: string;
  protectedSavoirFaire?: string;
  uniformProvidedList?: string;
  laundryAllowance?: number;
  maxComplementaryHoursPercent?: number;
  forfaitJoursMax?: number;
  variableBonusMax?: number;
  variableBonusCriteria?: string;
  posTerminalId?: string;
  workClothesDescription?: string;
  nonCompeteFinancialCompensation?: string;
}

export interface HcrContractDraft {
  contractKind: HcrContractKind;
  employer: HcrEmployerIdentity;
  employee: HcrEmployeeIdentity;
  jobAndPay: HcrJobAndPay;
  termDetails?: HcrTermContractDetails;
  clauses: HcrClauseSelection;
  signatureCity: string;
  signatureDate: string;
}

export interface HcrValidationIssue {
  path: string;
  message: string;
  severity: "blocking" | "warning";
}

export interface HcrGeneratedDocument {
  title: string;
  markdown: string;
  html: string;
  validationIssues: HcrValidationIssue[];
}
