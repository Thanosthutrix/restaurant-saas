"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { aggregateMonthlyHours } from "@/lib/staff/aggregateMonthlyHours";
import { listWorkShiftsInRange } from "@/lib/staff/staffDb";
import { getEmployerProfile } from "@/lib/rh/employerProfile";
import { employerProfileToPayslipSnapshot } from "@/lib/rh/payslipTypes";
import { listHcrContracts } from "@/lib/hcr-contracts/hcrContractsDb";
import {
  allocateBenefitsPerEmployee,
  loadRhBenefitsFromAdministratif,
} from "@/lib/rh/payslipBenefits";
import { buildPaidLeaveSnapshot, nextBalanceAfterMonth } from "@/lib/rh/paidLeave";
import { buildMonthlyDsn, type DsnBuildMode } from "@/lib/rh/dsn/buildMonthlyDsn";
import { computePayslipAmounts } from "@/lib/rh/payslipCompute";
import { monthRangeIso, monthlyContractHours } from "@/lib/rh/payslipMonth";
import type { HoursSource, PayslipEmployeeSnapshot } from "@/lib/rh/payslipTypes";
import {
  countActiveStaff,
  deletePayslipsForPeriod,
  getPayrollPeriodByMonth,
  getPayrollPeriodBundle,
  insertPayrollPeriod,
  insertPayslip,
  insertPayrollDsnExport,
  loadPayrollEngineSettings,
  loadStaffPasRates,
  replacePayslipHourLines,
  replacePayslipLines,
  updatePayrollPeriod,
  updatePayslip,
} from "@/lib/rh/payslipsDb";

export type PaieActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const PAIE_PATH = "/pilotage/rh/paie";

async function gateOwner(restaurantId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const { data } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!data || (data as { owner_id: string }).owner_id !== user.id) {
    return { ok: false, error: "Réservé au propriétaire de l'établissement." };
  }
  return { ok: true };
}

function revalidatePaie(month?: string) {
  revalidatePath(PAIE_PATH);
  if (month) revalidatePath(`${PAIE_PATH}/${month}`);
}

function ymValid(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

async function findStaffContract(restaurantId: string, staffMemberId: string) {
  const contracts = await listHcrContracts(restaurantId);
  return contracts.find((c) => c.staffMemberId === staffMemberId) ?? null;
}

async function loadStaffMap(restaurantId: string) {
  const { data, error } = await supabaseServer
    .from("staff_members")
    .select("id, display_name, role_label, contract_type, target_weekly_hours, hourly_gross_rate, active, paid_leave_balance_days")
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return [
        String(row.id),
        {
          displayName: String(row.display_name ?? ""),
          roleLabel: row.role_label ? String(row.role_label) : null,
          contractType: row.contract_type ? String(row.contract_type) : null,
          targetWeeklyHours:
            row.target_weekly_hours != null ? Number(row.target_weekly_hours) : null,
          hourlyGrossRate:
            row.hourly_gross_rate != null ? Number(row.hourly_gross_rate) : null,
          active: Boolean(row.active),
          paidLeaveBalanceDays:
            row.paid_leave_balance_days != null ? Number(row.paid_leave_balance_days) : 0,
        },
      ];
    })
  );
}

function buildEmployeeSnapshot(
  staff: {
    displayName: string;
    roleLabel: string | null;
    contractType: string | null;
    targetWeeklyHours: number | null;
    paidLeaveBalanceDays: number;
  },
  staffMemberId: string,
  contract: Awaited<ReturnType<typeof findStaffContract>>
): PayslipEmployeeSnapshot {
  const weekly = contract?.draft.jobAndPay.weeklyHours ?? staff.targetWeeklyHours;
  return {
    staffMemberId,
    displayName: staff.displayName,
    roleLabel: staff.roleLabel,
    contractType: staff.contractType,
    socialSecurityNumber: contract?.draft.employee.socialSecurityNumber?.trim() || null,
    firstName: contract?.draft.employee.firstName ?? null,
    lastName: contract?.draft.employee.lastName ?? null,
    jobTitle: contract?.draft.jobAndPay.jobTitle ?? staff.roleLabel,
    targetWeeklyHours: weekly ?? null,
    monthlyContractHours: monthlyContractHours(weekly),
    paidLeave: buildPaidLeaveSnapshot({ balanceDays: staff.paidLeaveBalanceDays }),
  };
}

export async function createPayrollPeriodAction(params: {
  restaurantId: string;
  periodYm: string;
  hoursSource?: HoursSource;
}): Promise<PaieActionResult<{ periodId: string }>> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;
  if (!ymValid(params.periodYm)) return { ok: false, error: "Mois invalide (format AAAA-MM)." };

  const existing = await getPayrollPeriodByMonth(params.restaurantId, params.periodYm);
  if (existing) return { ok: false, error: "Une période existe déjà pour ce mois." };

  const profile = await getEmployerProfile(params.restaurantId);
  if (!profile?.siret?.trim()) {
    return {
      ok: false,
      error: "Complétez le SIRET dans Administratif avant de créer une période de paie.",
    };
  }

  try {
    const period = await insertPayrollPeriod({
      restaurantId: params.restaurantId,
      periodYm: params.periodYm,
      hoursSource: params.hoursSource,
    });
    revalidatePaie(params.periodYm);
    return { ok: true, data: { periodId: period.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Création impossible." };
  }
}

export async function importHoursFromPlanningAction(params: {
  restaurantId: string;
  periodId: string;
  hoursSource: HoursSource;
}): Promise<PaieActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const bundle = await getPayrollPeriodBundle(params.restaurantId, params.periodId);
  if (!bundle) return { ok: false, error: "Période introuvable." };
  if (bundle.period.status === "finalized") {
    return { ok: false, error: "Période finalisée — modification impossible." };
  }

  const profile = await getEmployerProfile(params.restaurantId);
  if (!profile) return { ok: false, error: "Profil employeur manquant." };

  const { rangeStartIso, rangeEndExclusiveIso } = monthRangeIso(bundle.period.periodMonth);
  const shifts = await listWorkShiftsInRange(
    params.restaurantId,
    rangeStartIso,
    rangeEndExclusiveIso
  );
  const aggregates = aggregateMonthlyHours(shifts, bundle.period.periodMonth, params.hoursSource);

  if (aggregates.length === 0) {
    return {
      ok: false,
      error: "Aucun shift planifié sur ce mois — vérifiez l'emploi du temps.",
    };
  }

  const staffMap = await loadStaffMap(params.restaurantId);
  const engineSettings = await loadPayrollEngineSettings(params.restaurantId);
  const employerSnapshot = employerProfileToPayslipSnapshot(profile, {
    atmpRatePct: engineSettings.atmpRatePct,
    apeCode: engineSettings.apeCode,
  });
  const rhBreakdown = await loadRhBenefitsFromAdministratif(params.restaurantId);

  try {
    await deletePayslipsForPeriod(params.periodId);

    for (const agg of aggregates) {
      const staff = staffMap.get(agg.staffMemberId);
      if (!staff) continue;

      const contract = await findStaffContract(params.restaurantId, agg.staffMemberId);
      const mutuelleShare = Math.max(contract?.draft.clauses.mutuelleEmployerShare ?? 50, 50);
      const perEmployeeBenefits = allocateBenefitsPerEmployee({
        breakdown: rhBreakdown,
        activeEmployeeCount: aggregates.length,
        mutuelleEmployerSharePct: mutuelleShare,
      });

      const hourlyRate = staff.hourlyGrossRate ?? contract?.draft.jobAndPay.hourlyRateGross ?? null;

      const alerts: { code: string; level: "error" | "warning" | "info"; message: string }[] = [];
      if (hourlyRate == null || hourlyRate <= 0) {
        alerts.push({
          code: "missing_rate",
          level: "error",
          message: "Taux horaire brut manquant (Équipe ou contrat HCR).",
        });
      }
      if (params.hoursSource === "attendance" && agg.incompleteAttendanceCount > 0) {
        alerts.push({
          code: "incomplete_attendance",
          level: "warning",
          message: `${agg.incompleteAttendanceCount} pointage(s) incomplet(s) — heures prévues utilisées en secours.`,
        });
      }
      if (!contract?.draft.employee.socialSecurityNumber?.trim()) {
        alerts.push({
          code: "missing_ssn",
          level: "warning",
          message: "N° de sécurité sociale absent du contrat HCR lié.",
        });
      }

      const payslip = await insertPayslip({
        payroll_period_id: params.periodId,
        restaurant_id: params.restaurantId,
        staff_member_id: agg.staffMemberId,
        status: "draft",
        hours_imported: agg.totalSourceHours,
        hours_validated: null,
        hourly_gross_rate: hourlyRate,
        employee_snapshot: buildEmployeeSnapshot(staff, agg.staffMemberId, contract),
        employer_snapshot: employerSnapshot,
        benefits_snapshot: perEmployeeBenefits,
        alerts,
        hcr_contract_id: contract?.id ?? null,
      });

      await replacePayslipHourLines(
        payslip.id,
        agg.shifts.map((s, i) => ({
          workShiftId: s.workShiftId,
          day: s.day,
          label: s.label,
          plannedHours: s.plannedHours,
          attendanceHours: s.attendanceHours,
          validatedHours: s.sourceHours,
          isManualOverride: false,
          sortOrder: i,
        }))
      );
    }

    await updatePayrollPeriod(params.periodId, {
      status: "imported",
      hoursSource: params.hoursSource,
      importedAt: new Date().toISOString(),
      hoursValidatedAt: null,
      computedAt: null,
    });

    revalidatePaie(bundle.period.periodMonth);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import impossible." };
  }
}

export async function updatePayslipValidatedHoursAction(params: {
  restaurantId: string;
  payslipId: string;
  validatedHours: number;
}): Promise<PaieActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  if (!Number.isFinite(params.validatedHours) || params.validatedHours < 0) {
    return { ok: false, error: "Heures invalides." };
  }

  const { data: payslip, error } = await supabaseServer
    .from("payslips")
    .select("id, payroll_period_id, restaurant_id")
    .eq("id", params.payslipId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (error || !payslip) return { ok: false, error: "Fiche introuvable." };

  const { data: period } = await supabaseServer
    .from("payroll_periods")
    .select("status, period_month")
    .eq("id", (payslip as { payroll_period_id: string }).payroll_period_id)
    .maybeSingle();

  if ((period as { status: string } | null)?.status === "finalized") {
    return { ok: false, error: "Période finalisée." };
  }

  try {
    await updatePayslip(params.payslipId, {
      hours_validated: Math.round(params.validatedHours * 100) / 100,
      status: "draft",
    });
    revalidatePaie(String((period as { period_month: string }).period_month).slice(0, 7));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mise à jour impossible." };
  }
}

export async function validateAllHoursAction(params: {
  restaurantId: string;
  periodId: string;
}): Promise<PaieActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const bundle = await getPayrollPeriodBundle(params.restaurantId, params.periodId);
  if (!bundle) return { ok: false, error: "Période introuvable." };
  if (bundle.period.status === "finalized") {
    return { ok: false, error: "Période finalisée." };
  }
  if (bundle.payslips.length === 0) {
    return { ok: false, error: "Importez d'abord les heures depuis le planning." };
  }

  const blocking = bundle.payslips.filter((p) =>
    p.alerts.some((a) => a.level === "error" && (a.code === "missing_rate" || a.code === "below_smic"))
  );
  if (blocking.length > 0) {
    return {
      ok: false,
      error: `Corrigez les taux horaires pour : ${blocking.map((p) => p.employeeSnapshot.displayName).join(", ")}.`,
    };
  }

  try {
    for (const payslip of bundle.payslips) {
      const validated =
        payslip.hoursValidated != null ? payslip.hoursValidated : (payslip.hoursImported ?? 0);
      await updatePayslip(payslip.id, {
        hours_validated: validated,
        status: "hours_validated",
      });
    }
    await updatePayrollPeriod(params.periodId, {
      status: "hours_validated",
      hoursValidatedAt: new Date().toISOString(),
    });
    revalidatePaie(bundle.period.periodMonth);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Validation impossible." };
  }
}

export async function computePayslipsAction(params: {
  restaurantId: string;
  periodId: string;
}): Promise<PaieActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const bundle = await getPayrollPeriodBundle(params.restaurantId, params.periodId);
  if (!bundle) return { ok: false, error: "Période introuvable." };
  if (bundle.period.status === "finalized") {
    return { ok: false, error: "Période finalisée." };
  }
  if (bundle.period.status !== "hours_validated" && bundle.period.status !== "computed") {
    return { ok: false, error: "Validez d'abord les heures manuellement." };
  }

  const [engineSettings, staffHeadcount] = await Promise.all([
    loadPayrollEngineSettings(params.restaurantId),
    countActiveStaff(params.restaurantId),
  ]);
  const pasRates = await loadStaffPasRates(
    params.restaurantId,
    bundle.payslips.map((p) => p.staffMemberId)
  );

  try {
    for (const payslip of bundle.payslips) {
      const hours = payslip.hoursValidated ?? payslip.hoursImported ?? 0;
      const rate = payslip.hourlyGrossRate ?? 0;
      const benefits = payslip.benefitsSnapshot;

      const result = computePayslipAmounts({
        validatedHours: hours,
        hourlyGrossRate: rate,
        targetWeeklyHours: payslip.employeeSnapshot.targetWeeklyHours,
        payrollEmployerPct: engineSettings.payrollEmployerPct,
        benefits,
        staffHeadcount,
        atmpRatePct: engineSettings.atmpRatePct,
        pasRatePct: pasRates.get(payslip.staffMemberId) ?? null,
      });

      const blocking = result.alerts.filter((a) => a.level === "error");
      if (blocking.length > 0) {
        return {
          ok: false,
          error: `${payslip.employeeSnapshot.displayName} : ${blocking.map((a) => a.message).join(" ")}`,
        };
      }

      const mergedAlerts = [
        ...payslip.alerts.filter((a) => a.code !== "bilan_delta" && a.code !== "missing_pas"),
        ...result.alerts,
      ];

      await updatePayslip(payslip.id, {
        status: "computed",
        gross_total: result.paySnapshot.grossTotal,
        net_before_tax: result.paySnapshot.netBeforeTax,
        employee_contrib_total: result.paySnapshot.employeeContribTotal,
        employer_contrib_total: result.paySnapshot.employerContribTotal,
        employer_cost_total: result.paySnapshot.employerCostTotal,
        pay_snapshot: result.paySnapshot,
        alerts: mergedAlerts,
      });

      await replacePayslipLines(payslip.id, result.lines);
    }

    await updatePayrollPeriod(params.periodId, {
      status: "computed",
      computedAt: new Date().toISOString(),
    });
    revalidatePaie(bundle.period.periodMonth);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Calcul impossible." };
  }
}

export async function finalizePayrollPeriodAction(params: {
  restaurantId: string;
  periodId: string;
}): Promise<PaieActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const bundle = await getPayrollPeriodBundle(params.restaurantId, params.periodId);
  if (!bundle) return { ok: false, error: "Période introuvable." };
  if (bundle.period.status !== "computed") {
    return { ok: false, error: "Calculez d'abord les bulletins." };
  }

  const profile = await getEmployerProfile(params.restaurantId);
  if (!profile?.siret?.trim()) {
    return { ok: false, error: "SIRET employeur requis pour finaliser." };
  }

  const missingSsn = bundle.payslips.filter(
    (p) => !p.employeeSnapshot.socialSecurityNumber?.trim()
  );
  if (missingSsn.length > 0) {
    return {
      ok: false,
      error: `N° de sécurité sociale manquant (contrat HCR) : ${missingSsn.map((p) => p.employeeSnapshot.displayName).join(", ")}.`,
    };
  }

  const withErrors = bundle.payslips.filter((p) => p.alerts.some((a) => a.level === "error"));
  if (withErrors.length > 0) {
    return { ok: false, error: "Corrigez les alertes bloquantes avant de finaliser." };
  }

  try {
    for (const payslip of bundle.payslips) {
      await updatePayslip(payslip.id, { status: "finalized" });
      const leave = payslip.employeeSnapshot.paidLeave;
      if (leave) {
        const newBalance = nextBalanceAfterMonth(leave.balanceDays, leave.takenThisMonth);
        await supabaseServer
          .from("staff_members")
          .update({ paid_leave_balance_days: newBalance })
          .eq("id", payslip.staffMemberId)
          .eq("restaurant_id", params.restaurantId);
      }
    }
    await updatePayrollPeriod(params.periodId, {
      status: "finalized",
      finalizedAt: new Date().toISOString(),
    });
    revalidatePaie(bundle.period.periodMonth);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Finalisation impossible." };
  }
}

export async function exportDsnAction(params: {
  restaurantId: string;
  periodId: string;
  mode?: DsnBuildMode;
}): Promise<
  PaieActionResult<{
    filename: string;
    contentBase64: string;
    warnings: string[];
    lineCount: number;
  }>
> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const user = await getCurrentUser();
  const bundle = await getPayrollPeriodBundle(params.restaurantId, params.periodId);
  if (!bundle) return { ok: false, error: "Période introuvable." };
  if (bundle.period.status !== "finalized") {
    return { ok: false, error: "Finalisez les bulletins avant d'exporter la DSN." };
  }

  try {
    const profile = await getEmployerProfile(params.restaurantId);
    const result = buildMonthlyDsn({
      bundle,
      mode: params.mode ?? "real",
      contactName: profile?.representativeName,
      contactEmail: undefined,
    });

    await insertPayrollDsnExport({
      payrollPeriodId: params.periodId,
      restaurantId: params.restaurantId,
      periodMonth: bundle.period.periodMonth,
      mode: params.mode ?? "real",
      payslipCount: result.payslipCount,
      lineCount: result.lineCount,
      totalGross: result.totalGross,
      totalEmployerContrib: result.totalEmployerContrib,
      warnings: result.warnings,
      generatedBy: user?.id ?? null,
    });

    const contentBase64 = Buffer.from(result.content, "latin1").toString("base64");
    revalidatePaie(bundle.period.periodMonth);
    return {
      ok: true,
      data: {
        filename: result.filename,
        contentBase64,
        warnings: result.warnings,
        lineCount: result.lineCount,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export DSN impossible." };
  }
}
