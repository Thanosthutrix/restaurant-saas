import type { HcrContractKind, HcrContractDraft } from "./types";
import type { HcrContractRow } from "./hcrContractsDb";

export type StaffContractTerms = {
  contractId: string;
  contractKind: HcrContractKind;
  status: HcrContractRow["status"];
  staffMemberId: string;
  displayName: string;
  weeklyHours: number;
  startDate: string | null;
  endDate: string | null;
  /** CDD / saisonnier avec fenêtre de dates. */
  isTermContract: boolean;
};

function ymdValid(ymd: string | null | undefined): string | null {
  const s = (ymd ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function termWindowFromDraft(
  contractKind: HcrContractKind,
  draft: HcrContractDraft
): { startDate: string | null; endDate: string | null; isTermContract: boolean } {
  const term = draft.termDetails;
  const startDate = ymdValid(term?.startDate);
  const endDate = ymdValid(term?.endDate);
  const isTermContract = contractKind === "cdd" || contractKind === "saisonnier";
  return {
    startDate,
    endDate: isTermContract ? endDate : null,
    isTermContract,
  };
}

/** Contrat HCR le plus pertinent pour un collaborateur (exporté en priorité, puis le plus récent). */
export function pickStaffHcrContract(
  contracts: HcrContractRow[],
  staffMemberId: string
): HcrContractRow | null {
  const matching = contracts.filter((c) => c.staffMemberId === staffMemberId);
  if (matching.length === 0) return null;
  const exported = matching.filter((c) => c.status === "exported");
  const pool = exported.length > 0 ? exported : matching;
  return [...pool].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function staffContractTermsFromRow(contract: HcrContractRow): StaffContractTerms | null {
  if (!contract.staffMemberId) return null;
  const weekly = contract.draft.jobAndPay.weeklyHours;
  if (!Number.isFinite(weekly) || weekly <= 0) return null;

  const { startDate, endDate, isTermContract } = termWindowFromDraft(
    contract.contractKind,
    contract.draft
  );
  const name = `${contract.draft.employee.firstName} ${contract.draft.employee.lastName}`.trim();

  return {
    contractId: contract.id,
    contractKind: contract.contractKind,
    status: contract.status,
    staffMemberId: contract.staffMemberId,
    displayName: name || contract.title,
    weeklyHours: weekly,
    startDate,
    endDate,
    isTermContract,
  };
}

export function contractKindLabel(kind: HcrContractKind): string {
  if (kind === "cdd") return "CDD";
  if (kind === "cdi") return "CDI";
  if (kind === "saisonnier") return "Saisonnier";
  return "Extra";
}

export type ContractLifecycle = "upcoming" | "active" | "ended" | "unknown";

export function contractLifecycle(
  startDate: string | null,
  endDate: string | null,
  todayYmd: string
): ContractLifecycle {
  if (!startDate) return "unknown";
  if (startDate > todayYmd) return "upcoming";
  if (endDate && endDate < todayYmd) return "ended";
  return "active";
}
