"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Clock } from "lucide-react";
import type { ContractHoursReport, ContractHoursReportRow } from "@/lib/rh/contractHoursReport";
import { recentMonths } from "@/lib/rh/payslipMonth";
import {
  uiBadgeEmerald,
  uiBadgeRose,
  uiBadgeSlate,
  uiCard,
  uiInfoBanner,
  uiLead,
  uiMuted,
  uiSectionTitleSm,
  uiWarn,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  report: ContractHoursReport;
};

function fmtH(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function fmtDelta(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function deltaClass(n: number | null | undefined, threshold = 0.05): string {
  if (n == null || !Number.isFinite(n)) return "text-stone-500";
  if (n > threshold) return "font-semibold text-rose-700";
  if (n < -threshold) return "font-semibold text-emerald-700";
  return "text-stone-700";
}

function lifecycleBadge(row: ContractHoursReportRow) {
  if (row.missingContractDates) {
    return <span className={uiBadgeRose}>Dates manquantes</span>;
  }
  if (row.lifecycle === "active") return <span className={uiBadgeEmerald}>En cours</span>;
  if (row.lifecycle === "upcoming") return <span className={uiBadgeSlate}>À venir</span>;
  if (row.lifecycle === "ended") return <span className={uiBadgeSlate}>Terminé</span>;
  return null;
}

function ReportRow({
  row,
  expanded,
  onToggle,
}: {
  row: ContractHoursReportRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-stone-100 hover:bg-stone-50/60">
        <td className="px-2 py-2 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-left text-sm font-medium text-stone-900"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            )}
            {row.staffDisplayName}
          </button>
          {row.contractId ? (
            <Link
              href={`/pilotage/rh/contrats/${row.contractId}`}
              className="mt-0.5 block text-[10px] font-medium text-copper-700 hover:underline"
            >
              Voir contrat
            </Link>
          ) : null}
        </td>
        <td className="px-2 py-2 align-top text-xs text-stone-700">
          <p>{row.contractKind}</p>
          {lifecycleBadge(row)}
        </td>
        <td className="px-2 py-2 align-top text-xs text-stone-600">
          {row.contractStart ? (
            <span>
              {row.contractStart}
              {row.contractEnd ? ` → ${row.contractEnd}` : " → …"}
            </span>
          ) : (
            <span className={uiWarn}>Non renseigné</span>
          )}
        </td>
        <td className="px-2 py-2 align-top text-right text-xs tabular-nums text-stone-700">
          {fmtH(row.weeklyContractHours)}
        </td>
        <td className="px-2 py-2 align-top text-right text-xs tabular-nums text-stone-600">
          {fmtH(row.monthExpectedHours)}
        </td>
        <td className="px-2 py-2 align-top text-right text-xs tabular-nums text-stone-900">
          {fmtH(row.monthPlannedHours)}
        </td>
        <td className="px-2 py-2 align-top text-right text-xs tabular-nums text-stone-700">
          {fmtH(row.monthAttendanceHours)}
        </td>
        <td className={`px-2 py-2 align-top text-right text-xs tabular-nums ${deltaClass(row.monthDeltaPlanned)}`}>
          {fmtDelta(row.monthDeltaPlanned)}
          {row.monthOvertimePlanned ? (
            <span className="mt-0.5 block text-[10px] text-rose-600">Heures sup.</span>
          ) : null}
        </td>
        <td className={`px-2 py-2 align-top text-right text-xs tabular-nums ${deltaClass(row.cumulativeDeltaPlanned)}`}>
          {row.cumulativeFrom ? fmtDelta(row.cumulativeDeltaPlanned) : "—"}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-stone-100 bg-stone-50/50">
          <td colSpan={9} className="px-3 py-3">
            <div className="space-y-3">
              {row.missingContractDates ? (
                <p className={`flex items-start gap-2 text-xs ${uiWarn}`}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Renseignez les dates de début et fin dans le contrat HCR pour un suivi CDD fiable.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Mois (prévu)</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">
                    {fmtH(row.monthPlannedHours)} / {fmtH(row.monthExpectedHours)}
                  </p>
                  <p className={`text-xs ${deltaClass(row.monthDeltaPlanned)}`}>
                    Écart {fmtDelta(row.monthDeltaPlanned)}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Mois (pointé)</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">
                    {fmtH(row.monthAttendanceHours)} / {fmtH(row.monthExpectedHours)}
                  </p>
                  <p className={`text-xs ${deltaClass(row.monthDeltaAttendance)}`}>
                    Écart {fmtDelta(row.monthDeltaAttendance)}
                  </p>
                </div>
                {row.cumulativeFrom ? (
                  <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                      Cumul contrat ({row.cumulativeFrom} → {row.cumulativeTo})
                    </p>
                    <p className="mt-1 text-sm font-semibold text-stone-900">
                      {fmtH(row.cumulativePlannedHours)} / {fmtH(row.cumulativeExpectedHours)}
                    </p>
                    <p className={`text-xs ${deltaClass(row.cumulativeDeltaPlanned)}`}>
                      Écart {fmtDelta(row.cumulativeDeltaPlanned)}
                      {row.cumulativeOvertimePlanned ? " · heures sup." : ""}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Période mois</p>
                  <p className="mt-1 text-sm text-stone-800">
                    {row.monthFrom} → {row.monthTo}
                  </p>
                  {row.incompleteAttendanceCount > 0 ? (
                    <p className={`mt-1 text-xs ${uiWarn}`}>
                      {row.incompleteAttendanceCount} pointage(s) incomplet(s)
                    </p>
                  ) : null}
                </div>
              </div>

              {row.weeks.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-stone-700">Détail hebdomadaire (mois)</p>
                  <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-stone-100 bg-stone-50 text-left text-[10px] uppercase tracking-wide text-stone-500">
                          <th className="px-2 py-1.5">Semaine</th>
                          <th className="px-2 py-1.5 text-right">Attendu</th>
                          <th className="px-2 py-1.5 text-right">Prévu</th>
                          <th className="px-2 py-1.5 text-right">Pointé</th>
                          <th className="px-2 py-1.5 text-right">Δ prévu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.weeks.map((w) => (
                          <tr key={w.weekStart} className="border-b border-stone-50">
                            <td className="px-2 py-1.5 text-stone-700">
                              {w.weekStart} → {w.weekEnd}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmtH(w.expectedHours)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmtH(w.plannedHours)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmtH(w.attendanceHours)}</td>
                            <td className={`px-2 py-1.5 text-right tabular-nums ${deltaClass(w.deltaPlanned)}`}>
                              {fmtDelta(w.deltaPlanned)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function ContractHoursReportClient({ report }: Props) {
  const router = useRouter();
  const monthOptions = useMemo(() => recentMonths(18), []);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const overtimeCount = report.rows.filter((r) => r.monthOvertimePlanned).length;
  const missingDatesCount = report.rows.filter((r) => r.missingContractDates).length;

  return (
    <div className="space-y-4">
      <div className={`${uiCard} flex flex-wrap items-end gap-3`}>
        <div>
          <label htmlFor="period-ym" className="mb-1 block text-xs font-medium text-stone-600">
            Mois analysé
          </label>
          <select
            id="period-ym"
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
            value={report.periodYm}
            onChange={(e) => {
              router.push(`/pilotage/rh/contrats/suivi-heures?month=${e.target.value}`);
            }}
          >
            {monthOptions.map((ym) => (
              <option key={ym} value={ym}>
                {ym}
              </option>
            ))}
          </select>
        </div>
        <p className={`text-xs ${uiMuted}`}>
          Période : <strong className="text-stone-800">{report.periodLabel}</strong>
        </p>
      </div>

      <div className={uiInfoBanner}>
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-stone-900">Contrat vs planning</p>
          <p className={`mt-0.5 ${uiLead}`}>
            Les heures <strong>attendues</strong> sont calculées au prorata du contrat (h/sem × semaines
            couvertes). Les heures <strong>prévues</strong> viennent du planning (pauses déduites). Les heures{" "}
            <strong>pointées</strong> utilisent les badges entrée/sortie. Un écart positif indique un dépassement
            par rapport au contrat (heures supplémentaires potentielles).
          </p>
        </div>
      </div>

      {missingDatesCount > 0 ? (
        <p className={`flex items-start gap-2 text-sm ${uiWarn}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {missingDatesCount} collaborateur(s) CDD sans dates dans le contrat HCR — le cumul contrat est
          indisponible.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Collaborateurs suivis</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{report.rows.length}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Dépassements ce mois</p>
          <p className="mt-1 text-2xl font-semibold text-rose-800">{overtimeCount}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Contrats sans dates</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">{missingDatesCount}</p>
        </div>
      </div>

      <section>
        <h2 className={uiSectionTitleSm}>Rapport {report.periodLabel}</h2>
        {report.rows.length === 0 ? (
          <div className={`${uiCard} mt-3 text-sm ${uiLead}`}>
            Aucun collaborateur avec volume horaire contractuel. Liez un contrat HCR ou renseignez les h/sem
            dans la fiche équipe.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-[960px] w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                  <th className="px-2 py-2">Collaborateur</th>
                  <th className="px-2 py-2">Contrat</th>
                  <th className="px-2 py-2">Début → fin</th>
                  <th className="px-2 py-2 text-right">h/sem</th>
                  <th className="px-2 py-2 text-right">Attendu mois</th>
                  <th className="px-2 py-2 text-right">Prévu</th>
                  <th className="px-2 py-2 text-right">Pointé</th>
                  <th className="px-2 py-2 text-right">Δ mois</th>
                  <th className="px-2 py-2 text-right">Δ cumul</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <ReportRow
                    key={row.staffMemberId}
                    row={row}
                    expanded={expandedId === row.staffMemberId}
                    onToggle={() =>
                      setExpandedId((id) => (id === row.staffMemberId ? null : row.staffMemberId))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
