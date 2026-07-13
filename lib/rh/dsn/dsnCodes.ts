import type { PayslipLineRow } from "../payslipTypes";

/** Codes CTP URSSAF / organismes pour S21.G00.81.001 (extrait paie HCR 2026). */
export const DSN_COTISATION_CODE: Record<
  string,
  { code: string; side: "employee" | "employer" | "both" }
> = {
  maladie: { code: "100", side: "employer" },
  vieillesse_plaf: { code: "076", side: "both" },
  vieillesse_deplaf: { code: "074", side: "both" },
  allocations_familiales: { code: "100", side: "employer" },
  agirc_arrco_t1: { code: "192", side: "both" },
  atmp: { code: "045", side: "employer" },
  chomage: { code: "772", side: "employer" },
  ags: { code: "937", side: "employer" },
  fnal: { code: "959", side: "employer" },
  cfp: { code: "992", side: "employer" },
  taxe_apprentissage: { code: "993", side: "employer" },
  csg_deduct: { code: "907", side: "employee" },
  csg_crds: { code: "908", side: "employee" },
  mutuelle_salarie: { code: "059", side: "employee" },
  mutuelle_patron: { code: "059", side: "employer" },
  prevoyance_patron: { code: "060", side: "employer" },
  pas: { code: "671", side: "employee" },
};

/** Codes base assujettie S21.G00.78.001 */
export const DSN_BASE_CODE = {
  brutDeplaf: "02",
  brutPlaf: "03",
  csg: "04",
  chomage: "07",
} as const;

export function contractNatureCode(contractType: string | null): string {
  switch (contractType) {
    case "cdd":
      return "02";
    case "extra":
      return "29";
    case "interim":
      return "07";
    case "apprentissage":
      return "04";
    default:
      return "01";
  }
}

export function mapPayslipLineToDsnCotisation(
  line: PayslipLineRow
): { code: string; base: number; amount: number } | null {
  const mapping = DSN_COTISATION_CODE[line.code];
  if (!mapping) return null;
  const amount = Math.abs(line.amount);
  if (amount <= 0) return null;
  return {
    code: mapping.code,
    base: line.baseAmount ?? 0,
    amount,
  };
}
