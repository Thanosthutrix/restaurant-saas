import { supabaseServer } from "@/lib/supabaseServer";
import type {
  PayrollPeriodRow,
  PayrollPeriodStatus,
  PayslipHourLineRow,
  PayslipLineRow,
  PayslipPeriodBundle,
  PayslipRow,
  PayslipStatus,
  HoursSource,
} from "./payslipTypes";

function mapPeriod(row: Record<string, unknown>): PayrollPeriodRow {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    periodMonth: String(row.period_month).slice(0, 7),
    status: String(row.status) as PayrollPeriodStatus,
    hoursSource: String(row.hours_source) as HoursSource,
    importedAt: row.imported_at ? String(row.imported_at) : null,
    hoursValidatedAt: row.hours_validated_at ? String(row.hours_validated_at) : null,
    computedAt: row.computed_at ? String(row.computed_at) : null,
    finalizedAt: row.finalized_at ? String(row.finalized_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPayslip(row: Record<string, unknown>): PayslipRow {
  return {
    id: String(row.id),
    payrollPeriodId: String(row.payroll_period_id),
    restaurantId: String(row.restaurant_id),
    staffMemberId: String(row.staff_member_id),
    status: String(row.status) as PayslipStatus,
    hoursImported: row.hours_imported != null ? Number(row.hours_imported) : null,
    hoursValidated: row.hours_validated != null ? Number(row.hours_validated) : null,
    hourlyGrossRate: row.hourly_gross_rate != null ? Number(row.hourly_gross_rate) : null,
    grossTotal: row.gross_total != null ? Number(row.gross_total) : null,
    netBeforeTax: row.net_before_tax != null ? Number(row.net_before_tax) : null,
    employeeContribTotal:
      row.employee_contrib_total != null ? Number(row.employee_contrib_total) : null,
    employerContribTotal:
      row.employer_contrib_total != null ? Number(row.employer_contrib_total) : null,
    employerCostTotal: row.employer_cost_total != null ? Number(row.employer_cost_total) : null,
    employeeSnapshot: (row.employee_snapshot ?? {}) as PayslipRow["employeeSnapshot"],
    employerSnapshot: (row.employer_snapshot ?? {}) as PayslipRow["employerSnapshot"],
    paySnapshot: row.pay_snapshot ? (row.pay_snapshot as PayslipRow["paySnapshot"]) : null,
    benefitsSnapshot: row.benefits_snapshot
      ? (row.benefits_snapshot as PayslipRow["benefitsSnapshot"])
      : null,
    alerts: Array.isArray(row.alerts) ? (row.alerts as PayslipRow["alerts"]) : [],
    hcrContractId: row.hcr_contract_id ? String(row.hcr_contract_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapHourLine(row: Record<string, unknown>): PayslipHourLineRow {
  return {
    id: String(row.id),
    payslipId: String(row.payslip_id),
    workShiftId: row.work_shift_id ? String(row.work_shift_id) : null,
    day: String(row.day).slice(0, 10),
    label: String(row.label),
    plannedHours: Number(row.planned_hours) || 0,
    attendanceHours: row.attendance_hours != null ? Number(row.attendance_hours) : null,
    validatedHours: Number(row.validated_hours) || 0,
    isManualOverride: Boolean(row.is_manual_override),
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapLine(row: Record<string, unknown>): PayslipLineRow {
  return {
    id: String(row.id),
    payslipId: String(row.payslip_id),
    section: row.section as PayslipLineRow["section"],
    code: String(row.code),
    label: String(row.label),
    baseAmount: row.base_amount != null ? Number(row.base_amount) : null,
    rate: row.rate != null ? Number(row.rate) : null,
    amount: Number(row.amount) || 0,
    sortOrder: Number(row.sort_order) || 0,
  };
}

export async function listPayrollPeriods(restaurantId: string): Promise<PayrollPeriodRow[]> {
  const { data, error } = await supabaseServer
    .from("payroll_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("period_month", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapPeriod(r as Record<string, unknown>));
}

export async function getPayrollPeriodByMonth(
  restaurantId: string,
  periodYm: string
): Promise<PayrollPeriodRow | null> {
  const { data, error } = await supabaseServer
    .from("payroll_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("period_month", `${periodYm}-01`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapPeriod(data as Record<string, unknown>);
}

export async function getPayrollPeriodBundle(
  restaurantId: string,
  periodId: string
): Promise<PayslipPeriodBundle | null> {
  const { data: periodData, error: periodError } = await supabaseServer
    .from("payroll_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", periodId)
    .maybeSingle();

  if (periodError) throw new Error(periodError.message);
  if (!periodData) return null;

  const { data: payslips, error: payslipError } = await supabaseServer
    .from("payslips")
    .select("*")
    .eq("payroll_period_id", periodId)
    .order("created_at", { ascending: true });

  if (payslipError) throw new Error(payslipError.message);

  const payslipRows = (payslips ?? []).map((r) => mapPayslip(r as Record<string, unknown>));
  const payslipIds = payslipRows.map((p) => p.id);

  const hourLinesByPayslip: Record<string, PayslipHourLineRow[]> = {};
  const linesByPayslip: Record<string, PayslipLineRow[]> = {};

  if (payslipIds.length > 0) {
    const [{ data: hourLines }, { data: lines }] = await Promise.all([
      supabaseServer
        .from("payslip_hour_lines")
        .select("*")
        .in("payslip_id", payslipIds)
        .order("sort_order", { ascending: true }),
      supabaseServer
        .from("payslip_lines")
        .select("*")
        .in("payslip_id", payslipIds)
        .order("sort_order", { ascending: true }),
    ]);

    for (const row of hourLines ?? []) {
      const mapped = mapHourLine(row as Record<string, unknown>);
      (hourLinesByPayslip[mapped.payslipId] ??= []).push(mapped);
    }
    for (const row of lines ?? []) {
      const mapped = mapLine(row as Record<string, unknown>);
      (linesByPayslip[mapped.payslipId] ??= []).push(mapped);
    }
  }

  return {
    period: mapPeriod(periodData as Record<string, unknown>),
    payslips: payslipRows,
    hourLinesByPayslip,
    linesByPayslip,
  };
}

export async function insertPayrollPeriod(params: {
  restaurantId: string;
  periodYm: string;
  hoursSource?: HoursSource;
}): Promise<PayrollPeriodRow> {
  const { data, error } = await supabaseServer
    .from("payroll_periods")
    .insert({
      restaurant_id: params.restaurantId,
      period_month: `${params.periodYm}-01`,
      hours_source: params.hoursSource ?? "planned",
      status: "draft",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapPeriod(data as Record<string, unknown>);
}

export async function updatePayrollPeriod(
  periodId: string,
  patch: Partial<{
    status: PayrollPeriodStatus;
    hoursSource: HoursSource;
    importedAt: string | null;
    hoursValidatedAt: string | null;
    computedAt: string | null;
    finalizedAt: string | null;
    notes: string | null;
  }>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status != null) row.status = patch.status;
  if (patch.hoursSource != null) row.hours_source = patch.hoursSource;
  if (patch.importedAt !== undefined) row.imported_at = patch.importedAt;
  if (patch.hoursValidatedAt !== undefined) row.hours_validated_at = patch.hoursValidatedAt;
  if (patch.computedAt !== undefined) row.computed_at = patch.computedAt;
  if (patch.finalizedAt !== undefined) row.finalized_at = patch.finalizedAt;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const { error } = await supabaseServer.from("payroll_periods").update(row).eq("id", periodId);
  if (error) throw new Error(error.message);
}

export async function deletePayslipsForPeriod(periodId: string): Promise<void> {
  const { error } = await supabaseServer.from("payslips").delete().eq("payroll_period_id", periodId);
  if (error) throw new Error(error.message);
}

export async function insertPayslip(row: Record<string, unknown>): Promise<PayslipRow> {
  const { data, error } = await supabaseServer.from("payslips").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return mapPayslip(data as Record<string, unknown>);
}

export async function updatePayslip(payslipId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseServer.from("payslips").update(patch).eq("id", payslipId);
  if (error) throw new Error(error.message);
}

export async function replacePayslipHourLines(
  payslipId: string,
  lines: Omit<PayslipHourLineRow, "id" | "payslipId">[]
): Promise<void> {
  const { error: delError } = await supabaseServer
    .from("payslip_hour_lines")
    .delete()
    .eq("payslip_id", payslipId);
  if (delError) throw new Error(delError.message);
  if (lines.length === 0) return;

  const { error } = await supabaseServer.from("payslip_hour_lines").insert(
    lines.map((l) => ({
      payslip_id: payslipId,
      work_shift_id: l.workShiftId,
      day: l.day,
      label: l.label,
      planned_hours: l.plannedHours,
      attendance_hours: l.attendanceHours,
      validated_hours: l.validatedHours,
      is_manual_override: l.isManualOverride,
      sort_order: l.sortOrder,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function replacePayslipLines(
  payslipId: string,
  lines: Omit<PayslipLineRow, "id" | "payslipId">[]
): Promise<void> {
  const { error: delError } = await supabaseServer.from("payslip_lines").delete().eq("payslip_id", payslipId);
  if (delError) throw new Error(delError.message);
  if (lines.length === 0) return;

  const { error } = await supabaseServer.from("payslip_lines").insert(
    lines.map((l) => ({
      payslip_id: payslipId,
      section: l.section,
      code: l.code,
      label: l.label,
      base_amount: l.baseAmount,
      rate: l.rate,
      amount: l.amount,
      sort_order: l.sortOrder,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function loadPayrollEmployerPct(restaurantId: string): Promise<number> {
  const { data } = await supabaseServer
    .from("restaurants")
    .select("payroll_employer_pct")
    .eq("id", restaurantId)
    .maybeSingle();
  const pct = (data as { payroll_employer_pct?: unknown } | null)?.payroll_employer_pct;
  return pct != null && Number.isFinite(Number(pct)) ? Number(pct) : 42;
}

export async function loadPayrollEngineSettings(restaurantId: string): Promise<{
  payrollEmployerPct: number;
  atmpRatePct: number;
  apeCode: string | null;
}> {
  const { data } = await supabaseServer
    .from("restaurants")
    .select("payroll_employer_pct, payroll_atmp_rate, ape_code")
    .eq("id", restaurantId)
    .maybeSingle();

  const row = data as {
    payroll_employer_pct?: unknown;
    payroll_atmp_rate?: unknown;
    ape_code?: unknown;
  } | null;

  const employerPct =
    row?.payroll_employer_pct != null && Number.isFinite(Number(row.payroll_employer_pct))
      ? Number(row.payroll_employer_pct)
      : 42;
  const atmp =
    row?.payroll_atmp_rate != null && Number.isFinite(Number(row.payroll_atmp_rate))
      ? Number(row.payroll_atmp_rate)
      : 2.3;

  return {
    payrollEmployerPct: employerPct,
    atmpRatePct: atmp,
    apeCode: row?.ape_code ? String(row.ape_code).trim() : null,
  };
}

export async function countActiveStaff(restaurantId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from("staff_members")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("active", true);

  if (error) throw new Error(error.message);
  return Math.max(1, count ?? 1);
}

export async function insertPayrollDsnExport(params: {
  payrollPeriodId: string;
  restaurantId: string;
  periodMonth: string;
  mode: "test" | "real";
  payslipCount: number;
  lineCount: number;
  totalGross: number;
  totalEmployerContrib: number;
  warnings: string[];
  generatedBy: string | null;
}): Promise<void> {
  const { error } = await supabaseServer.from("payroll_dsn_exports").insert({
    payroll_period_id: params.payrollPeriodId,
    restaurant_id: params.restaurantId,
    period_month: `${params.periodMonth}-01`,
    norm_version: "P26V01",
    file_mode: params.mode,
    payslip_count: params.payslipCount,
    line_count: params.lineCount,
    total_gross: params.totalGross,
    total_employer_contrib: params.totalEmployerContrib,
    warnings: params.warnings,
    generated_by: params.generatedBy,
  });
  if (error) throw new Error(error.message);
}

export async function loadStaffPasRates(
  restaurantId: string,
  staffIds: string[]
): Promise<Map<string, number | null>> {
  if (staffIds.length === 0) return new Map();

  const { data, error } = await supabaseServer
    .from("staff_members")
    .select("id, withholding_tax_rate_pct")
    .eq("restaurant_id", restaurantId)
    .in("id", staffIds);

  if (error) throw new Error(error.message);

  return new Map(
    (data ?? []).map((r) => {
      const row = r as { id: string; withholding_tax_rate_pct: unknown };
      const rate =
        row.withholding_tax_rate_pct != null && Number.isFinite(Number(row.withholding_tax_rate_pct))
          ? Number(row.withholding_tax_rate_pct)
          : null;
      return [String(row.id), rate];
    })
  );
}
