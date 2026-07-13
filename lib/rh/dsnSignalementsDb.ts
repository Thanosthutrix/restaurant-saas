import { supabaseServer } from "@/lib/supabaseServer";
import type {
  DsnSignalementInput,
  DsnSignalementKind,
  DsnSignalementRow,
  DsnSignalementStatus,
} from "./dsn/dsnSignalementTypes";
import type { PayslipEmployeeSnapshot, PayslipEmployerSnapshot } from "./payslipTypes";

function mapRow(row: Record<string, unknown>): DsnSignalementRow {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    staffMemberId: String(row.staff_member_id),
    kind: String(row.kind) as DsnSignalementKind,
    status: String(row.status) as DsnSignalementStatus,
    eventDate: String(row.event_date).slice(0, 10),
    lastWorkedDay: row.last_worked_day ? String(row.last_worked_day).slice(0, 10) : null,
    expectedEndDate: row.expected_end_date ? String(row.expected_end_date).slice(0, 10) : null,
    returnDate: row.return_date ? String(row.return_date).slice(0, 10) : null,
    contractEndDate: row.contract_end_date ? String(row.contract_end_date).slice(0, 10) : null,
    motifCode: String(row.motif_code),
    subrogation: Boolean(row.subrogation),
    linkedArretId: row.linked_arret_id ? String(row.linked_arret_id) : null,
    employeeSnapshot: (row.employee_snapshot ?? {}) as PayslipEmployeeSnapshot,
    employerSnapshot: (row.employer_snapshot ?? {}) as PayslipEmployerSnapshot,
    notes: row.notes ? String(row.notes) : null,
    exportedAt: row.exported_at ? String(row.exported_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listDsnSignalements(restaurantId: string): Promise<DsnSignalementRow[]> {
  const { data, error } = await supabaseServer
    .from("payroll_dsn_signalements")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getDsnSignalement(
  restaurantId: string,
  signalementId: string
): Promise<DsnSignalementRow | null> {
  const { data, error } = await supabaseServer
    .from("payroll_dsn_signalements")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", signalementId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function insertDsnSignalement(input: DsnSignalementInput): Promise<DsnSignalementRow> {
  const { data, error } = await supabaseServer
    .from("payroll_dsn_signalements")
    .insert({
      restaurant_id: input.restaurantId,
      staff_member_id: input.staffMemberId,
      kind: input.kind,
      event_date: input.eventDate,
      last_worked_day: input.lastWorkedDay ?? null,
      expected_end_date: input.expectedEndDate ?? null,
      return_date: input.returnDate ?? null,
      contract_end_date: input.contractEndDate ?? null,
      motif_code: input.motifCode,
      subrogation: input.subrogation ?? false,
      linked_arret_id: input.linkedArretId ?? null,
      employee_snapshot: input.employeeSnapshot,
      employer_snapshot: input.employerSnapshot,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function markDsnSignalementExported(signalementId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("payroll_dsn_signalements")
    .update({ status: "exported", exported_at: new Date().toISOString() })
    .eq("id", signalementId);

  if (error) throw new Error(error.message);
}

export async function insertDsnSignalementExport(params: {
  signalementId: string;
  restaurantId: string;
  eventDate: string;
  exportKind: DsnSignalementKind;
  mode: "test" | "real";
  lineCount: number;
  warnings: string[];
  generatedBy: string | null;
}): Promise<void> {
  const { error } = await supabaseServer.from("payroll_dsn_exports").insert({
    payroll_period_id: null,
    signalement_id: params.signalementId,
    restaurant_id: params.restaurantId,
    period_month: `${params.eventDate.slice(0, 7)}-01`,
    norm_version: "P26V01",
    file_mode: params.mode,
    export_kind: params.exportKind,
    payslip_count: 1,
    line_count: params.lineCount,
    total_gross: 0,
    total_employer_contrib: 0,
    warnings: params.warnings,
    generated_by: params.generatedBy,
  });
  if (error) throw new Error(error.message);
}
