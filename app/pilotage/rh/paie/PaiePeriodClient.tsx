"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, Download, FileOutput, RefreshCw } from "lucide-react";
import {
  uiBadgeEmerald,
  uiBadgeRose,
  uiBadgeSlate,
  uiBtnPrimary,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInfoBanner,
  uiInput,
  uiMuted,
  uiSectionTitleSm,
  uiWarn,
} from "@/components/ui/premium";
import { PMSS_2026 } from "@/lib/rh/payrollEngine/constants2026";
import { buildPayslipPrintDocument, openPayslipPrintWindow } from "@/lib/rh/payslipDocument";
import { formatPeriodMonthLabel } from "@/lib/rh/payslipMonth";
import {
  PAYSLIP_LEGAL_NOTICE,
  PERIOD_STATUS_LABELS,
  type HoursSource,
  type PayslipPeriodBundle,
} from "@/lib/rh/payslipTypes";
import {
  computePayslipsAction,
  exportDsnAction,
  finalizePayrollPeriodAction,
  importHoursFromPlanningAction,
  updatePayslipValidatedHoursAction,
  validateAllHoursAction,
} from "./actions";

type Props = {
  restaurantId: string;
  bundle: PayslipPeriodBundle;
  payrollEmployerPct: number;
};

function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function PaiePeriodClient({ restaurantId, bundle, payrollEmployerPct }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dsnWarnings, setDsnWarnings] = useState<string[]>([]);
  const [hoursSource, setHoursSource] = useState<HoursSource>(bundle.period.hoursSource);
  const [selectedId, setSelectedId] = useState<string | null>(bundle.payslips[0]?.id ?? null);
  const [hourEdits, setHourEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      bundle.payslips.map((p) => [
        p.id,
        String(p.hoursValidated ?? p.hoursImported ?? 0),
      ])
    )
  );

  const isFinalized = bundle.period.status === "finalized";
  const selected = bundle.payslips.find((p) => p.id === selectedId) ?? null;

  const totals = useMemo(() => {
    let gross = 0;
    let net = 0;
    let employer = 0;
    for (const p of bundle.payslips) {
      gross += p.grossTotal ?? 0;
      net += p.netBeforeTax ?? 0;
      employer += p.employerCostTotal ?? 0;
    }
    return { gross, net, employer };
  }, [bundle.payslips]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      setSuccess(successMsg);
      router.refresh();
    });
  }

  function handleImport() {
    run(
      () =>
        importHoursFromPlanningAction({
          restaurantId,
          periodId: bundle.period.id,
          hoursSource,
        }),
      "Heures importées depuis le planning."
    );
  }

  function handleValidateAll() {
    run(
      () => validateAllHoursAction({ restaurantId, periodId: bundle.period.id }),
      "Heures validées pour tous les salariés."
    );
  }

  function handleCompute() {
    run(
      () => computePayslipsAction({ restaurantId, periodId: bundle.period.id }),
      "Bulletins calculés."
    );
  }

  function handleExportDsn(mode: "test" | "real") {
    setError(null);
    setSuccess(null);
    setDsnWarnings([]);
    startTransition(async () => {
      const res = await exportDsnAction({
        restaurantId,
        periodId: bundle.period.id,
        mode,
      });
      if (!res.ok) {
        setError(res.error ?? "Export impossible");
        return;
      }
      if (!res.data) {
        setError("Export impossible");
        return;
      }
      const bytes = Uint8Array.from(atob(res.data.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "text/plain;charset=iso-8859-1" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setDsnWarnings(res.data.warnings);
      setSuccess(`DSN exportée (${res.data.lineCount} lignes, norme P26V01).`);
    });
  }

  function handleFinalize() {
    run(
      () => finalizePayrollPeriodAction({ restaurantId, periodId: bundle.period.id }),
      "Période finalisée — bulletins verrouillés."
    );
  }

  function handleSaveHours(payslipId: string) {
    const raw = hourEdits[payslipId];
    const hours = Number(raw.replace(",", "."));
    run(
      () =>
        updatePayslipValidatedHoursAction({
          restaurantId,
          payslipId,
          validatedHours: hours,
        }),
      "Heures enregistrées."
    );
  }

  function handlePrint(payslipId: string) {
    const payslip = bundle.payslips.find((p) => p.id === payslipId);
    if (!payslip || payslip.status !== "computed" && payslip.status !== "finalized") return;
    const doc = buildPayslipPrintDocument(bundle, payslip);
    openPayslipPrintWindow(doc.html, doc.title);
  }

  const workflowStep = (() => {
    switch (bundle.period.status) {
      case "draft":
        return 0;
      case "imported":
        return 1;
      case "hours_validated":
        return 2;
      case "computed":
        return 3;
      case "finalized":
        return 4;
      default:
        return 0;
    }
  })();

  return (
    <div className="space-y-4">
      <div className={uiInfoBanner}>
        <strong>Bulletins de paie employeur</strong> — Barème cotisations France métropolitaine au
        01/01/2026 (PMSS {PMSS_2026.toLocaleString("fr-FR")} €). Heures importées du planning,
        validation manuelle obligatoire. Mutuelle liée à Administratif. Renseignez le taux PAS de
        chaque salarié dans Équipe.
      </div>

      <div className={`${uiCard} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className={uiSectionTitleSm}>{formatPeriodMonthLabel(bundle.period.periodMonth)}</p>
          <p className={uiMuted}>
            Statut : {PERIOD_STATUS_LABELS[bundle.period.status]}
            {bundle.period.importedAt &&
              ` · import ${new Date(bundle.period.importedAt).toLocaleDateString("fr-FR")}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-2 w-8 rounded-full ${workflowStep >= step ? "bg-copper-600" : "bg-stone-200"}`}
              aria-hidden
            />
          ))}
        </div>
      </div>

      {!isFinalized && (
        <div className={`${uiCard} space-y-3`}>
          <p className={uiSectionTitleSm}>Étape 1 — Importer les heures</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={hoursSource === "planned" ? uiBtnPrimary : uiBtnSecondary}
              onClick={() => setHoursSource("planned")}
              disabled={pending}
            >
              Planning (pauses déduites)
            </button>
            <button
              type="button"
              className={hoursSource === "attendance" ? uiBtnPrimary : uiBtnSecondary}
              onClick={() => setHoursSource("attendance")}
              disabled={pending}
            >
              Pointage réel
            </button>
            <button
              type="button"
              className={`${uiBtnSecondary} inline-flex items-center gap-2`}
              onClick={handleImport}
              disabled={pending}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Importer depuis l&apos;emploi du temps
            </button>
          </div>
          <p className={uiMuted}>
            Les heures proviennent des shifts du mois. Avec le pointage, les entrées/sorties
            incomplètes repassent sur le planning prévu.
          </p>
        </div>
      )}

      {error && <div className={uiError}>{error}</div>}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </div>
      )}

      {bundle.payslips.length === 0 ? (
        <div className={uiCard}>
          <p className="text-sm text-stone-600">
            Aucune fiche — importez les heures depuis le planning pour ce mois.
          </p>
        </div>
      ) : (
        <>
          {!isFinalized && bundle.period.status !== "draft" && (
            <div className={`${uiCard} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className={uiSectionTitleSm}>Étape 2 — Valider les heures</p>
                <p className={uiMuted}>
                  Vérifiez chaque total avant de lancer le calcul des bulletins.
                </p>
              </div>
              <button
                type="button"
                className={`${uiBtnPrimary} inline-flex items-center gap-2`}
                onClick={handleValidateAll}
                disabled={pending || bundle.period.status === "hours_validated"}
              >
                <Check className="h-4 w-4" aria-hidden />
                Valider toutes les heures
              </button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-2">
              {bundle.payslips.map((p) => {
                const hasError = p.alerts.some((a) => a.level === "error");
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedId === p.id
                        ? "border-copper-300 bg-copper-50/50 shadow-sm"
                        : "border-stone-200/70 bg-white hover:border-copper-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-stone-900">{p.employeeSnapshot.displayName}</p>
                        <p className={uiMuted}>
                          {p.hoursImported?.toFixed(2) ?? "—"} h importées
                          {p.netBeforeTax != null && ` · net ${eur(p.netBeforeTax)}`}
                        </p>
                      </div>
                      {hasError ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                      ) : p.status === "finalized" ? (
                        <span className={uiBadgeEmerald}>OK</span>
                      ) : (
                        <span className={uiBadgeSlate}>{p.status}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className={`${uiCard} space-y-4 lg:col-span-3`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className={uiSectionTitleSm}>{selected.employeeSnapshot.displayName}</p>
                    <p className={uiMuted}>
                      {selected.employeeSnapshot.jobTitle ?? "—"} · taux {eur(selected.hourlyGrossRate)}/h
                    </p>
                  </div>
                  {(selected.status === "computed" || selected.status === "finalized") && (
                    <button
                      type="button"
                      className={`${uiBtnSecondary} inline-flex items-center gap-2`}
                      onClick={() => handlePrint(selected.id)}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Imprimer
                    </button>
                  )}
                </div>

                {selected.alerts.length > 0 && (
                  <div className="space-y-1">
                    {selected.alerts.map((a) => (
                      <div
                        key={`${a.code}-${a.message}`}
                        className={a.level === "error" ? uiError : a.level === "warning" ? uiWarn : uiInfoBanner}
                      >
                        {a.message}
                      </div>
                    ))}
                  </div>
                )}

                {!isFinalized && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className={uiMuted}>Heures validées (mois)</label>
                      <input
                        className={`${uiInput} mt-1 w-32`}
                        value={hourEdits[selected.id] ?? ""}
                        onChange={(e) =>
                          setHourEdits((prev) => ({ ...prev, [selected.id]: e.target.value }))
                        }
                        disabled={pending}
                      />
                    </div>
                    <button
                      type="button"
                      className={uiBtnSecondary}
                      onClick={() => handleSaveHours(selected.id)}
                      disabled={pending}
                    >
                      Enregistrer
                    </button>
                  </div>
                )}

                {selected.employeeSnapshot.paidLeave && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs text-sky-900">
                    <strong>Congés payés</strong> — acquis{" "}
                    {selected.employeeSnapshot.paidLeave.acquiredThisMonth.toFixed(2)} j · pris{" "}
                    {selected.employeeSnapshot.paidLeave.takenThisMonth.toFixed(2)} j · solde{" "}
                    {selected.employeeSnapshot.paidLeave.balanceDays.toFixed(2)} j
                  </div>
                )}

                {selected.benefitsSnapshot && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-xs text-rose-900">
                    <strong>Mutuelle (Administratif)</strong> — {selected.benefitsSnapshot.sourceNote}
                    <br />
                    Part employeur {selected.benefitsSnapshot.mutuellePerEmployeeEmployer.toFixed(2)} €
                    · part salarié {selected.benefitsSnapshot.mutuellePerEmployeeEmployee.toFixed(2)} €
                    ({selected.benefitsSnapshot.mutuelleEmployerSharePct} % employeur)
                  </div>
                )}

                <div>
                  <p className={`${uiSectionTitleSm} mb-2`}>Détail des shifts</p>
                  <div className="overflow-x-auto rounded-xl border border-stone-200/70">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 text-stone-500">
                        <tr>
                          <th className="px-2 py-2">Date</th>
                          <th className="px-2 py-2">Shift</th>
                          <th className="px-2 py-2 text-right">Prévu</th>
                          <th className="px-2 py-2 text-right">Pointé</th>
                          <th className="px-2 py-2 text-right">Validé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bundle.hourLinesByPayslip[selected.id] ?? []).map((h) => (
                          <tr key={h.id} className="border-t border-stone-100">
                            <td className="px-2 py-1.5">{h.day}</td>
                            <td className="px-2 py-1.5">{h.label}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{h.plannedHours.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {h.attendanceHours != null ? h.attendanceHours.toFixed(2) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                              {h.validatedHours.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selected.paySnapshot && (
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className={uiMuted}>Brut</p>
                      <p className="font-semibold">{eur(selected.paySnapshot.grossTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className={uiMuted}>Net avant impôt</p>
                      <p className="font-semibold">{eur(selected.paySnapshot.netBeforeTax)}</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className={uiMuted}>Coût employeur</p>
                      <p className="font-semibold">{eur(selected.paySnapshot.employerCostTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className={uiMuted}>Net à payer</p>
                      <p className="font-semibold">{eur(selected.paySnapshot.netPayable)}</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className={uiMuted}>PAS</p>
                      <p className="font-semibold">
                        {selected.paySnapshot.pasRatePct != null
                          ? `${selected.paySnapshot.pasRatePct.toFixed(2)} %`
                          : "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {bundle.period.status === "hours_validated" || bundle.period.status === "computed" ? (
            <div className={`${uiCard} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className={uiSectionTitleSm}>Étape 3 — Émettre les bulletins</p>
                <p className={uiMuted}>
                  Cotisations URSSAF + AGIRC-ARRCO 2026, assiettes plafonnées, PAS. {PAYSLIP_LEGAL_NOTICE}
                </p>
              </div>
              {!isFinalized && (
                <button
                  type="button"
                  className={uiBtnPrimary}
                  onClick={handleCompute}
                  disabled={pending}
                >
                  Calculer et émettre les bulletins
                </button>
              )}
            </div>
          ) : null}

          {bundle.period.status === "computed" && !isFinalized && (
            <div className={`${uiCard} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className={uiSectionTitleSm}>Étape 4 — Finaliser</p>
                <p className={uiMuted}>
                  Total brut {eur(totals.gross)} · net {eur(totals.net)} · coût employeur{" "}
                  {eur(totals.employer)}
                </p>
              </div>
              <button
                type="button"
                className={uiBtnPrimary}
                onClick={handleFinalize}
                disabled={pending}
              >
                Finaliser la période
              </button>
            </div>
          )}

          {isFinalized && (
            <div className={`${uiCard} space-y-3 border-emerald-200 bg-emerald-50/40`}>
              <div>
                <p className="font-semibold text-emerald-900">Période finalisée</p>
                <p className="text-sm text-emerald-800">
                  Les montants sont verrouillés. Exportez la DSN pour transmission sur net-entreprises.fr.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${uiBtnPrimary} inline-flex items-center gap-2`}
                  onClick={() => handleExportDsn("real")}
                  disabled={pending}
                >
                  <FileOutput className="h-4 w-4" aria-hidden />
                  Télécharger la DSN (réel)
                </button>
                <button
                  type="button"
                  className={`${uiBtnSecondary} inline-flex items-center gap-2`}
                  onClick={() => handleExportDsn("test")}
                  disabled={pending}
                >
                  Fichier test
                </button>
              </div>
              {dsnWarnings.length > 0 && (
                <div className={uiWarn}>
                  {dsnWarnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              )}
              <Link href="/pilotage/bilan" className="inline-block text-sm font-semibold text-copper-700">
                Voir l&apos;impact dans Ma poche →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
