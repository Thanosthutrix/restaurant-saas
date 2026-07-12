/**
 * Bilan « Ma poche » : ce qui reste au restaurateur sur une période.
 *
 * Les dépenses viennent des FACTURES réelles (classées par poste comptable à
 * l'analyse IA), complétées par les charges récurrentes manuelles pour ce qui
 * n'a pas de facture (loyer, échéance d'emprunt, amortissements…) et par la
 * masse salariale calculée (heures pointées/planifiées × brut × charges patronales).
 *
 * Deux modes pour le poste matières premières :
 *  - "cash" (trésorerie)   : factures d'achats de la période = ce qui est sorti du compte.
 *  - "perf" (performance)  : consommation FIFO réelle des ventes = coût matière économique.
 * Les autres postes sont identiques dans les deux modes.
 *
 * Les incomplétudes (services non valorisés, factures sans montant, salaires
 * manquants…) sont remontées comme indicateurs — le bilan reste honnête.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchServicesInDateRange,
  getRealizedMarginRowsForServices,
} from "@/lib/margins/realizedServiceMargins";
import {
  EXPENSE_CATEGORY_VALUES,
  isExpenseCategory,
  type ExpenseCategory,
} from "@/lib/pocket/expenseCategories";

const PARIS_TZ = "Europe/Paris";

export type PocketMode = "cash" | "perf";

export type PocketStaffLine = {
  staffMemberId: string;
  displayName: string;
  hours: number;
  attendanceHours: number;
  hourlyGrossRate: number | null;
  loadedCost: number | null;
};

export type PocketFixedChargeRow = {
  id: string;
  label: string;
  monthlyAmount: number;
  active: boolean;
  category: ExpenseCategory;
  periodicity: "monthly" | "quarterly" | "yearly";
};

export type PocketInvoiceRow = {
  id: string;
  label: string;
  invoiceDate: string | null;
  /** HT si connu, sinon TTC (voir approxTtc). */
  amountHt: number;
  approxTtc: boolean;
  category: ExpenseCategory;
};

export type PocketPosteBreakdown = {
  category: ExpenseCategory;
  invoicesHt: number;
  invoicesCount: number;
  /** Charges récurrentes manuelles proratisées sur la période. */
  manualPortion: number;
  /** Masse salariale calculée (poste RH uniquement). */
  labor: number;
  /** Consommation FIFO (poste matières, mode performance uniquement). */
  fifo: number;
  total: number;
};

export type PocketReport = {
  from: string;
  to: string;
  days: number;
  mode: PocketMode;

  revenueHt: number;
  revenueIncomplete: boolean;
  servicesCount: number;
  /** Part du CA venant des relevés mensuels importés (mois sans services saisis). */
  importedRevenueHt: number;
  /** Mois (YYYY-MM) dont le CA vient d'un relevé importé. */
  importedMonths: string[];

  /** Consommation FIFO de la période (toujours calculée, pour le ratio). */
  fifoCostHt: number;
  foodCostHasUnknown: boolean;

  laborCost: number;
  laborLines: PocketStaffLine[];
  staffMissingRate: string[];
  payrollEmployerPct: number;

  postes: PocketPosteBreakdown[];
  invoicesByCategory: Record<string, PocketInvoiceRow[]>;
  /** Factures de la période sans aucun montant exploitable. */
  invoicesWithoutAmount: number;
  totalExpenses: number;

  operatingResult: number;
  pocketTaxPct: number | null;
  taxEstimate: number;
  pocket: number;

  foodCostPct: number | null;
  laborPct: number | null;

  /** Jours d'ouverture couverts par la période (selon fermetures hebdo). */
  openDaysInPeriod: number;
  /** true = la période couvre des mois entiers → charges mensuelles pleines. */
  fullMonthsAllocation: boolean;
  /** Seuil de rentabilité sur la période (null si indéterminable). */
  breakEven: {
    /** CA HT nécessaire pour couvrir toutes les charges de la période. */
    thresholdHt: number;
    /** Part variable estimée (matières) en % du CA. */
    variableRatePct: number;
    fixedTotal: number;
    reached: boolean;
    /** Premier jour où le CA cumulé franchit le seuil (si atteint). */
    reachedDate: string | null;
    /** CA manquant pour atteindre l'équilibre (si non atteint). */
    missingHt: number;
  } | null;
  /** Suivi cumulatif : les engagements fixes du mois sont posés dès le premier jour. */
  breakEvenTimeline: {
    date: string;
    revenueHt: number;
    cumulativeRevenueHt: number;
    variableCosts: number;
    cumulativePocket: number;
  }[];
  /** Charges fixes posées au premier jour de la période (mois entamé + salaires/factures du jour). */
  fixedCommitmentsAtStart: number;
  /** Taux des coûts qui croissent avec le CA (matières + commissions livraison/CB/TR). */
  revenueLinkedCostPct: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parisDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { timeZone: PARIS_TZ });
}

function daysInclusive(from: string, to: string): number {
  const a = new Date(from + "T12:00:00Z").getTime();
  const b = new Date(to + "T12:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Équivalent MENSUEL d'une charge selon sa périodicité. */
function monthlyEquivalent(charge: PocketFixedChargeRow): number {
  switch (charge.periodicity) {
    case "monthly":
      return charge.monthlyAmount;
    case "quarterly":
      return charge.monthlyAmount / 3;
    case "yearly":
      return charge.monthlyAmount / 12;
  }
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

/** Jours d'ouverture entre deux dates incluses (selon jours de fermeture hebdo, 0=dim). */
function openDaysBetween(from: string, to: string, closedDows: number[]): number {
  let count = 0;
  const d = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z").getTime();
  while (d.getTime() <= end) {
    if (!closedDows.includes(d.getUTCDay())) count += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/** Premiers jours couverts de chaque mois chevauché par [from, to]. */
function monthOverlapStarts(from: string, to: string): string[] {
  const starts: string[] = [];
  let cursor = from.slice(0, 7); // YYYY-MM
  const endMonth = to.slice(0, 7);
  while (cursor <= endMonth) {
    const monthStart = cursor + "-01";
    starts.push(monthStart > from ? monthStart : from);
    const [y, m] = cursor.split("-").map(Number);
    cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return starts;
}

/**
 * Répartition des charges récurrentes sur [from, to] : chaque mois ENTAMÉ porte
 * son montant mensuel PLEIN (le loyer est dû dès le début du mois, il n'est pas
 * lissé par jour). Trimestrielles ÷ 3 et annuelles ÷ 12 en équivalent mensuel.
 */
function allocateManualCharges(
  charges: PocketFixedChargeRow[],
  from: string,
  to: string,
  closedDows: number[]
): { byCategory: Map<ExpenseCategory, number>; fullMonthsOnly: boolean; openDaysInPeriod: number } {
  const byCategory = new Map<ExpenseCategory, number>();
  const monthsCount = monthOverlapStarts(from, to).length;
  const fullMonthsOnly = from.slice(8, 10) === "01" && to === lastDayOfMonth(to.slice(0, 7));

  for (const c of charges) {
    const portion = monthlyEquivalent(c) * monthsCount;
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + portion);
  }

  return {
    byCategory,
    fullMonthsOnly,
    openDaysInPeriod: openDaysBetween(from, to, closedDows),
  };
}

async function loadPocketSettings(restaurantId: string): Promise<{
  payrollEmployerPct: number;
  pocketTaxPct: number | null;
  closedDows: number[];
}> {
  const { data } = await supabaseServer
    .from("restaurants")
    .select("payroll_employer_pct, pocket_tax_pct, closed_days_of_week")
    .eq("id", restaurantId)
    .maybeSingle();
  const row = data as {
    payroll_employer_pct?: unknown;
    pocket_tax_pct?: unknown;
    closed_days_of_week?: unknown;
  } | null;
  const employer = row?.payroll_employer_pct != null ? Number(row.payroll_employer_pct) : 42;
  const tax = row?.pocket_tax_pct != null ? Number(row.pocket_tax_pct) : null;
  const closedDows = Array.isArray(row?.closed_days_of_week)
    ? (row.closed_days_of_week as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  return {
    payrollEmployerPct: Number.isFinite(employer) ? employer : 42,
    pocketTaxPct: tax != null && Number.isFinite(tax) ? tax : null,
    closedDows,
  };
}

export async function listFixedCharges(restaurantId: string): Promise<PocketFixedChargeRow[]> {
  const { data } = await supabaseServer
    .from("restaurant_fixed_charges")
    .select("id, label, monthly_amount, active, category, periodicity")
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("label");
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    monthlyAmount: Number(r.monthly_amount) || 0,
    active: Boolean(r.active),
    category: isExpenseCategory(String(r.category ?? "")) ? (r.category as ExpenseCategory) : "locaux",
    periodicity:
      r.periodicity === "quarterly" || r.periodicity === "yearly"
        ? (r.periodicity as "quarterly" | "yearly")
        : "monthly",
  }));
}

/** Factures de la période, classées par poste. */
async function loadInvoices(
  restaurantId: string,
  from: string,
  to: string
): Promise<{ byCategory: Record<string, PocketInvoiceRow[]>; withoutAmount: number }> {
  const { data } = await supabaseServer
    .from("supplier_invoices")
    .select("id, invoice_number, file_name, invoice_date, amount_ht, amount_ttc, expense_category")
    .eq("restaurant_id", restaurantId)
    .gte("invoice_date", from)
    .lte("invoice_date", to)
    .limit(3000);

  const byCategory: Record<string, PocketInvoiceRow[]> = {};
  let withoutAmount = 0;

  for (const r of ((data as Record<string, unknown>[]) ?? [])) {
    const ht = r.amount_ht != null ? Number(r.amount_ht) : null;
    const ttc = r.amount_ttc != null ? Number(r.amount_ttc) : null;
    const amount = ht != null && Number.isFinite(ht) ? ht : ttc != null && Number.isFinite(ttc) ? ttc : null;
    if (amount == null) {
      withoutAmount += 1;
      continue;
    }
    const category = isExpenseCategory(String(r.expense_category ?? ""))
      ? (r.expense_category as ExpenseCategory)
      : "matieres";
    const row: PocketInvoiceRow = {
      id: String(r.id),
      label: String(r.invoice_number || r.file_name || "Facture"),
      invoiceDate: r.invoice_date ? String(r.invoice_date) : null,
      amountHt: round2(amount),
      approxTtc: ht == null,
      category,
    };
    (byCategory[category] ??= []).push(row);
  }

  for (const list of Object.values(byCategory)) {
    list.sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "") || b.amountHt - a.amountHt);
  }
  return { byCategory, withoutAmount };
}

/** Masse salariale : heures planifiées du planning, par mois calendaire. */
async function computeLabor(
  restaurantId: string,
  from: string,
  to: string,
  payrollEmployerPct: number
): Promise<{ lines: PocketStaffLine[]; total: number; missing: string[]; byMonth: Map<string, number> }> {
  const overlapMonths = monthOverlapStarts(from, to).map((d) => d.slice(0, 7));
  if (overlapMonths.length === 0) {
    return { lines: [], total: 0, missing: [], byMonth: new Map() };
  }

  const calendarFrom = overlapMonths[0] + "-01";
  const calendarTo = lastDayOfMonth(overlapMonths[overlapMonths.length - 1]);
  const fromTs = new Date(calendarFrom + "T00:00:00Z");
  fromTs.setUTCDate(fromTs.getUTCDate() - 1);
  const toTs = new Date(calendarTo + "T23:59:59Z");
  toTs.setUTCDate(toTs.getUTCDate() + 1);

  const { data: shiftsData } = await supabaseServer
    .from("work_shifts")
    .select("id, staff_member_id, starts_at, ends_at")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", fromTs.toISOString())
    .lte("starts_at", toTs.toISOString())
    .limit(5000);

  const monthSet = new Set(overlapMonths);
  const shifts = ((shiftsData as Record<string, unknown>[]) ?? [])
    .map((s) => ({
      id: String(s.id),
      staffMemberId: String(s.staff_member_id),
      startsAt: String(s.starts_at),
      endsAt: String(s.ends_at),
    }))
    .filter((s) => monthSet.has(parisDay(s.startsAt).slice(0, 7)));

  const { data: staffData } = await supabaseServer
    .from("staff_members")
    .select("id, display_name, hourly_gross_rate")
    .eq("restaurant_id", restaurantId);

  const staffById = new Map(
    (((staffData as Record<string, unknown>[]) ?? []) as Record<string, unknown>[]).map((s) => [
      String(s.id),
      {
        displayName: String(s.display_name ?? "Employé"),
        rate: s.hourly_gross_rate != null ? Number(s.hourly_gross_rate) : null,
      },
    ])
  );

  const hoursByStaff = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const loadFactor = 1 + payrollEmployerPct / 100;

  for (const s of shifts) {
    let hours = (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3_600_000;
    if (!Number.isFinite(hours) || hours <= 0) continue;
    hours = Math.min(hours, 16);
    const ym = parisDay(s.startsAt).slice(0, 7);
    hoursByStaff.set(s.staffMemberId, (hoursByStaff.get(s.staffMemberId) ?? 0) + hours);

    const staff = staffById.get(s.staffMemberId);
    if (staff?.rate == null) continue;
    const cost = hours * staff.rate * loadFactor;
    byMonth.set(ym, round2((byMonth.get(ym) ?? 0) + cost));
  }

  const lines: PocketStaffLine[] = [];
  const missing: string[] = [];
  let total = 0;

  for (const [staffId, hours] of hoursByStaff) {
    const staff = staffById.get(staffId) ?? { displayName: "Employé", rate: null };
    const cost = staff.rate != null ? round2(hours * staff.rate * loadFactor) : null;
    if (cost != null) total += cost;
    else missing.push(staff.displayName);
    lines.push({
      staffMemberId: staffId,
      displayName: staff.displayName,
      hours: round2(hours),
      attendanceHours: 0,
      hourlyGrossRate: staff.rate,
      loadedCost: cost,
    });
  }

  lines.sort((a, b) => (b.loadedCost ?? 0) - (a.loadedCost ?? 0) || b.hours - a.hours);
  total = round2([...byMonth.values()].reduce((s, v) => s + v, 0));
  return { lines, total, missing, byMonth };
}

export async function buildPocketReport(
  restaurantId: string,
  from: string,
  to: string,
  mode: PocketMode = "cash"
): Promise<PocketReport> {
  const settings = await loadPocketSettings(restaurantId);

  const [services, labor, charges, invoices] = await Promise.all([
    fetchServicesInDateRange(restaurantId, from, to, 2000),
    computeLabor(restaurantId, from, to, settings.payrollEmployerPct),
    listFixedCharges(restaurantId),
    loadInvoices(restaurantId, from, to),
  ]);

  const marginRows = await getRealizedMarginRowsForServices(restaurantId, services);

  let revenueHt = 0;
  let revenueIncomplete = false;
  let fifoCostHt = 0;
  let foodCostHasUnknown = false;
  for (const r of marginRows) {
    if (r.revenueHt != null) revenueHt += r.revenueHt;
    if (!r.revenueComplete || r.revenueHt == null) revenueIncomplete = true;
    fifoCostHt += r.fifoCostHt;
    if (r.fifoHasUnknownCost) foodCostHasUnknown = true;
  }
  revenueHt = round2(revenueHt);
  fifoCostHt = round2(fifoCostHt);

  // ── CA importé (relevés mensuels analysés par IA) ─────────────────────────
  // Les mois de la période SANS services saisis dans l'app sont complétés par
  // le CA des relevés importés (restaurant_monthly_revenues). Un mois avec des
  // services valorisés garde la donnée de l'app — jamais de double compte.
  const serviceMonthsWithRevenue = new Set<string>();
  for (const r of marginRows) {
    if (r.revenueHt != null && r.revenueHt > 0) serviceMonthsWithRevenue.add(r.serviceDate.slice(0, 7));
  }
  let importedRevenueHt = 0;
  const importedMonths: string[] = [];
  const importedRevenueByDay = new Map<string, number>();
  {
    const { data: importedRows } = await supabaseServer
      .from("restaurant_monthly_revenues")
      .select("month, revenue_ht, revenue_ttc")
      .eq("restaurant_id", restaurantId)
      .gte("month", from.slice(0, 7) + "-01")
      .lte("month", to.slice(0, 7) + "-01");

    for (const row of (importedRows ?? []) as { month: string; revenue_ht: unknown; revenue_ttc: unknown }[]) {
      const ym = String(row.month).slice(0, 7);
      if (serviceMonthsWithRevenue.has(ym)) continue;
      const ht = row.revenue_ht != null ? Number(row.revenue_ht) : NaN;
      const ttc = row.revenue_ttc != null ? Number(row.revenue_ttc) : NaN;
      // HT prioritaire ; sinon estimation depuis le TTC (TVA restauration 10 %).
      const monthlyHt = Number.isFinite(ht) && ht > 0 ? ht : Number.isFinite(ttc) && ttc > 0 ? ttc / 1.1 : null;
      if (monthlyHt == null) continue;

      const monthStart = ym + "-01";
      const monthEnd = lastDayOfMonth(ym);
      const overlapStart = monthStart > from ? monthStart : from;
      const overlapEnd = monthEnd < to ? monthEnd : to;
      const openInMonth = openDaysBetween(monthStart, monthEnd, settings.closedDows);
      const openInOverlap = openDaysBetween(overlapStart, overlapEnd, settings.closedDows);
      // Mois partiellement couvert : part proportionnelle aux jours d'ouverture couverts.
      const fraction = openInMonth > 0 ? openInOverlap / openInMonth : 0;
      const portion = round2(monthlyHt * fraction);
      if (portion <= 0) continue;

      importedRevenueHt += portion;
      importedMonths.push(ym);

      // Répartition uniforme sur les jours d'ouverture couverts (courbe d'équilibre).
      const perDay = portion / openInOverlap;
      const d = new Date(overlapStart + "T12:00:00Z");
      const end = new Date(overlapEnd + "T12:00:00Z").getTime();
      while (d.getTime() <= end) {
        if (!settings.closedDows.includes(d.getUTCDay())) {
          const day = d.toISOString().slice(0, 10);
          importedRevenueByDay.set(day, round2((importedRevenueByDay.get(day) ?? 0) + perDay));
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    importedRevenueHt = round2(importedRevenueHt);
    importedMonths.sort();
    revenueHt = round2(revenueHt + importedRevenueHt);
  }

  const days = daysInclusive(from, to);

  // Charges manuelles : mois complets pleins, périodes partielles réparties
  // sur les jours d'ouverture (voir allocateManualCharges).
  const allocation = allocateManualCharges(
    charges.filter((c) => c.active),
    from,
    to,
    settings.closedDows
  );
  const manualByCategory = allocation.byCategory;

  // Postes : factures + manuel (+ salaire calculé pour RH ; + FIFO pour matières en mode perf).
  const postes: PocketPosteBreakdown[] = [];
  let totalExpenses = 0;
  for (const category of EXPENSE_CATEGORY_VALUES) {
    const invoiceRows = invoices.byCategory[category] ?? [];
    // Mode performance : les achats matières (factures) sont remplacés par la consommation FIFO.
    const useInvoices = !(mode === "perf" && category === "matieres");
    const invoicesHt = useInvoices ? round2(invoiceRows.reduce((s, r) => s + r.amountHt, 0)) : 0;
    const manualPortion = round2(manualByCategory.get(category) ?? 0);
    const laborPart = category === "rh" ? labor.total : 0;
    const fifoPart = mode === "perf" && category === "matieres" ? fifoCostHt : 0;
    const total = round2(invoicesHt + manualPortion + laborPart + fifoPart);
    if (total === 0 && invoiceRows.length === 0) continue;
    totalExpenses += total;
    postes.push({
      category,
      invoicesHt,
      invoicesCount: useInvoices ? invoiceRows.length : 0,
      manualPortion,
      labor: laborPart,
      fifo: fifoPart,
      total,
    });
  }
  totalExpenses = round2(totalExpenses);

  const operatingResult = round2(revenueHt - totalExpenses);
  const taxEstimate =
    settings.pocketTaxPct != null && operatingResult > 0
      ? round2((operatingResult * settings.pocketTaxPct) / 100)
      : 0;
  const pocket = round2(operatingResult - taxEstimate);

  const matiereForRatio = mode === "perf" ? fifoCostHt : (postes.find((p) => p.category === "matieres")?.total ?? 0);

  // ── Point d'équilibre ─────────────────────────────────────────────────────
  // Échéancier réel : charges fixes et salaires (heures planifiées) déduits
  // intégralement au début de chaque mois entamé ; factures non variables à
  // leur date ; matières et commissions suivent le CA.
  let breakEven: PocketReport["breakEven"] = null;
  let breakEvenTimeline: PocketReport["breakEvenTimeline"] = [];
  let fixedCommitmentsAtStart = 0;
  let revenueLinkedCostPct = 0;
  {
    const VARIABLE_CATEGORIES: ExpenseCategory[] = ["matieres", "marketing_banque"];
    const marketingBank = postes.find((p) => p.category === "marketing_banque")?.total ?? 0;
    const variable = round2(matiereForRatio + marketingBank);
    const fixedTotal = round2(totalExpenses - variable);
    const v = revenueHt > 0 ? Math.min(variable / revenueHt, 0.95) : 0;
    revenueLinkedCostPct = Math.round(v * 1000) / 10;

    // Échéancier des charges fixes (clampé dans la période).
    const fixedByDay = new Map<string, number>();
    const addFixed = (day: string, amount: number) => {
      if (!(amount > 0)) return;
      const clamped = day < from ? from : day > to ? to : day;
      fixedByDay.set(clamped, round2((fixedByDay.get(clamped) ?? 0) + amount));
    };
    // Charges récurrentes : montant mensuel plein au premier jour couvert du mois.
    const manualMonthlyFixed = charges
      .filter((c) => c.active && !VARIABLE_CATEGORIES.includes(c.category))
      .reduce((s, c) => s + monthlyEquivalent(c), 0);
    for (const monthStart of monthOverlapStarts(from, to)) {
      addFixed(monthStart, manualMonthlyFixed);
    }
    // Salaires : heures planifiées du mois, déduites en bloc au début du mois.
    for (const monthStart of monthOverlapStarts(from, to)) {
      const ym = monthStart.slice(0, 7);
      addFixed(monthStart, labor.byMonth.get(ym) ?? 0);
    }
    // Factures non liées aux ventes : à leur date de facture.
    for (const category of EXPENSE_CATEGORY_VALUES) {
      if (VARIABLE_CATEGORIES.includes(category)) continue;
      for (const inv of invoices.byCategory[category] ?? []) {
        addFixed(inv.invoiceDate ?? from, inv.amountHt);
      }
    }
    fixedCommitmentsAtStart = round2(fixedByDay.get(from) ?? 0);

    const revenueByDay = new Map<string, number>(importedRevenueByDay);
    for (const r of marginRows) {
      if (r.revenueHt != null) revenueByDay.set(r.serviceDate, round2((revenueByDay.get(r.serviceDate) ?? 0) + r.revenueHt));
    }
    let cumFixed = 0;
    for (let cursor = new Date(from + "T12:00:00Z"); cursor <= new Date(to + "T12:00:00Z"); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const dailyRevenue = revenueByDay.get(date) ?? 0;
      cumFixed = round2(cumFixed + (fixedByDay.get(date) ?? 0));
      const previous = breakEvenTimeline.at(-1);
      const cumulativeRevenueHt = round2((previous?.cumulativeRevenueHt ?? 0) + dailyRevenue);
      const variableCosts = round2(cumulativeRevenueHt * v);
      const operating = round2(cumulativeRevenueHt - cumFixed - variableCosts);
      const dailyTax = settings.pocketTaxPct != null && operating > 0
        ? round2((operating * settings.pocketTaxPct) / 100)
        : 0;
      breakEvenTimeline.push({
        date,
        revenueHt: dailyRevenue,
        cumulativeRevenueHt,
        variableCosts,
        cumulativePocket: round2(operating - dailyTax),
      });
    }

    if (fixedTotal > 0) {
      const thresholdHt = round2(fixedTotal / (1 - v));
      const reached = revenueHt >= thresholdHt;

      // Premier jour où le cumul repasse au-dessus de zéro (charges déjà posées).
      let reachedDate: string | null = null;
      if (reached) {
        for (const point of breakEvenTimeline) {
          if (point.cumulativePocket >= 0 && point.cumulativeRevenueHt > 0) {
            reachedDate = point.date;
            break;
          }
        }
      }

      breakEven = {
        thresholdHt,
        variableRatePct: Math.round(v * 1000) / 10,
        fixedTotal,
        reached,
        reachedDate,
        missingHt: reached ? 0 : round2(thresholdHt - revenueHt),
      };
    }
  }

  return {
    from,
    to,
    days,
    mode,
    revenueHt,
    revenueIncomplete,
    servicesCount: services.length,
    importedRevenueHt,
    importedMonths,
    fifoCostHt,
    foodCostHasUnknown,
    laborCost: labor.total,
    laborLines: labor.lines,
    staffMissingRate: labor.missing,
    payrollEmployerPct: settings.payrollEmployerPct,
    postes,
    invoicesByCategory: invoices.byCategory,
    invoicesWithoutAmount: invoices.withoutAmount,
    totalExpenses,
    operatingResult,
    pocketTaxPct: settings.pocketTaxPct,
    taxEstimate,
    pocket,
    foodCostPct: revenueHt > 0 ? Math.round((matiereForRatio / revenueHt) * 1000) / 10 : null,
    laborPct:
      revenueHt > 0
        ? Math.round(((postes.find((p) => p.category === "rh")?.total ?? 0) / revenueHt) * 1000) / 10
        : null,
    openDaysInPeriod: allocation.openDaysInPeriod,
    fullMonthsAllocation: allocation.fullMonthsOnly,
    breakEven,
    breakEvenTimeline,
    fixedCommitmentsAtStart,
    revenueLinkedCostPct,
  };
}
